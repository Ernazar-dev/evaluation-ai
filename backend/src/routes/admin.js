import { Router } from '../lib/asyncRouter.js';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import config from '../config.js';
import { authRequired, roleRequired } from '../middleware/auth.js';
import { appendAdminLog, logActivity, decodeDetails } from '../utils/logger.js';
import { getGroupActivity } from '../utils/groupActivity.js';
import { countingScores } from '../utils/attempts.js';

const router = Router();
router.use(authRequired, roleRequired('admin'));

/** The only roles the platform knows. Anything else would create an account
 *  that can log in but matches no role guard — visible nowhere, able to do
 *  nothing, and impossible to explain to whoever it was created for. */
const ROLES = new Set(['admin', 'teacher', 'student']);

/**
 * The bootstrap admin — the account seeding creates and the one guaranteed to
 * be able to log in. Deleting it, blocking it or demoting it locks everyone out
 * of the platform with no way back in short of a redeploy, so those are all
 * refused. Matched against ADMIN_USERNAME rather than the literal "admin",
 * because on a real deployment that name is whatever was set in the dashboard.
 */
const isRootAdmin = (user) => user.username === config.adminUsername;

// ---- Stats ----------------------------------------------------------------
router.get('/stats', async (req, res) => {
  const [totalUsers, totalTeachers, activeTeachers, totalStudents, activeStudents, totalAdmins, totalAssignments, totalSubmissions] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'teacher' } }),
      prisma.user.count({ where: { role: 'teacher', isActive: true } }),
      prisma.user.count({ where: { role: 'student' } }),
      prisma.user.count({ where: { role: 'student', isActive: true } }),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.assignment.count(),
      prisma.submission.count(),
    ]);
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const activeUsers = await prisma.user.count({ where: { lastSeen: { gte: weekAgo } } });
  res.json({
    total_users: totalUsers,
    total_teachers: totalTeachers,
    active_teachers: activeTeachers,
    inactive_teachers: totalTeachers - activeTeachers,
    total_students: totalStudents,
    active_students: activeStudents,
    inactive_students: totalStudents - activeStudents,
    total_admins: totalAdmins,
    active_users: activeUsers,
    total_assignments: totalAssignments,
    total_submissions: totalSubmissions,
  });
});

// ---- Users ----------------------------------------------------------------
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    include: { group: true, managedGroups: { select: { name: true }, orderBy: { name: 'asc' } } },
    orderBy: { id: 'asc' },
  });
  const now = Date.now();
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      email: u.email,
      phone: u.phone,
      full_name: u.fullName,
      is_active: u.isActive,
      group_id: u.groupId,
      group_name: u.group?.name || null,
      // Groups this user teaches (populated for teachers via Group.teacherId).
      managed_groups: u.managedGroups.map((g) => g.name),
      last_seen: u.lastSeen ? u.lastSeen.toISOString() : req.t('common.never'),
      is_online: u.lastSeen ? now - new Date(u.lastSeen).getTime() < 300000 : false,
      created_at: u.createdAt ? u.createdAt.toISOString() : null,
    }))
  );
});

router.post('/users', async (req, res) => {
  const { username, password, role, email, phone, full_name, is_active, group_id } = req.body || {};
  if (!username) return res.status(400).json({ error: req.t('auth.usernameRequired') });
  if (!password) return res.status(400).json({ error: req.t('auth.passwordRequired') });
  if (!role) return res.status(400).json({ error: req.t('admin.roleRequired') });
  if (!ROLES.has(role)) return res.status(400).json({ error: req.t('admin.invalidRole') });
  if (await prisma.user.findUnique({ where: { username } }))
    return res.status(400).json({ error: req.t('auth.userExists') });

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username,
        role,
        email: email || null,
        phone: phone || null,
        fullName: full_name || null,
        isActive: is_active ?? true,
        groupId: group_id || null,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  } catch (e) {
    // The check above leaves a gap two simultaneous requests can slip through;
    // the unique index closes it, and this turns that into a clean 400.
    if (e.code === 'P2002') return res.status(400).json({ error: req.t('auth.userExists') });
    throw e;
  }
  appendAdminLog('CREATE_USER', req.user.username, 'log.createUser', { username, role });
  await logActivity(req.user.id, 'CREATE_USER', 'log.createUser', { username, role }, req.ip);
  res.status(201).json({ message: req.t('admin.userCreated'), user_id: user.id });
});

