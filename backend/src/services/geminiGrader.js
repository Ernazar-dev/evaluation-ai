// Rubric-based grading with Gemini.
//
// Unlike the per-section text grader, this sends the *whole* submission in one
// multimodal request: the original document (PDF inline, or extracted text for
// DOCX/PPTX/code, since Gemini only ingests PDF among document formats), the
// flowchart image, and the student's written answers — judged against the
// rubric. Every score has to come with a verbatim quote from the work, which is
// what makes the result checkable by a teacher rather than something to trust.

import config from '../config.js';
import { generateJson, filePart, isConfigured } from './geminiClient.js';
import { weightedTotal } from './rubric.js';
import { t, DEFAULT_LANG } from '../i18n/index.js';

const LANG_NAME = { uz: 'Uzbek (latin script)', ru: 'Russian' };

/** JSON schema the model must fill in — one entry per rubric row, plus a summary. */
function buildSchema(rows) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['criteria', 'summary', 'strengths', 'improvements'],
    properties: {
      criteria: {
        type: 'array',
        minItems: rows.length,
        maxItems: rows.length,
        items: {
          type: 'object',
          additionalProperties: false,
          // `reasoning` comes before `score` on purpose: forcing the model to
          // analyse the evidence in writing first (chain-of-thought) produces a
          // markedly more accurate, better-justified score than answering blind.
          required: ['key', 'reasoning', 'score', 'evidence', 'feedback'],
          properties: {
            key: {
              type: 'string',
              enum: rows.map((r) => r.key),
              description: 'The criterion this entry scores.',
            },
            reasoning: {
              type: 'string',
              description:
                'Step-by-step analysis of what the work does and does not show for THIS ' +
                'criterion, referring to the document, flowchart and written answers. ' +
                'Work this out BEFORE deciding the score. Not shown to the student.',
            },
            score: {
              type: 'number',
              description: 'Score for this criterion, from 0 to its maxScore, following your reasoning.',
            },
            evidence: {
              type: 'string',
              description:
                'A short verbatim quote from the student\'s work that justifies the score. ' +
                'If the work contains nothing relevant, return the exact string "NOT FOUND".',
            },
            feedback: {
              type: 'string',
              description: 'One or two sentences explaining the score and how to improve.',
            },
          },
        },
      },
      summary: { type: 'string', description: 'Two or three sentences on the work as a whole.' },
      strengths: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      improvements: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    },
  };
}

function systemInstruction(lang, hasReference) {
  const language = LANG_NAME[lang] || LANG_NAME.uz;
  const rules = [
    'You are an exacting university examiner grading a student coursework submission.',
    '',
    'Rules you must follow:',
    '1. Grade ONLY against the rubric you are given. Do not invent criteria of your own.',
    '2. Judge each criterion on the evidence actually present in the attached document,',
    '   the flowchart image, and the written answers. Never assume something is there.',
    '3. Every score must be backed by a verbatim quote from the work in the "evidence"',
    '   field. If you cannot find supporting material, the evidence is "NOT FOUND" and',
    '   the score must be at or near zero.',
    '4. Length is not quality. A short, precise, correct answer scores highly; a long,',
    '   vague or padded one does not.',
    '5. Be strict and consistent. Prefer under-rewarding weak work to over-rewarding it,',
    '   but never punish work that genuinely meets the criterion.',
  ];
  if (hasReference) {
    rules.push(
      '6. COURSE REFERENCE MATERIAL is provided below — authoritative passages from the',
      '   subject\'s textbooks. Treat it as the source of truth for factual correctness:',
      '   reward answers that agree with it, and mark down claims that contradict it or',
      '   that state as fact something the material shows to be wrong. Do NOT lower a score',
      '   merely because a correct answer is not word-for-word in the reference — the',
      '   reference is a subset of the syllabus, not the full set of acceptable answers.',
      `7. Write every "feedback", "summary", "strengths" and "improvements" value in ${language}.`,
      '   Keep the "key" values exactly as given, in their original spelling.'
    );
  } else {
    rules.push(
      `6. Write every "feedback", "summary", "strengths" and "improvements" value in ${language}.`,
      '   Keep the "key" values exactly as given, in their original spelling.'
    );
  }
  return rules.join('\n');
}

