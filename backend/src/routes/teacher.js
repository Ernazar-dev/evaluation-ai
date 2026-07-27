import { Router } from '../lib/asyncRouter.js';
import prisma from '../lib/prisma.js';
import { authRequired, roleRequired } from '../middleware/auth.js';
import { decodeDetails } from '../utils/logger.js';
import { getGroupActivity } from '../utils/groupActivity.js';
import { standardRubric } from '../services/rubric.js';
import { bestAttempts, countingScores, finalScoreOf, MAX_ATTEMPTS } from '../utils/attempts.js';

const router = Router();

router.use(authRequired, roleRequired('teacher', 'admin'));

/** Activity of this teacher's groups — feeds the teacher dashboard chart. */
router.get('/group-activity', async (req, res) => {
  const groups = await prisma.group.findMany({ where: { teacherId: req.user.id }, select: { id: true } });
  res.json(await getGroupActivity(groups.map((g) => g.id)));
});

/** Groups this teacher curates, with member and assignment counts. */
router.get('/groups', async (req, res) => {
  const groups = await prisma.group.findMany({
    where: { teacherId: req.user.id },
    include: { _count: { select: { members: true, assignments: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      student_count: g._count.members,
      assignment_count: g._count.assignments,
      created_at: g.createdAt.toISOString(),
    }))
  );
});

router.get('/groups/:id(\\d+)/students', async (req, res) => {
  const groupId = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { assignments: { orderBy: { deadline: 'asc' } } },
  });
  if (!group) return res.status(404).json({ message: req.t('common.notFound') });
  // A teacher sees the roster of the groups they curate, not of every group on
  // the platform — the id in the URL is whatever the caller chose to send.
  if (req.user.role === 'teacher' && group.teacherId !== req.user.id)
    return res.status(403).json({ message: req.t('common.unauthorized') });

  const students = await prisma.user.findMany({
    where: { groupId, role: 'student' },
    include: { submissions: true },
    orderBy: { fullName: 'asc' },
  });

  res.json({
    group: { id: group.id, name: group.name, student_count: students.length },
    students: students.map((s) => ({
      id: s.id,
      username: s.username,
      full_name: s.fullName,
      email: s.email,
      is_active: s.isActive,
      submission_count: s.submissions.length,
    })),
    assignments: group.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      deadline: a.deadline ? a.deadline.toISOString() : null,
      submitted: students.filter((s) => s.submissions.some((sub) => sub.assignmentId === a.id)).length,
    })),
  });
});

/** Flat roster across every group this teacher curates, with score totals. */
router.get('/students', async (req, res) => {
  const where =
    req.user.role === 'admin'
      ? { role: 'student' }
      : { role: 'student', group: { teacherId: req.user.id } };

  const students = await prisma.user.findMany({
    where,
    include: { group: true, submissions: true },
  });

  const rows = students.map((s) => {
    // Best attempt per assignment: retrying a task must be able to raise a
    // student's standing, never dilute it with the earlier tries.
    const scores = countingScores(s.submissions);
    const total = scores.reduce((a, b) => a + b, 0);
    return {
      id: s.id,
      username: s.username,
      full_name: s.fullName,
      group_id: s.groupId,
      group_name: s.group?.name || null,
      // Assignments handed in, not files uploaded.
      submitted_count: bestAttempts(s.submissions).length,
      total_points: Math.round(total),
      average_score: scores.length ? Math.round((total / scores.length) * 10) / 10 : 0,
    };
  });
  rows.sort((a, b) => b.total_points - a.total_points);
  res.json(rows);
});

/** One student's results, for the teacher's detail drawer. */
router.get('/student/:id(\\d+)', async (req, res) => {
  const student = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      group: true,
      submissions: { include: { assignment: true }, orderBy: { submittedAt: 'desc' } },
    },
  });
  if (!student || student.role !== 'student')
    return res.status(404).json({ message: req.t('common.notFound') });

  // Same rule as the roster this drawer opens from: a teacher may read the
  // results of their own students — those in a group they curate, or linked to
  // them directly — and no one else's. An admin sees everyone.
  if (req.user.role === 'teacher') {
    const mine =
      student.group?.teacherId === req.user.id ||
      (await prisma.teacherStudent.count({
        where: { teacherId: req.user.id, studentId: student.id },
      })) > 0;
    if (!mine) return res.status(403).json({ message: req.t('common.unauthorized') });
  }

  const scores = countingScores(student.submissions);
  const total = scores.reduce((a, b) => a + b, 0);
  const bestIds = new Set(bestAttempts(student.submissions).map((s) => s.id));

  res.json({
    id: student.id,
    username: student.username,
    full_name: student.fullName,
    group_name: student.group?.name || null,
    completed: bestIds.size,
    average_score: scores.length ? Math.round((total / scores.length) * 10) / 10 : 0,
    total_points: Math.round(total),
    // Every attempt is listed — a teacher should be able to see the earlier
    // tries — but each one says whether it is the attempt that counts.
    submissions: student.submissions.map((s) => ({
      id: s.id,
      assignment_title: s.assignment?.title || '-',
      submitted_at: s.submittedAt.toISOString(),
      overall_score: s.overallScore,
      final_score: finalScoreOf(s),
      attempt: s.attempt,
      max_attempts: MAX_ATTEMPTS,
      is_best: bestIds.has(s.id),
    })),
  });
});

