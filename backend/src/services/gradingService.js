// Grades a submission in the background and recalculates the student's rating.
// Executed fire-and-forget after a submission so the HTTP request returns fast.
//
// Two engines, tried in order:
//   1. Gemini  — reads the original document and the flowchart image, grades
//                against the assignment's rubric, and cites evidence per score.
//   2. Legacy  — the original per-section OpenRouter/mock path, used when no
//                Gemini key is configured or the call fails.
// Both produce the same shape, so everything downstream is engine-agnostic.

import prisma from '../lib/prisma.js';
import {
  ORDERED_SECTIONS,
  evaluateSection,
  generateOverallFeedback,
  buildOverallFeedbackFallback,
} from './aiService.js';
import { calculateFinalScore } from './fuzzyLogic.js';
import { getOrCreateSubject } from './subjectService.js';
import { resolveRubric, weightedTotal } from './rubric.js';
import { gradeWithGemini } from './geminiGrader.js';
import { isConfigured as geminiConfigured } from './geminiClient.js';
import { getSubjectReference } from './knowledgeBase.js';
import { extractFileContent } from './fileParser.js';
import {
  buildComparisonText,
  checkPlagiarism,
  plagiarismPenalty,
  plagiarismReport,
} from './plagiarismService.js';
import { appendAdminLog, encodeDetails } from '../utils/logger.js';
import { bestAttempts, countingScores } from '../utils/attempts.js';
import { t, DEFAULT_LANG } from '../i18n/index.js';

/** How many past teacher corrections to send as calibration anchors. */
const CALIBRATION_LIMIT = 5;