router.get('/users/:id(\\d+)', async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: Number(req.params.id) }, include: { group: true } });
  if (!u) return res.status(404).json({ message: req.t('common.notFound') });
  res.json({
    id: u.id, username: u.username, role: u.role, email: u.email, phone: u.phone,
    full_name: u.fullName, is_active: u.isActive, group_id: u.groupId,
    group_name: u.group?.name || null,
  });
});

router.put('/users/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: req.t('common.notFound') });

  const d = req.body || {};
  // Renaming, demoting or blocking the bootstrap admin is the same lockout as
  // deleting it, so it is refused on the same grounds.
  if (isRootAdmin(existing)) {
    const renamed = d.username !== undefined && d.username !== existing.username;
    const demoted = d.role !== undefined && d.role !== 'admin';
    const blocked = d.is_active !== undefined && !d.is_active;
    if (renamed || demoted || blocked)
      return res.status(400).json({ error: req.t('admin.cannotChangeRootAdmin') });
  }

  const data = {};
  if (d.username !== undefined) data.username = d.username;
  if (d.email !== undefined) data.email = d.email;
  if (d.phone !== undefined) data.phone = d.phone || null;
  if (d.full_name !== undefined) data.fullName = d.full_name;
  if (d.role !== undefined) {
    if (!ROLES.has(d.role)) return res.status(400).json({ error: req.t('admin.invalidRole') });
    data.role = d.role;
  }
  if (d.is_active !== undefined) data.isActive = d.is_active;
  if (d.group_id !== undefined) data.groupId = d.group_id || null;
  if (d.password) data.passwordHash = await bcrypt.hash(d.password, 10);

  let user;
  try {
    user = await prisma.user.update({ where: { id }, data });
  } catch (e) {
    // Renaming a user onto a login that already exists.
    if (e.code === 'P2002') return res.status(400).json({ error: req.t('auth.userExists') });
    throw e;
  }
  appendAdminLog('UPDATE_USER', req.user.username, 'log.updateUser', { username: user.username });
  res.json({ message: req.t('admin.userUpdated') });
});

router.delete('/users/:id(\\d+)', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ message: req.t('common.notFound') });
  if (isRootAdmin(user)) return res.status(400).json({ error: req.t('admin.cannotDeleteRootAdmin') });
  // Deleting yourself would log you out mid-request and, if you are the last
  // admin left, leave the platform unmanageable.
  if (user.id === req.user.id) return res.status(400).json({ error: req.t('admin.cannotDeleteSelf') });
  await prisma.user.delete({ where: { id: user.id } });
  appendAdminLog('DELETE_USER', req.user.username, 'log.deleteUser', { username: user.username });
  res.json({ message: req.t('admin.userDeleted') });
});

router.post('/users/:id(\\d+)/toggle', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ message: req.t('common.notFound') });
  if (isRootAdmin(user)) return res.status(400).json({ error: req.t('admin.cannotBlockRootAdmin') });
  if (user.id === req.user.id) return res.status(400).json({ error: req.t('admin.cannotBlockSelf') });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { isActive: !user.isActive } });
  res.json({
    message: req.t(updated.isActive ? 'admin.userActivated' : 'admin.userBlocked'),
    is_active: updated.isActive,
  });
});

// ---- Departments ----------------------------------------------------------
router.route('/departments')
  .get(async (req, res) => {
    const deps = await prisma.department.findMany({ orderBy: { id: 'asc' } });
    res.json(deps.map((d) => ({ id: d.id, name: d.name, description: d.description })));
  })
  .post(async (req, res) => {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: req.t('admin.nameRequired') });
    try {
      const dep = await prisma.department.create({ data: { name, description: description || null } });
      res.status(201).json({ message: req.t('admin.departmentCreated'), id: dep.id });
    } catch (e) {
      // Department names are unique.
      if (e.code === 'P2002') return res.status(400).json({ error: req.t('admin.departmentExists') });
      throw e;
    }
  });

// ---- Subjects (admin management) ------------------------------------------
router.route('/subjects')
  .get(async (req, res) => {
    const subjects = await prisma.subject.findMany({ orderBy: { id: 'asc' } });
    res.json(subjects.map((s) => ({ id: s.id, name: s.name, code: s.code, description: s.description })));
  })
  .post(async (req, res) => {
    const { name, code, description } = req.body || {};
    if (!name) return res.status(400).json({ error: req.t('admin.nameRequired') });
    try {
      const subject = await prisma.subject.create({
        data: { name, code: code || name.toUpperCase().replace(/ /g, '_'), description: description || null },
      });
      res.status(201).json({ message: req.t('admin.subjectCreated'), id: subject.id });
    } catch (e) {
      // `code` is unique — a second subject deriving the same code from its name.
      if (e.code === 'P2002') return res.status(400).json({ error: req.t('admin.subjectExists') });
      throw e;
    }
  });

