// Gemini uzilishi paytida zaxira (legacy) baholash bilan 5 ball olgan urinishlarni
// topadi va qayta baholaydi yoki o'chiradi.
//
// Sabab: Gemini modeli 404 qaytarganda grading `legacyGrade` ga tushadi
// (gradedBy = 'legacy'). Model tuzatilgach, o'sha ishlarni qayta baholash mumkin.
//
// Ishga tushirish (backend/ ichidan):
//   node src/regrade.js                       ro'yxat (hech narsa o'zgarmaydi)
//   node src/regrade.js --apply               qayta baholash
//   node src/regrade.js --delete              urinishlarni o'chirish (talaba qayta topshiradi)
//
// Parametrlar:
//   --since=2026-10-09T20:00:00+05:00         shu vaqtdan keyingi topshirishlar (standart)
//   --since=all                               butun davr uchun
//   --engine=legacy                           gradedBy qiymati (vergul bilan bir nechta: legacy,error)
//   --ids=12,15                               faqat shu submission id lar
//
// O'qituvchi baho qo'ygan (teacherScore / reviewedAt) ishlarga tegilmaydi.
// Qayta baholash uchun yuklangan fayl diskda turishi kerak (Render bepul rejasida
// disk qayta ishga tushganda tozalanadi — fayli yo'qlari o'tkazib yuboriladi).

import fs from 'fs';
import prisma from './lib/prisma.js';
import { processSubmission, recalcRating } from './services/gradingService.js';
import { extractFileContent } from './services/fileParser.js';
import { DEFAULT_LANG } from './i18n/index.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const since = args.since === 'all' ? new Date(0) : new Date(args.since || '2026-10-09T20:00:00+05:00');
const engines = String(args.engine || 'legacy').split(',').map((s) => s.trim());
const ids = args.ids ? String(args.ids).split(',').map(Number) : null;
const mode = args.delete ? 'delete' : args.apply ? 'regrade' : 'list';

if (Number.isNaN(since.getTime())) {
  console.error('--since noto\'g\'ri sana');
  process.exit(1);
}

const rows = await prisma.submission.findMany({
  where: {
    submittedAt: { gte: since },
    gradedBy: { in: engines },
    teacherScore: null,
    reviewedAt: null,
    ...(ids ? { id: { in: ids } } : {}),
  },
  include: {
    student: { select: { username: true } },
    assignment: { select: { id: true, title: true, course: true } },
    sectionScores: { select: { sectionName: true, content: true } },
  },
  orderBy: { submittedAt: 'asc' },
});

console.log(`Mezon: gradedBy in [${engines}], submittedAt >= ${since.toISOString()}, o'qituvchi bahosiz`);
console.log(`Topildi: ${rows.length} ta urinish. Rejim: ${mode}\n`);

const courses = new Set();
let done = 0;
let skipped = 0;

for (const s of rows) {
  const label =
    `#${s.id} ${s.student?.username ?? '?'} · "${s.assignment?.title ?? '?'}" · ` +
    `urinish ${s.attempt} · ball ${s.overallScore} · ${s.submittedAt.toISOString()}`;

  if (mode === 'list') {
    const hasFile = s.filePath && fs.existsSync(s.filePath);
    console.log(`${label} · fayl: ${hasFile ? 'bor' : 'YO\'Q'}`);
    continue;
  }

  if (mode === 'delete') {
    await prisma.submission.delete({ where: { id: s.id } }); // sectionScores cascade
    console.log(`O'chirildi: ${label}`);
    done += 1;
    if (s.assignment?.course) courses.add(`${s.studentId}|${s.assignment.course}`);
    continue;
  }

  // ---- regrade ----
  if (!s.filePath || !fs.existsSync(s.filePath)) {
    console.log(`O'tkazib yuborildi (fayl yo'q): ${label}`);
    skipped += 1;
    continue;
  }
  const flowchartPath =
    s.flowchartPath && fs.existsSync(s.flowchartPath) ? s.flowchartPath : null;
  const sectionsData = Object.fromEntries(
    s.sectionScores.map((x) => [x.sectionName || '', x.content || ''])
  );
  const file = await extractFileContent(s.filePath);

  // Eski natijani olib tashlab, "processing" holatiga qaytaramiz, so'ng baholaymiz.
  await prisma.$transaction([
    prisma.sectionScore.deleteMany({ where: { submissionId: s.id } }),
    prisma.submission.update({
      where: { id: s.id },
      data: { overallScore: null, aiFeedbackSummary: null, gradedBy: null },
    }),
  ]);

  await processSubmission({
    submissionId: s.id,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    file,
    filePath: s.filePath,
    flowchartPath,
    sectionsData,
    lang: DEFAULT_LANG,
  });

  const after = await prisma.submission.findUnique({
    where: { id: s.id },
    select: { overallScore: true, gradedBy: true },
  });
  console.log(`Qayta baholandi: ${label} → ${after.overallScore} (${after.gradedBy})`);
  if (String(after.gradedBy).startsWith('gemini')) done += 1;
  else console.log('  ! Gemini yana ishlamadi — avval model/kalitni tekshiring');
}

// processSubmission o'zi reytingni yangilaydi; o'chirishda buni qo'lda qilamiz.
if (mode === 'delete') {
  for (const key of courses) {
    const [studentId, course] = key.split('|');
    await recalcRating(Number(studentId), course);
  }
}

if (mode !== 'list') console.log(`\nTayyor: ${done} ta muvaffaqiyatli, ${skipped} ta o'tkazib yuborildi.`);
await prisma.$disconnect();