/** Recent activity of the teacher's own students. */
router.get('/activity', async (req, res) => {
  const where =
    req.user.role === 'admin'
      ? { role: 'student' }
      : { role: 'student', group: { teacherId: req.user.id } };
  const students = await prisma.user.findMany({ where, select: { id: true } });

  const logs = await prisma.activityLog.findMany({
    where: { userId: { in: students.map((s) => s.id) } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json(
    logs.map((l) => ({
      id: l.id,
      username: l.user?.fullName || l.user?.username || 'System',
      action: l.action,
      details: decodeDetails(l.details, req.lang),
      created_at: l.createdAt.toISOString(),
    }))
  );
});

// ---- Criteria library ------------------------------------------------------
// A teacher's reusable rubric rows. Managed on the "Criteria" page and picked
// from when creating an assignment. Admins act on their own library too.

const templateOut = (c) => ({
  id: c.id,
  name: c.name,
  description: c.description || '',
  weight: c.weight,
  max_score: c.maxScore,
  position: c.position,
});

/** GET /api/teacher/criteria — this teacher's saved criteria, ordered. */
router.get('/criteria', async (req, res) => {
  const rows = await prisma.criterionTemplate.findMany({
    where: { teacherId: req.user.id },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });
  res.json(rows.map(templateOut));
});

/** POST /api/teacher/criteria — add one criterion to the library. */
router.post('/criteria', async (req, res) => {
  const d = req.body || {};
  const name = String(d.name || '').trim();
  if (!name) return res.status(400).json({ message: req.t('criteria.nameRequired') });
  const last = await prisma.criterionTemplate.findFirst({
    where: { teacherId: req.user.id },
    orderBy: { position: 'desc' },
  });
  const created = await prisma.criterionTemplate.create({
    data: {
      teacherId: req.user.id,
      name,
      description: String(d.description || '').trim() || null,
      weight: Number(d.weight) > 0 ? Number(d.weight) : 10,
      maxScore: Number(d.max_score) > 0 ? Math.round(Number(d.max_score)) : 100,
      position: (last?.position ?? -1) + 1,
    },
  });
  res.status(201).json(templateOut(created));
});

/** PUT /api/teacher/criteria/:id — edit one of the teacher's criteria. */
router.put('/criteria/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.criterionTemplate.findUnique({ where: { id } });
  if (!existing || existing.teacherId !== req.user.id)
    return res.status(404).json({ message: req.t('common.notFound') });

  const d = req.body || {};
  const patch = {};
  if (d.name !== undefined) {
    const name = String(d.name).trim();
    if (!name) return res.status(400).json({ message: req.t('criteria.nameRequired') });
    patch.name = name;
  }
  if (d.description !== undefined) patch.description = String(d.description || '').trim() || null;
  if (d.weight !== undefined) patch.weight = Number(d.weight) > 0 ? Number(d.weight) : 10;
  if (d.max_score !== undefined) patch.maxScore = Number(d.max_score) > 0 ? Math.round(Number(d.max_score)) : 100;
  if (d.position !== undefined && Number.isFinite(Number(d.position))) patch.position = Number(d.position);

  const updated = await prisma.criterionTemplate.update({ where: { id }, data: patch });
  res.json(templateOut(updated));
});

/** DELETE /api/teacher/criteria/:id */
router.delete('/criteria/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.criterionTemplate.findUnique({ where: { id } });
  if (!existing || existing.teacherId !== req.user.id)
    return res.status(404).json({ message: req.t('common.notFound') });
  await prisma.criterionTemplate.delete({ where: { id } });
  res.json({ message: req.t('common.deleted') });
});

/**
 * POST /api/teacher/criteria/load-standard — seed the library with the 9 standard
 * sections (in the caller's language) so a teacher can start from them and edit.
 * Appends after whatever they already have.
 */
router.post('/criteria/load-standard', async (req, res) => {
  const last = await prisma.criterionTemplate.findFirst({
    where: { teacherId: req.user.id },
    orderBy: { position: 'desc' },
  });
  let pos = (last?.position ?? -1) + 1;
  // standardRubric weights are fractions of 1; store as readable percentages.
  const rows = standardRubric(req.lang).map((r) => ({
    teacherId: req.user.id,
    name: r.name,
    description: r.description || null,
    weight: Math.round((r.weight || 0) * 100) || 10,
    maxScore: r.maxScore || 100,
    position: pos++,
  }));
  await prisma.criterionTemplate.createMany({ data: rows });
  const all = await prisma.criterionTemplate.findMany({
    where: { teacherId: req.user.id },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });
  res.status(201).json(all.map(templateOut));
});

export default router;