export async function processSubmission({
  submissionId,
  assignmentId,
  studentId,
  file, // { text, extracted, note } from fileParser
  filePath,
  flowchartPath,
  sectionsData,
  lang = DEFAULT_LANG,
}) {
  const fileText = file?.text || '';
  const fileExtracted = !!file?.extracted;

  try {
    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!submission || !assignment || !student) return;

    const { rows, custom } = await resolveRubric(assignmentId, lang);

    // The originality check is independent of the grading, so it runs alongside
    // it rather than after — the student waits for the slower of the two, not
    // for both. It never rejects: a failed check resolves to "skipped".
    const plagiarismPromise = checkPlagiarism({
      submissionId: submission.id,
      studentId,
      assignment,
      comparisonText: buildComparisonText({ fileText, sectionsData }),
      lang,
    });

    let result = null;
    if (geminiConfigured()) {
      try {
        const calibration = await loadCalibration(assignmentId);
        const reference = await loadReference({ assignment, sectionsData, fileText });
        const graded = await gradeWithGemini({
          assignment,
          rows,
          sectionsData,
          filePath: filePath || submission.filePath,
          flowchartPath,
          fileText,
          calibration,
          reference,
          lang,
        });
        result = {
          criteria: graded.criteria,
          score: graded.total,
          feedback: formatGeminiReport(graded, lang),
          engine: `gemini:${graded.model}`,
        };
      } catch (e) {
        console.error('Gemini grading failed, falling back:', e.message);
      }
    }

    if (!result) {
      result = await legacyGrade({
        rows,
        custom,
        sectionsData,
        fileText,
        fileExtracted,
        flowchartPath,
        lang,
      });
    }

    // Persist one row per criterion, with the weight snapshotted so a later
    // edit to the rubric cannot silently rewrite an existing grade.
    for (const c of result.criteria) {
      await prisma.sectionScore.create({
        data: {
          submissionId: submission.id,
          criterionId: c.criterionId ?? null,
          sectionName: c.key,
          score: c.score,
          maxScore: c.maxScore ?? 100,
          weight: c.weight ?? null,
          content: String(sectionsData?.[c.key] ?? ''),
          feedback: c.feedback || t(lang, 'ai.noComment'),
          evidence: c.evidence || null,
        },
      });
    }

    const gradedScore = Math.round(Math.max(0, Math.min(100, result.score)) * 10) / 10;

    // Originality decides the grade last: the work is marked on its merits
    // first, and what was not the student's own is then taken back off, so the
    // report can show both figures and the teacher can see what was deducted.
    const plagiarism = await plagiarismPromise;
    const { score: finalScore, penalty } = plagiarismPenalty(gradedScore, plagiarism.score);
    const report = plagiarismReport(plagiarism, penalty, lang);
    const feedback = report ? `${result.feedback}\n\n${report}` : result.feedback;

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        overallScore: finalScore,
        aiFeedbackSummary: feedback,
        gradedBy: result.engine,
        plagiarismScore: plagiarism.status === 'skipped' ? null : plagiarism.score,
        plagiarismStatus: plagiarism.status,
        plagiarismPenalty: penalty || null,
        plagiarismReport: report,
      },
    });

    if (report) {
      await notifyPlagiarism({ studentId, assignmentId, assignment, plagiarism, penalty });
      appendAdminLog('PLAGIARISM', student.username, 'log.plagiarism', {
        title: assignment.title,
        percent: Math.round(plagiarism.score),
      });
    }

    if (assignment.course) {
      try {
        await recalcRating(studentId, assignment.course);
      } catch (e) {
        console.error('Error calculating rating in background:', e.message);
      }
    }

    appendAdminLog('SUBMISSION', student.username, 'log.submissionScored', {
      title: assignment.title,
      score: finalScore.toFixed(1),
    });
  } catch (e) {
    console.error('Critical error in processSubmission:', e);
    try {
      const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
      if (sub && sub.overallScore === null) {
        await prisma.submission.update({
          where: { id: submissionId },
          data: { overallScore: 0, aiFeedbackSummary: t(lang, 'ai.techError'), gradedBy: 'error' },
        });
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Re-runs the originality check on a submission that has already been graded —
 * for work handed in before this check existed, and for when a later submission
 * turns out to be the source of an earlier one.
 *
 * Idempotent by construction: the previous deduction is added back before the
 * new one is worked out, so re-checking the same submission twice can never
 * punish a student twice for the same overlap. The rest of the grade — the
 * rubric scores, the teacher's correction — is left exactly as it was.
 */
export async function recheckPlagiarism(submissionId, lang = DEFAULT_LANG) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true, sectionScores: { select: { sectionName: true, content: true } } },
  });
  if (!submission) return null;

  const file = submission.filePath ? await extractFileContent(submission.filePath) : { text: '' };
  const sectionsData = Object.fromEntries(
    submission.sectionScores.map((s) => [s.sectionName || '', s.content || ''])
  );

  const plagiarism = await checkPlagiarism({
    submissionId: submission.id,
    studentId: submission.studentId,
    assignment: submission.assignment,
    comparisonText: buildComparisonText({ fileText: file.text, sectionsData }),
    lang,
  });

  // Undo the previous deduction to recover the grade the work earned on merit.
  const previousPenalty = submission.plagiarismPenalty || 0;
  const base = Math.max(0, Math.min(100, (submission.overallScore ?? 0) + previousPenalty));
  const { score: finalScore, penalty } = plagiarismPenalty(base, plagiarism.score);
  const report = plagiarismReport(plagiarism, penalty, lang);

  // The previous warning was appended to the report text; drop it before the new
  // one goes on, or repeated checks would stack warnings on top of each other.
  let summary = submission.aiFeedbackSummary || '';
  if (submission.plagiarismReport && summary.endsWith(submission.plagiarismReport)) {
    summary = summary.slice(0, -submission.plagiarismReport.length).trimEnd();
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      overallScore: submission.overallScore === null ? null : finalScore,
      aiFeedbackSummary: report ? `${summary}\n\n${report}`.trim() : summary || null,
      plagiarismScore: plagiarism.status === 'skipped' ? null : plagiarism.score,
      plagiarismStatus: plagiarism.status,
      plagiarismPenalty: penalty || null,
      plagiarismReport: report,
    },
  });

  // The rating follows the grade, so a deduction has to reach it too.
  if (submission.assignment?.course && submission.studentId) {
    try {
      await recalcRating(submission.studentId, submission.assignment.course);
    } catch (e) {
      console.error('rating recalc after re-check failed:', e.message);
    }
  }

  return { ...plagiarism, penalty, score_before: base, score_after: finalScore };
}

/**
 * Tells the student their work matched an earlier submission. The message says
 * what was found and what it cost them, but never who the other student was —
 * that belongs in the teacher's view, not in an accusation sent to a classmate.
 */
async function notifyPlagiarism({ studentId, assignmentId, assignment, plagiarism, penalty }) {
  try {
    const params = {
      title: assignment?.title || '',
      percent: Math.round(plagiarism.score),
      penalty: penalty.toFixed(1),
    };
    await prisma.notification.create({
      data: {
        studentId,
        assignmentId: assignmentId ?? null,
        title: encodeDetails('notify.plagiarismTitle', params),
        message: encodeDetails(
          penalty > 0 ? 'notify.plagiarismMessage' : 'notify.plagiarismWarning',
          params
        ),
        type: 'plagiarism',
      },
    });
  } catch (e) {
    console.error('Error creating plagiarism notification:', e.message);
  }
}

