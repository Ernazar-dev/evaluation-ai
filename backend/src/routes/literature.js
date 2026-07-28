import { Router } from '../lib/asyncRouter.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';
import config from '../config.js';
import { authRequired, roleRequired } from '../middleware/auth.js';

const router = Router();

const booksDir = path.resolve(process.cwd(), config.uploadsDir, 'books');
const coversDir = path.join(booksDir, 'covers');
fs.mkdirSync(coversDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'cover' ? coversDir : booksDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: config.maxFileSize } });

/**
 * Resolves the `subject_id` field of a multipart form to a real Subject id.
 * Multipart carries everything as a string, so an unfiled book arrives as "",
 * and a stale id from a subject deleted in another tab would otherwise reach
 * the database as a foreign key that does not resolve — a 500 for what is
 * really just a form that needs correcting.
 * Returns `undefined` when the field was not sent at all (leave as it is).
 */
async function resolveSubjectId(raw) {
  if (raw === undefined) return undefined;
  const value = String(raw).trim();
  if (!value) return null;
  const id = Number(value);
  if (!Number.isInteger(id)) return null;
  const subject = await prisma.subject.findUnique({ where: { id } });
  return subject ? subject.id : null;
}

// Cover images are non-sensitive and served to <img> tags, which can't send the
// Authorization header — so this route stays public, before authRequired below.
router.get('/cover/:id(\\d+)', async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: Number(req.params.id) } });
  if (!book?.coverImage || !fs.existsSync(book.coverImage))
    return res.status(404).json({ message: 'Not found' });
  res.sendFile(path.resolve(book.coverImage));
});

router.use(authRequired);

// GET /api/literature/
router.get('/', async (req, res) => {
  const books = await prisma.book.findMany({ include: { subject: true }, orderBy: { createdAt: 'desc' } });
  res.json(
    books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      // The id, not only the name: the edit form has to preselect the subject,
      // and grading looks books up by subject to build the knowledge base.
      subject_id: b.subjectId,
      subject_name: b.subject ? b.subject.name : 'General',
      cover_url: b.coverImage ? `/api/literature/cover/${b.id}` : null,
      file_ext: (path.extname(b.filePath || '').replace('.', '') || 'pdf').toLowerCase(),
      created_at: b.createdAt.toISOString(),
    }))
  );
});

// POST /api/literature/  — teacher/admin
router.post(
  '/',
  roleRequired('teacher', 'admin'),
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  async (req, res) => {
    const file = req.files?.file?.[0];
    const { title, author, subject_id } = req.body || {};
    if (!file || !title) return res.status(400).json({ message: req.t('literature.missingData') });
    const book = await prisma.book.create({
      data: {
        title,
        author: author || 'Unknown',
        filePath: file.path,
        coverImage: req.files?.cover?.[0]?.path || null,
        subjectId: (await resolveSubjectId(subject_id)) ?? null,
      },
    });
    res.status(201).json({ message: req.t('literature.bookAdded'), book_id: book.id });
  }
);

// DELETE /api/literature/:id  — teacher/admin
router.delete('/:id(\\d+)', roleRequired('teacher', 'admin'), async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: Number(req.params.id) } });
  if (!book) return res.status(404).json({ message: req.t('common.notFound') });
  await prisma.book.delete({ where: { id: book.id } });
  // The row that pointed at them is gone, so nothing will ever open these
  // again. PUT already removes the files it replaces; deleting has to as well,
  // or every removed textbook stays on the uploads volume for good.
  if (book.filePath) fs.unlink(book.filePath, () => {});
  if (book.coverImage) fs.unlink(book.coverImage, () => {});
  res.json({ message: req.t('literature.bookDeleted') });
});

// PUT /api/literature/:id  — teacher/admin. Accepts multipart so the file and/or
// cover can be replaced; text fields alone are also fine.
router.put(
  '/:id(\\d+)',
  roleRequired('teacher', 'admin'),
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ message: req.t('common.notFound') });

    const { title, author, subject_id } = req.body || {};
    const newFile = req.files?.file?.[0];
    const newCover = req.files?.cover?.[0];

    const book = await prisma.book.update({
      where: { id: existing.id },
      data: {
        title: title ?? undefined,
        author: author ?? undefined,
        subjectId: await resolveSubjectId(subject_id),
        filePath: newFile ? newFile.path : undefined,
        coverImage: newCover ? newCover.path : undefined,
      },
    });

    // Remove the replaced files from disk (best-effort).
    if (newFile && existing.filePath) fs.unlink(existing.filePath, () => {});
    if (newCover && existing.coverImage) fs.unlink(existing.coverImage, () => {});

    res.json({ message: req.t('literature.bookUpdated'), book_id: book.id });
  }
);

// GET /api/literature/downloads — who downloaded what (teacher/admin)
router.get('/downloads', roleRequired('teacher', 'admin'), async (req, res) => {
  const rows = await prisma.bookDownload.findMany({
    include: { book: true, user: true },
    orderBy: { downloadedAt: 'desc' },
    take: 200,
  });
  res.json(
    rows.map((d) => ({
      id: d.id,
      book_title: d.book?.title || '-',
      username: d.user?.fullName || d.user?.username || '-',
      downloaded_at: d.downloadedAt.toISOString(),
    }))
  );
});

// GET /api/literature/download/:id
router.get('/download/:id(\\d+)', async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: Number(req.params.id) } });
  if (!book || !fs.existsSync(book.filePath)) return res.status(404).json({ message: req.t('common.fileNotFound') });
  await prisma.bookDownload.create({ data: { bookId: book.id, userId: req.user.id } }).catch(() => {});
  res.download(book.filePath);
});

export default router;