/** Renders the rubric as readable text for the prompt. */
function renderRubric(rows) {
  return rows
    .map((r, i) => {
      const lines = [`${i + 1}. [key: ${r.key}] ${r.name}`];
      lines.push(`   Max score: ${r.maxScore}   Weight: ${Math.round(r.weight * 1000) / 10}%`);
      if (r.description) lines.push(`   What full marks require: ${r.description}`);
      if (r.levels) {
        const bands = Object.entries(r.levels)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([score, text]) => `      ${score}: ${text}`)
          .join('\n');
        lines.push('   Score bands:\n' + bands);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

/** Renders the student's written answers, marking the empty ones explicitly. */
function renderAnswers(sectionsData) {
  const entries = Object.entries(sectionsData || {});
  if (!entries.length) return '(the student submitted no written answers)';
  return entries
    .map(([name, value]) => {
      const text = String(value || '').trim();
      return `### ${name}\n${text || '(left empty by the student)'}`;
    })
    .join('\n\n');
}

/**
 * Past teacher corrections for this assignment, used as calibration anchors.
 * This is how the grader learns a particular teacher's standards without any
 * fine-tuning — the examples travel in the prompt.
 */
function renderCalibration(examples) {
  if (!examples?.length) return '';
  const body = examples
    .map(
      (e, i) =>
        `Example ${i + 1}: the AI proposed ${e.aiScore}/100; the teacher corrected it to ` +
        `${e.teacherScore}/100${e.comment ? `, noting: "${e.comment}"` : '.'}`
    )
    .join('\n');
  return [
    '',
    'CALIBRATION — how this teacher has corrected earlier gradings for this assignment.',
    'Use it to match their standard, not as a target score for this student:',
    body,
  ].join('\n');
}

/**
 * Grades one submission against `rows`.
 * Returns `{ criteria, total, summary, strengths, improvements, model }`.
 * Throws if Gemini is unavailable — the caller decides on the fallback.
 */
export async function gradeWithGemini({
  assignment,
  rows,
  sectionsData,
  filePath,
  flowchartPath,
  fileText,
  calibration = [],
  reference = '',
  lang = DEFAULT_LANG,
}) {
  if (!isConfigured()) throw new Error('Gemini is not configured');

  const input = [];

  // The original document, verbatim, whenever Gemini can read the format.
  const doc = await filePart(filePath);
  if (doc) {
    input.push({ type: 'text', text: 'ATTACHED: the main document the student submitted.' });
    input.push(doc);
  } else if (fileText) {
    // Source code, .txt, or a format we had to extract ourselves.
    input.push({
      type: 'text',
      text: `MAIN DOCUMENT (extracted text):\n"""\n${fileText.slice(0, 60000)}\n"""`,
    });
  } else {
    input.push({
      type: 'text',
      text:
        'MAIN DOCUMENT: could not be read (unsupported or corrupt format). ' +
        'Do not penalise the student for this; grade what the written answers show.',
    });
  }

  const chart = await filePart(flowchartPath);
  if (chart) {
    input.push({ type: 'text', text: 'ATTACHED: the flowchart image the student uploaded.' });
    input.push(chart);
  }

  const hasReference = !!String(reference || '').trim();
  if (hasReference) {
    input.push({
      type: 'text',
      text: [
        'COURSE REFERENCE MATERIAL — authoritative passages from the subject textbooks,',
        'the most relevant to this submission. Use it to judge factual correctness per',
        'rule 6. It is reference for YOU; do not grade it, and do not quote it in "evidence"',
        '(evidence must come from the student\'s own work).',
        '"""',
        reference,
        '"""',
      ].join('\n'),
    });
  }

  input.push({
    type: 'text',
    text: [
      `ASSIGNMENT: ${assignment?.title || '(untitled)'}`,
      assignment?.course ? `SUBJECT: ${assignment.course}` : '',
      assignment?.description ? `TASK SET BY THE TEACHER:\n${assignment.description}` : '',
      '',
      'RUBRIC — grade against exactly these criteria:',
      renderRubric(rows),
      renderCalibration(calibration),
      '',
      "STUDENT'S WRITTEN ANSWERS:",
      renderAnswers(sectionsData),
      '',
      'Return one entry per criterion, using the exact "key" values from the rubric.',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  const schema = buildSchema(rows);
  const system = systemInstruction(lang, hasReference);

  // Averaging a few independent gradings smooths out run-to-run variance on
  // borderline work. GEMINI_SAMPLES=1 (the default) skips the extra cost.
  const samples = [];
  let model = config.geminiModel;
  for (let i = 0; i < config.geminiSamples; i += 1) {
    try {
      const res = await generateJson({ system, input, schema, temperature: i === 0 ? 0 : 0.3 });
      samples.push(res.data);
      model = res.model;
    } catch (e) {
      if (!samples.length && i === config.geminiSamples - 1) throw e;
    }
  }
  if (!samples.length) throw new Error('Gemini produced no usable grading');

  let graded = mergeSamples(samples, rows, lang);

  // Auditor pass: re-check every proposed score against the cited evidence and
  // the work itself, correcting the ones it does not support. One extra call for
  // a meaningful accuracy gain; a failure here quietly keeps the first grading.
  if (config.geminiVerify) {
    try {
      const audited = await verifyGrading({ input, rows, draft: graded, lang });
      if (audited?.grading) {
        graded = audited.grading;
        model = audited.model || model;
      }
    } catch (e) {
      console.error('Gemini verification pass failed, keeping first grading:', e.message);
    }
  }

  return { ...graded, model };
}

/** Auditor system prompt for the verification pass. */
function verifySystemInstruction(lang) {
  const language = LANG_NAME[lang] || LANG_NAME.uz;
  return [
    'You are a strict grading auditor. A first pass has proposed the scores shown below.',
    'Re-examine EACH criterion against the attached document, the flowchart image and the',
    "student's written answers, together with the evidence the first pass cited.",
    '',
    'Correct the grading where the work does not match the proposed score:',
    '1. If the cited evidence is not actually present in the work, or does not support the',
    '   proposed score, lower the score and replace the evidence with a real verbatim quote',
    '   (or the exact string "NOT FOUND").',
    '2. If a criterion was clearly under-scored despite real supporting evidence, raise it.',
    '3. If the proposed score is already fair and well-evidenced, keep it unchanged.',
    '4. Grade ONLY the criteria given; never invent new ones.',
    `5. Write "reasoning", "feedback", "summary", "strengths" and "improvements" in ${language}.`,
    '   Keep the "key" values exactly as given.',
  ].join('\n');
}

/** Lists the first-pass grades so the auditor can check each against the work. */
function renderProposedGrading(draft, rows) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const lines = ['FIRST-PASS GRADING TO AUDIT (verify each entry against the work):'];
  draft.criteria.forEach((c, i) => {
    const max = byKey.get(c.key)?.maxScore ?? c.maxScore ?? 100;
    lines.push(`${i + 1}. [key: ${c.key}] ${c.name}: proposed ${c.score}/${max}`);
    lines.push(`   evidence cited: ${c.evidence ? `"${c.evidence}"` : 'NONE'}`);
  });
  return lines.join('\n');
}

/**
 * Second grading pass. Reuses the fully-built multimodal `input` from the first
 * pass (document, flowchart, rubric, answers), appends the proposed grades, and
 * asks the model to audit and correct them. Returns `{ grading, model }`.
 */
async function verifyGrading({ input, rows, draft, lang }) {
  const schema = buildSchema(rows);
  const system = verifySystemInstruction(lang);
  const auditInput = [
    ...input,
    {
      type: 'text',
      text: renderProposedGrading(draft, rows) + '\n\nReturn the full corrected grading, one entry per criterion.',
    },
  ];
  const res = await generateJson({ system, input: auditInput, schema, temperature: 0 });
  return { grading: mergeSamples([res.data], rows, lang), model: res.model };
}

/** Averages the per-criterion scores across samples and keeps the median run's prose. */
function mergeSamples(samples, rows, lang) {
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const criteria = rows.map((row) => {
    const picks = samples
      .map((s) => (s.criteria || []).find((c) => c.key === row.key))
      .filter(Boolean);

    if (!picks.length) {
      return {
        key: row.key,
        name: row.name,
        criterionId: row.id,
        score: 0,
        maxScore: row.maxScore,
        weight: row.weight,
        evidence: null,
        feedback: t(lang, 'ai.noComment'),
      };
    }

    const scores = picks.map((p) => clamp(Number(p.score) || 0, 0, row.maxScore));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Keep the prose from the run closest to the average, so text and number agree.
    const closest = picks[nearestIndex(scores, avg)];
    const evidence = String(closest.evidence || '').trim();

    return {
      key: row.key,
      name: row.name,
      criterionId: row.id,
      score: Math.round(avg * 10) / 10,
      maxScore: row.maxScore,
      weight: row.weight,
      evidence: evidence && evidence !== 'NOT FOUND' ? evidence : null,
      feedback: String(closest.feedback || '').trim() || t(lang, 'ai.noComment'),
    };
  });

  const scoreMap = Object.fromEntries(criteria.map((c) => [c.key, c.score]));
  const total = weightedTotal([...byKey.values()], scoreMap);

  const primary = samples[0];
  return {
    criteria,
    total,
    summary: String(primary.summary || '').trim(),
    strengths: (primary.strengths || []).map(String).filter(Boolean),
    improvements: (primary.improvements || []).map(String).filter(Boolean),
  };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function nearestIndex(values, target) {
  let best = 0;
  let bestDiff = Infinity;
  values.forEach((v, i) => {
    const d = Math.abs(v - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}