/**
 * The pre-Gemini path: score each rubric row with a text model, then apply the
 * weighted average. It only ever sees extracted text, never the document or the
 * diagram, so it is a fallback for when Gemini is unavailable — not an equal.
 * The coursework penalties below apply to the 9 standard sections only.
 */
async function legacyGrade({ rows, custom, sectionsData, fileText, fileExtracted, flowchartPath, lang }) {
  const sections = custom ? rows.map((r) => r.key) : ORDERED_SECTIONS;
  const scoreMap = {};
  let emptySections = 0;

  const results = await Promise.all(
    sections.map(async (key) => {
      const content = sectionsData[key] || '';
      const isEmpty = !content || content.trim().length < 10;
      const ai = await evaluateSection(key, content, fileText, lang);
      return { key, ai, isEmpty };
    })
  );

  const criteria = results.map(({ key, ai, isEmpty }) => {
    if (isEmpty) emptySections += 1;
    scoreMap[key] = ai.score ?? 0;
    const row = rows.find((r) => r.key === key);
    return {
      key,
      name: row?.name || key,
      criterionId: row?.id ?? null,
      score: ai.score ?? 0,
      maxScore: row?.maxScore ?? 100,
      weight: row?.weight ?? null,
      evidence: null,
      feedback: String(ai.feedback ?? t(lang, 'ai.noComment')),
    };
  });

  // A custom rubric carries its own weights and maxScores, so score it through
  // the rubric helper rather than the coursework-specific weighted average.
  let avg = custom ? weightedTotal(rows, scoreMap) : calculateFinalScore(scoreMap);

  // The penalties below encode the rules of the 9-section coursework: skipped
  // sections and a missing flowchart. A teacher's own rubric says nothing about
  // either, so applying them there would mark work down for criteria nobody set.
  const penalties = [];
  if (!custom) {
    if (emptySections >= 2) {
      avg = Math.min(avg, 60);
      penalties.push(t(lang, 'ai.penaltySections'));
    }
    if (emptySections >= 4) {
      avg = Math.min(avg, 30);
      penalties.push(t(lang, 'ai.penaltyCritical'));
    }
    if (!flowchartPath) {
      avg -= 10;
      penalties.push(t(lang, 'ai.penaltyNoFlowchart'));
    }
  }
  // Only penalise a short document when we actually managed to read it. An
  // unreadable file (scanned PDF, legacy .doc) is a limitation on our side —
  // capping the student at 40 for it would be plainly unfair.
  if (fileExtracted && fileText.trim().length < 300) {
    avg = Math.min(avg, 40);
    penalties.push(t(lang, 'ai.penaltyShortFile'));
  }
  avg = Math.max(0, avg);

  const finalScore = Math.round(avg * 10) / 10;
  let feedback;
  if (custom) {
    // The standard summary builders are written around the 9 fixed sections and
    // would report a custom rubric as nine zeros. Summarise the real rows instead.
    feedback = buildCustomSummary(criteria, finalScore, lang);
  } else {
    try {
      feedback = await generateOverallFeedback(scoreMap, finalScore, lang);
    } catch {
      feedback = buildOverallFeedbackFallback(scoreMap, finalScore, false, lang);
    }
  }
  if (penalties.length)
    feedback += `\n\n**${t(lang, 'ai.penaltiesLabel')}** ${penalties.join(' ')}`;

  return { criteria, score: finalScore, feedback, engine: 'legacy' };
}

/** Report text for a teacher-defined rubric graded on the legacy path. */
function buildCustomSummary(criteria, finalScore, lang) {
  const ranked = [...criteria].sort(
    (a, b) => a.score / (a.maxScore || 100) - b.score / (b.maxScore || 100)
  );
  const names = (list) => list.map((c) => c.name).join(', ');
  // Naming a "strongest" and a "weakest" third only says something when the two
  // lists are disjoint. With four criteria or fewer they would overlap, which
  // reads as the same rubric row being both the best and the worst of the work.
  const pick = Math.min(3, Math.floor(criteria.length / 2));
  const params = { score: Math.round(finalScore), count: criteria.length };
  const summary = pick
    ? t(lang, 'ai.summaryRubric', {
        ...params,
        strongest: names(ranked.slice(-pick).reverse()),
        weakest: names(ranked.slice(0, pick)),
      })
    : t(lang, 'ai.summaryRubricShort', params);

  const lines = [`Summary: ${summary}`, '', t(lang, 'ai.perPointHeader')];
  criteria.forEach((c, i) => {
    lines.push(`${i + 1}) ${c.name}: ${Math.round(c.score)}/${c.maxScore} — ${c.feedback}`);
  });
  return lines.join('\n');
}