router.delete('/subjects/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) return res.status(404).json({ message: req.t('common.notFound') });
  try {
    await prisma.subject.delete({ where: { id } });
  } catch (e) {
    // Swallowing this used to report a deletion that never happened; the admin
    // reloaded the page and found the subject still there with no explanation.
    console.error('Subject delete failed:', e.message);
    return res.status(400).json({ error: req.t('admin.subjectInUse') });
  }
  appendAdminLog('DELETE_SUBJECT', req.user.username, 'log.deleteSubject', { name: subject.name });
  res.json({ message: req.t('admin.subjectDeleted') });
});

// ---- Groups ---------------------------------------------------------------
router.route('/groups')
  .get(async (req, res) => {
    const groups = await prisma.group.findMany({
      include: { teacher: true, _count: { select: { members: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        teacher_id: g.teacherId,
        teacher_name: g.teacher?.username || null,
        student_count: g._count.members,
      }))
    );
  })
  .post(async (req, res) => {
    const { name, teacher_id } = req.body || {};
    if (!name) return res.status(400).json({ error: req.t('admin.nameRequired') });
    try {
      const group = await prisma.group.create({ data: { name, teacherId: teacher_id || null } });
      res.status(201).json({ message: req.t('admin.groupCreated'), id: group.id });
    } catch (e) {
      // Group names are unique.
      if (e.code === 'P2002') return res.status(400).json({ error: req.t('admin.groupExists') });
      throw e;
    }
  });

router.put('/groups/:id(\\d+)', async (req, res) => {
  const { name, teacher_id } = req.body || {};
  const data = {};
  if (name !== undefined) {
    if (!name) return res.status(400).json({ error: req.t('admin.nameRequired') });
    data.name = name;
  }
  if (teacher_id !== undefined) data.teacherId = teacher_id || null;
  try {
    const group = await prisma.group.update({ where: { id: Number(req.params.id) }, data });
    appendAdminLog('UPDATE_GROUP', req.user.username, 'log.updateGroup', { name: group.name });
    res.json({ message: req.t('admin.groupUpdated') });
  } catch (e) {
    // A duplicate name trips Prisma's unique constraint (P2002) — report it as a
    // clean validation error rather than a 500.
    if (e.code === 'P2002') return res.status(400).json({ error: req.t('admin.groupExists') });
    res.status(500).json({ error: req.t('common.error') });
  }
});

router.delete('/groups/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ message: req.t('common.notFound') });
  try {
    await prisma.group.delete({ where: { id } });
  } catch (e) {
    console.error('Group delete failed:', e.message);
    return res.status(400).json({ error: req.t('admin.groupInUse') });
  }
  appendAdminLog('DELETE_GROUP', req.user.username, 'log.deleteGroup', { name: group.name });
  res.json({ message: req.t('admin.groupDeleted') });
});

router.route('/groups/:id(\\d+)/students')
  .get(async (req, res) => {
    const members = await prisma.user.findMany({ where: { groupId: Number(req.params.id), role: 'student' } });
    res.json(members.map((m) => ({ id: m.id, username: m.username, full_name: m.fullName })));
  })
  .post(async (req, res) => {
    const studentId = Number(req.body?.student_id);
    if (!Number.isInteger(studentId))
      return res.status(400).json({ error: req.t('admin.studentRequired') });
    const groupId = Number(req.params.id);
    const [group, student] = await Promise.all([
      prisma.group.findUnique({ where: { id: groupId } }),
      prisma.user.findUnique({ where: { id: studentId } }),
    ]);
    if (!group || !student || student.role !== 'student')
      return res.status(404).json({ message: req.t('common.notFound') });
    await prisma.user.update({ where: { id: studentId }, data: { groupId } });
    res.json({ message: req.t('admin.studentAddedToGroup') });
  });

router.delete('/groups/:gid(\\d+)/students/:sid(\\d+)', async (req, res) => {
  const student = await prisma.user.findUnique({ where: { id: Number(req.params.sid) } });
  if (!student) return res.status(404).json({ message: req.t('common.notFound') });
  await prisma.user.update({ where: { id: student.id }, data: { groupId: null } });
  res.json({ message: req.t('admin.studentRemovedFromGroup') });
});

