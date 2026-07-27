import { Router } from '../lib/asyncRouter.js';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// GET /api/users/profile
router.get('/profile', async (req, res) => {
  const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.id } });
  const u = req.user;
  res.json({
    id: u.id,
    username: u.username,
    phone: u.phone,
    full_name: u.fullName,
    role: u.role,
    display_name: profile?.displayName || u.fullName || u.username,
    avatar_url: profile?.avatarUrl || null,
  });
});

// GET /api/users/my-group — the student's own group: curator, peers, assignments
router.get('/my-group', async (req, res) => {
  if (!req.user.groupId) return res.json(null);

  const group = await prisma.group.findUnique({
    where: { id: req.user.groupId },
    include: {
      teacher: true,
      members: { where: { role: 'student' }, orderBy: { fullName: 'asc' } },
      assignments: { orderBy: { deadline: 'asc' } },
    },
  });
  if (!group) return res.json(null);

  res.json({
    id: group.id,
    name: group.name,
    curator: group.teacher?.fullName || group.teacher?.username || null,
    student_count: group.members.length,
    students: group.members.map((m) => ({
      id: m.id,
      username: m.username,
      full_name: m.fullName,
    })),
    assignments: group.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      start_at: a.startAt ? a.startAt.toISOString() : null,
      deadline: a.deadline ? a.deadline.toISOString() : null,
      is_expired: !!(a.deadline && new Date() > a.deadline),
      is_upcoming: !!(a.startAt && new Date() < a.startAt),
    })),
  });
});

// PUT /api/users/profile
router.put('/profile', async (req, res) => {
  const { phone, full_name, display_name } = req.body || {};
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      phone: phone ?? req.user.phone,
      fullName: full_name ?? req.user.fullName,
    },
  });
  await prisma.userProfile.upsert({
    where: { userId: req.user.id },
    update: { displayName: display_name ?? full_name ?? null },
    create: { userId: req.user.id, displayName: display_name ?? full_name ?? null },
  });
  res.json({ message: req.t('user.profileUpdated') });
});

// PUT /api/users/password
router.put('/password', async (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (!new_password) return res.status(400).json({ error: req.t('user.newPasswordRequired') });
  if (String(new_password).length < 4)
    return res.status(400).json({ error: req.t('user.passwordTooShort') });
  // The current password is required, not optional: a token left behind on a
  // shared computer must not be enough to take the account over. An admin who
  // needs to reset a forgotten password does it from the Users page.
  if (!old_password) return res.status(400).json({ error: req.t('user.oldPasswordRequired') });
  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(old_password, fresh.passwordHash)))
    return res.status(400).json({ error: req.t('user.oldPasswordWrong') });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: await bcrypt.hash(new_password, 10) },
  });
  res.json({ message: req.t('user.passwordUpdated') });
});

// POST /api/users/avatar  (accepts a URL string; file upload handled client-side)
router.post('/avatar', async (req, res) => {
  const { avatar_url } = req.body || {};
  await prisma.userProfile.upsert({
    where: { userId: req.user.id },
    update: { avatarUrl: avatar_url || null },
    create: { userId: req.user.id, avatarUrl: avatar_url || null },
  });
  res.json({ message: req.t('user.avatarUpdated'), avatar_url });
});

export default router;