/** Turns the structured Gemini result into the report text students read. */
function formatGeminiReport(graded, lang) {
  const lines = [];
  if (graded.summary) lines.push(`Summary: ${graded.summary}`);
  if (graded.strengths.length)
    lines.push('', `**${t(lang, 'ai.strengthsLabel')}**`, ...graded.strengths.map((s) => `• ${s}`));
  if (graded.improvements.length)
    lines.push('', `**${t(lang, 'ai.improvementsLabel')}**`, ...graded.improvements.map((s) => `• ${s}`));

  lines.push('', t(lang, 'ai.perPointHeader'));
  graded.criteria.forEach((c, i) => {
    lines.push(`${i + 1}) ${c.name}: ${c.score}/${c.maxScore} — ${c.feedback}`);
  });
  return lines.join('\n');
}

/**
 * Retrieves the course-material passages most relevant to this submission, so
 * the grader can check the work against the actual textbook. The query is built
 * from the task and the student's own words, so retrieval keys on the topic the
 * submission is actually about. Never throws — a KB miss just means no reference.
 */
async function loadReference({ assignment, sectionsData, fileText }) {
  try {
    const answers = Object.values(sectionsData || {}).join(' ');
    const query = [
      assignment?.title,
      assignment?.description,
      answers,
      (fileText || '').slice(0, 8000),
    ]
      .filter(Boolean)
      .join('\n');
    const { text, sources, passageCount } = await getSubjectReference({
      subjectId: assignment?.subjectId ?? null,
      courseName: assignment?.course || '',
      queryText: query,
    });
    if (text) {
      console.log(
        `KB: attached ${passageCount} passage(s) from ${sources.length} source(s) for "${assignment?.course || 'subject'}"`
      );
    }
    return text;
  } catch (e) {
    console.error('Knowledge base lookup failed, grading without reference:', e.message);
    return '';
  }
}

/**
 * Past teacher corrections on this assignment. These travel in the prompt so
 * the grader matches the teacher's standard — calibration without fine-tuning.
 */
async function loadCalibration(assignmentId) {
  if (!assignmentId) return [];
  const reviewed = await prisma.submission.findMany({
    where: { assignmentId, teacherScore: { not: null }, overallScore: { not: null } },
    orderBy: { reviewedAt: 'desc' },
    take: CALIBRATION_LIMIT,
    select: { overallScore: true, teacherScore: true, teacherComment: true },
  });
  return reviewed.map((r) => ({
    aiScore: Math.round(r.overallScore),
    teacherScore: Math.round(r.teacherScore),
    comment: r.teacherComment || '',
  }));
}

/** Recomputes (or creates) the AcademicRating row for a student in a subject/course. */
export async function recalcRating(studentId, courseName) {
  const subject = await getOrCreateSubject(courseName);
  if (!subject) return null;

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  const where = { course: courseName };
  if (student?.groupId) where.groupId = student.groupId;
  const assignments = await prisma.assignment.findMany({ where });
  const assignmentIds = assignments.map((a) => a.id);

  const submissions = assignmentIds.length
    ? await prisma.submission.findMany({
        where: { studentId, assignmentId: { in: assignmentIds } },
      })
    : [];

  const totalAssignments = assignments.length;
  // Counted per assignment, not per submission: three attempts at one task is
  // still one assignment completed, and only the best of them is graded.
  const best = bestAttempts(submissions);
  const completedAssignments = best.filter((s) => s.overallScore !== null).length;
  const scores = countingScores(submissions);
  const averageScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  let rating = Math.round((averageScore / 100) * 5 * 100) / 100;
  rating = Math.min(5, Math.max(0, rating));

  const data = { rating, totalAssignments, completedAssignments, averageScore };

  return prisma.academicRating.upsert({
    where: { studentId_subjectId: { studentId, subjectId: subject.id } },
    update: data,
    create: { studentId, subjectId: subject.id, ...data },
  });
}