router.get('/available-students', async (req, res) => {
  const students = await prisma.user.findMany({ where: { role: 'student', groupId: null } });
  res.json(students.map((s) => ({ id: s.id, username: s.username, full_name: s.fullName })));
});

// Group activity across all groups — feeds the admin dashboard chart.
router.get('/group-activity', async (req, res) => {
  res.json(await getGroupActivity(null));
});

// ---- Teachers -------------------------------------------------------------
router.get('/teachers', async (req, res) => {
  const teachers = await prisma.user.findMany({ where: { role: 'teacher' } });
  res.json(teachers.map((t) => ({ id: t.id, username: t.username, full_name: t.fullName, is_active: t.isActive })));
});

// ---- News -----------------------------------------------------------------
router.route('/news')
  .get(async (req, res) => {
    const news = await prisma.news.findMany({ include: { author: true }, orderBy: { createdAt: 'desc' } });
    res.json(
      news.map((n) => ({
        id: n.id, title: n.title, content: n.content,
        author_name: n.author?.username || 'System',
        is_published: n.isPublished,
        created_at: n.createdAt.toISOString(),
      }))
    );
  })
  .post(async (req, res) => {
    const { title, content, is_published } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: req.t('admin.titleAndContentRequired') });
    const n = await prisma.news.create({
      data: { title, content, authorId: req.user.id, isPublished: is_published ?? true },
    });
    appendAdminLog('NEWS_CREATED', req.user.username, 'log.newsCreated', { title });
    res.status(201).json({ message: req.t('admin.newsCreated'), id: n.id });
  });

router.route('/news/:id(\\d+)')
  .put(async (req, res) => {
    const { title, content, is_published } = req.body || {};
    await prisma.news.update({
      where: { id: Number(req.params.id) },
      data: {
        title: title ?? undefined,
        content: content ?? undefined,
        isPublished: is_published !== undefined ? !!is_published : undefined,
      },
    });
    res.json({ message: req.t('admin.newsUpdated') });
  })
  .delete(async (req, res) => {
    await prisma.news.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
    res.json({ message: req.t('admin.newsDeleted') });
  });

// ---- Settings -------------------------------------------------------------
router.route('/settings')
  .get(async (req, res) => {
    const settings = await prisma.setting.findMany();
    const result = {};
    settings.forEach((s) => (result[s.key] = s.value));
    res.json(result);
  })
  .post(async (req, res) => {
    const data = req.body || {};
    for (const [key, value] of Object.entries(data)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    appendAdminLog('SETTINGS_UPDATE', req.user.username, 'log.settingsUpdated', { count: Object.keys(data).length });
    res.json({ message: req.t('admin.settingsSaved') });
  });

// ---- Notifications (platform-wide feed) -----------------------------------
router.get('/notifications', async (req, res) => {
  const rows = await prisma.notification.findMany({
    include: { student: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(
    rows.map((n) => ({
      id: n.id,
      title: decodeDetails(n.title, req.lang),
      message: decodeDetails(n.message, req.lang),
      type: n.type,
      is_read: n.isRead,
      recipient: n.student?.fullName || n.student?.username || '-',
      created_at: n.createdAt.toISOString(),
    }))
  );
});

router.post('/notifications/:id(\\d+)/read', async (req, res) => {
  await prisma.notification
    .update({ where: { id: Number(req.params.id) }, data: { isRead: true } })
    .catch(() => {});
  res.json({ message: req.t('common.saved') });
});

router.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
  res.json({ message: req.t('common.saved') });
});

// ---- Activity logs --------------------------------------------------------
router.get('/activity-logs', async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(
    logs.map((l) => ({
      id: l.id,
      username: l.user?.username || 'System',
      action: l.action,
      details: decodeDetails(l.details, req.lang),
      ip_address: l.ipAddress,
      created_at: l.createdAt.toISOString(),
    }))
  );
});

// ---- Leaderboard ----------------------------------------------------------
router.get('/stats/leaderboard', async (req, res) => {
  const students = await prisma.user.findMany({
    where: { role: 'student' },
    include: { submissions: true, group: true },
  });
  const board = students.map((s) => {
    // One score per assignment — the student's best attempt — so a student who
    // retried a task is not averaged down by their earlier tries.
    const scores = countingScores(s.submissions);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      id: s.id,
      username: s.username,
      full_name: s.fullName,
      group_name: s.group?.name || '-',
      average_score: Math.round(avg * 10) / 10,
      submission_count: scores.length,
    };
  });
  board.sort((a, b) => b.average_score - a.average_score);
  res.json(board.slice(0, 50));
});

export default router;
