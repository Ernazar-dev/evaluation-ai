// Uzbek (Latin) — the platform default.
export default {
  common: {
    notFound: 'Topilmadi',
    deleted: 'O\'chirildi',
    unauthorized: 'Ruxsat yo\'q',
    internalError: 'Server ichki xatosi',
    fileTooLarge: 'Fayl juda katta. Maksimal hajm 50MB.',
    fileNotFound: 'Fayl topilmadi',
    never: 'Hech qachon',
    unknown: 'Noma\'lum',
    general: 'Umumiy',
  },

  auth: {
    usernameRequired: 'Foydalanuvchi nomi majburiy',
    passwordRequired: 'Parol majburiy',
    userExists: 'Bunday foydalanuvchi allaqachon mavjud',
    registerFailed: 'Ro\'yxatdan o\'tishda xatolik',
    registered: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz',
    invalidCredentials: 'Login yoki parol noto\'g\'ri',
    tooManyAttempts: 'Juda ko\'p urinish. 15 daqiqadan so\'ng qayta urinib ko\'ring.',
    accountBlocked: 'Hisobingiz bloklangan',
    loginSuccess: 'Tizimga muvaffaqiyatli kirdingiz',
    logoutSuccess: 'Tizimdan chiqdingiz',
    tokenRefreshed: 'Token yangilandi',
    tokenMissing: 'Token topilmadi',
    tokenInvalid: 'Token yaroqsiz',
    tokenExpired: 'Token muddati tugagan',
    userNotFound: 'Foydalanuvchi topilmadi',
  },

  user: {
    profileUpdated: 'Profil yangilandi',
    newPasswordRequired: 'Yangi parol majburiy',
    passwordTooShort: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak',
    oldPasswordRequired: 'Joriy parolni kiriting',
    oldPasswordWrong: 'Joriy parol noto\'g\'ri',
    passwordUpdated: 'Parol yangilandi',
    avatarUpdated: 'Avatar yangilandi',
  },

  admin: {
    roleRequired: 'Rol majburiy',
    invalidRole: 'Noto\'g\'ri rol. Ruxsat etilgan: admin, teacher, student',
    nameRequired: 'Nomi majburiy',
    studentRequired: 'Talaba tanlanmadi',
    userCreated: 'Foydalanuvchi muvaffaqiyatli yaratildi',
    userUpdated: 'Foydalanuvchi muvaffaqiyatli yangilandi',
    userDeleted: 'Foydalanuvchi muvaffaqiyatli o\'chirildi',
    cannotDeleteRootAdmin: 'Bosh adminni o\'chirib bo\'lmaydi',
    cannotBlockRootAdmin: 'Bosh adminni bloklab bo\'lmaydi',
    cannotChangeRootAdmin: 'Bosh adminning logini, roli va holatini o\'zgartirib bo\'lmaydi',
    cannotDeleteSelf: 'O\'z hisobingizni o\'chira olmaysiz',
    cannotBlockSelf: 'O\'z hisobingizni bloklay olmaysiz',
    userActivated: 'Foydalanuvchi faollashtirildi',
    userBlocked: 'Foydalanuvchi bloklandi',
    departmentCreated: 'Kafedra yaratildi',
    departmentExists: 'Bunday nomli kafedra allaqachon mavjud',
    subjectCreated: 'Fan yaratildi',
    subjectDeleted: 'Fan o\'chirildi',
    subjectExists: 'Bunday nomli yoki kodli fan allaqachon mavjud',
    subjectInUse: 'Fan ishlatilmoqda — avval unga bog\'liq topshiriq va reytinglarni o\'chiring',
    groupCreated: 'Guruh yaratildi',
    groupUpdated: 'Guruh yangilandi',
    groupDeleted: 'Guruh o\'chirildi',
    groupExists: 'Bunday nomli guruh allaqachon mavjud',
    groupInUse: 'Guruhni o\'chirib bo\'lmadi — u hali ishlatilmoqda',
    studentAddedToGroup: 'Talaba guruhga qo\'shildi',
    studentRemovedFromGroup: 'Talaba guruhdan chiqarildi',
    titleAndContentRequired: 'Sarlavha va matn majburiy',
    newsCreated: 'Yangilik yaratildi',
    newsUpdated: 'Yangilik yangilandi',
    newsDeleted: 'Yangilik o\'chirildi',
    settingsSaved: 'Sozlamalar saqlandi',
  },

  assignment: {
    invalidDeadline: 'Muddat formati noto\'g\'ri',
    invalidStart: 'Boshlanish sanasi formati noto\'g\'ri',
    startAfterDeadline: 'Boshlanish sanasi tugash sanasidan oldin bo\'lishi kerak',
    notStarted: 'Topshiriq hali boshlanmagan. Belgilangan sanadan keyin topshirasiz.',
    titleRequired: 'Topshiriq nomi kiritilishi shart',
    groupRequired: 'Kamida bitta guruh tanlang',
    created: 'Topshiriq yaratildi',
    updated: 'Topshiriq yangilandi',
    deleted: 'Topshiriq o\'chirildi',
    onlyStudents: 'Faqat talabalar ish topshira oladi',
    deadlinePassed: 'Muddat tugagan. Endi ish topshirib bo\'lmaydi.',
    noFile: 'Fayl biriktirilmagan',
    invalidFileType: 'Fayl turi mos emas. Ruxsat etilgan: {{allowed}}',
    attemptsExhausted:
      'Siz bu topshiriq bo\'yicha {{max}} ta urinishning barchasidan foydalandingiz. Eng yuqori ball hisobga olinadi.',
    submitted: 'Ish yuborildi. AI tahlili fonda bajarilmoqda.',
    extendPast: 'Yangi muddat kelajakdagi sana bo\'lishi kerak',
    noStudents: 'Talaba tanlanmagan yoki ular allaqachon topshirgan',
    deadlineExtended: '{{count}} ta talaba uchun yangi muddat ochildi',
  },

  literature: {
    missingData: 'Ma\'lumot yetarli emas',
    bookAdded: 'Kitob qo\'shildi',
    bookUpdated: 'Kitob yangilandi',
    bookDeleted: 'Kitob o\'chirildi',
  },

  subject: {
    onlyStudentsRatings: 'Akademik reytingni faqat talabalar ko\'ra oladi',
    onlyStudentsCalc: 'Reytingni faqat talabalar hisoblata oladi',
    onlyStudentsReport: 'Akademik hisobotni faqat talabalar yuklab oladi',
  },

  // Coursework section titles — order matches ORDERED_SECTIONS.
  sections: {
    relevance: '1. Dolzarblik',
    studyOfProblem: '2. Muammoning o\'rganilganligi',
    mainPart: '3. Asosiy qism',
    mathModel: '4. Matematik model',
    algorithm: '5. Yechish algoritmi',
    flowchart: '6. Blok-sxema',
    result: '7. Dastur natijasi',
    conclusion: '8. Xulosa',
    references: '9. Adabiyotlar ro\'yxati',
  },

  // What a full-marks answer must contain — sent to the grader as the rubric
  // description for each standard section. Keys are the internal section ids.
  rubricHints: {
    Relevance:
      'Mavzuning dolzarbligi hozirgi kontekstda asoslangan, aniq muammo qo\'yilgan, ish nima uchun kerakligi ko\'rsatilgan.',
    'Study of the problem':
      'Mavjud tadqiqot va yechimlar tahlil qilingan, manbalarga tayanilgan, ularning kamchiliklari ko\'rsatilgan.',
    'Main part':
      'Loyihaning asosiy mantig\'i to\'liq va izchil bayon etilgan, texnik qarorlar asoslangan.',
    'Mathematical model':
      'Formulalar va nazariy asos keltirilgan, belgilar izohlangan, model masalaga mos.',
    'Solution algorithm':
      'Algoritm bosqichma-bosqich, aniq va takrorlanadigan tarzda tavsiflangan; murakkabligi baholangan bo\'lsa afzal.',
    Flowchart:
      'Blok-sxema standart belgilarda tuzilgan, algoritmga to\'liq mos, boshlanish/tugash va shart bloklari to\'g\'ri.',
    'Result of the created program':
      'Dastur ishlashiga real misollar (kirish/chiqish, konsol natijasi) keltirilgan, natija tahlil qilingan.',
    Conclusion:
      'Aniq xulosalar chiqarilgan, olingan natijalar maqsad bilan solishtirilgan, kelgusi ishlar ko\'rsatilgan.',
    'List of references':
      'Manbalar to\'liq va bir xil formatda (Muallif, Nomi, Yil, Havola), matnda ularga murojaat qilingan.',
  },

  notify: {
    newAssignmentTitle: 'Yangi topshiriq: {{title}}',
    newAssignmentMessage: '{{teacher}} o\'qituvchi «{{course}}» fani bo\'yicha yangi topshiriq e\'lon qildi',
    deadlineExtendedTitle: 'Muddat uzaytirildi: {{title}}',
    deadlineExtendedMessage: 'Ushbu topshiriq siz uchun qayta ochildi. Yangi muddat: {{deadline}}',
    plagiarismTitle: 'Originallik ogohlantirishi: {{title}}',
    plagiarismMessage:
      '«{{title}}» ishingiz avval yuklangan ish bilan {{percent}}% mos keldi. Shu sababli bahodan {{penalty}} ball ayirildi.',
    plagiarismWarning:
      '«{{title}}» ishingiz avval yuklangan ish bilan {{percent}}% mos keldi. Hozircha ball kamaytirilmadi, ammo ishni mustaqil bajarish talab etiladi.',
  },

  // Originality (anti-plagiarism) check — the block appended to the AI report.
  plagiarism: {
    heading: 'ORIGINALLIK TEKSHIRUVI',
    low:
      'Bu ish avval yuklangan boshqa ish bilan {{percent}}% darajada mos keldi. Bunday darajadagi '
      + 'o\'xshashlik odatda umumiy adabiyot va standart ta\'riflardan kelib chiqadi.',
    moderate:
      'Diqqat! Bu ish avval yuklangan boshqa ish bilan {{percent}}% mos keldi. Ishning sezilarli '
      + 'qismi mustaqil yozilmagan.',
    high:
      'Ogohlantirish! Siz oldin yuklangan ishni qayta yubordingiz: mos kelish darajasi {{percent}}%. '
      + 'Ish mustaqil bajarilmagan deb baholandi.',
    duplicate:
      'Bu ish avval yuklangan ish bilan to\'liq bir xil. Siz oldin yuklangan narsani qaytadan yukladingiz.',
    penaltyApplied: 'Shu sababli bahodan {{penalty}} ball ayirildi.',
    noPenalty: 'Ball kamaytirilmadi, ammo keyingi ishlarni mustaqil bajaring.',
    matchedPassages: 'Mos kelgan parchalar:',
    rechecked: 'Originallik qayta tekshirildi',
  },

  // Audit-log lines (admin.txt + activity_log). Rendered in the reader's language.
  log: {
    register: 'Yangi foydalanuvchi ro\'yxatdan o\'tdi: {{username}} (student)',
    login: 'Foydalanuvchi {{role}} sifatida kirdi',
    logout: 'Foydalanuvchi tizimdan chiqdi',
    createUser: 'Foydalanuvchi yaratildi: {{username}} ({{role}})',
    updateUser: 'Foydalanuvchi yangilandi: {{username}}',
    updateGroup: 'Guruh yangilandi: {{name}}',
    deleteGroup: 'Guruh o\'chirildi: {{name}}',
    deleteSubject: 'Fan o\'chirildi: {{name}}',
    deleteUser: 'Foydalanuvchi o\'chirildi: {{username}}',
    createAssignment: 'Topshiriq yaratildi: {{title}}',
    updateAssignment: 'Topshiriq yangilandi: {{title}}',
    submission: 'Ish topshirildi: {{title}}',
    submissionScored: 'Topshiriq: {{title}}, ball: {{score}}',
    newsCreated: 'Yangilik yaratildi: {{title}}',
    settingsUpdated: '{{count}} ta sozlama yangilandi',
    updateCriteria: '«{{title}}» topshirig\'i mezonlari yangilandi ({{count}} ta)',
    review: '«{{title}}» ishi bahosi o\'qituvchi tomonidan tuzatildi: {{score}}',
    extendDeadline: '«{{title}}» topshirig\'i {{count}} ta talaba uchun qayta ochildi',
    plagiarism: '«{{title}}» ishida {{percent}}% o\'xshashlik aniqlandi',
  },

  criteria: {
    saved: 'Baholash mezonlari saqlandi',
    nameRequired: 'Har bir mezonning nomi bo\'lishi shart',
  },

  review: {
    saved: 'Baho saqlandi',
    invalidScore: 'Ball 0 dan 100 gacha bo\'lishi kerak',
  },

  // AI grading output shown to the student.
  ai: {
    sectionEmpty: 'Bo\'lim bo\'sh. Baho qo\'yib bo\'lmaydi.',
    tooShort: 'Akademik ish uchun javob juda qisqa.',
    basicDescription: 'Asosiy tavsif bor, lekin chuqurlik va tafsilotlar yetishmaydi.',
    contentNoAnalysis:
      'Mazmun taqdim etilgan, biroq batafsil avtomatik tahlil vaqtincha mavjud emas. Baho rasmiy belgilar (hajm) bo\'yicha qo\'yildi.',
    imageReceived: 'Rasm fayli qabul qilindi. Vizual tahlil vaqtincha rasmiy baho bilan almashtirildi.',
    almostEmpty: 'Bo\'lim deyarli bo\'sh. Mavzuni batafsilroq ochib bering.',
    shortSuperficial: 'Javob juda qisqa va yuzaki. Batafsil tavsif talab qilinadi.',
    noComment: 'Izoh berilmadi.',
    noFileContext: 'Fayldan kontekst taqdim etilmagan.',
    strongSection: 'Kuchli bo\'lim: to\'liq va to\'g\'ri bajarilgan.',
    goodSection: 'Umuman yaxshi, ammo yaxshilash va tafsilotlashtirish uchun joy bor.',
    satisfactory: 'Qoniqarli: ko\'proq aniqlik, mantiq va misollar kerak.',
    weakSection: 'Kuchsiz bo\'lim: mazmun va tuzilmani jiddiy qayta ishlash zarur.',
    perPointHeader: 'Bandlar bo\'yicha izohlar:',
    summary:
      'Yakuniy ball: {{score}}/100. Baho 9 ta asosiy bo\'lim tahlili asosida shakllantirildi. Eng kuchli bo\'limlar: {{strongest}}. Qayta ishlash kerak: {{weakest}}.',
    // O'qituvchi o'z mezonlarini belgilaganda ishlatiladi — bo'limlar soni har xil.
    summaryRubric:
      'Yakuniy ball: {{score}}/100. Baho o\'qituvchi belgilagan {{count}} ta mezon bo\'yicha qo\'yildi. Eng kuchli: {{strongest}}. Qayta ishlash kerak: {{weakest}}.',
    summaryRubricShort:
      'Yakuniy ball: {{score}}/100. Baho o\'qituvchi belgilagan {{count}} ta mezon bo\'yicha qo\'yildi.',
    pros: 'Ishning kuchli tomonlari: {{strongest}} bo\'limlari yaxshi darajada bajarilgan va talablarga javob beradi.',
    growth:
      'O\'sish nuqtalari: {{weakest}} bo\'limlariga e\'tibor bering — tafsilot yoki hajm yetishmagani uchun ular yakuniy bahoni sezilarli pasaytirdi.',
    scoreJustification: 'Yakuniy ball: {{score}}/100. Nega aynan {{score}}: bu 1–9 bandlar bo\'yicha o\'rtacha ko\'rsatkich. ',
    techError: 'AI tahlili paytida texnik xatolik yuz berdi. Iltimos, ishni qaytadan topshirib ko\'ring.',
    penaltiesLabel: 'Jarimalar:',
    strengthsLabel: 'Kuchli tomonlari:',
    improvementsLabel: 'Nimani yaxshilash kerak:',
    evidenceMissing: 'Ishda bu mezonni tasdiqlovchi material topilmadi.',
    penaltySections: 'Bo\'limlar tashlab ketilgani uchun pasaytirildi (2+).',
    penaltyCritical: 'Kritik pasaytirish: 4 tadan ortiq bo\'lim tashlab ketilgan.',
    penaltyNoFlowchart: 'Blok-sxema yo\'qligi uchun -10 ball jarima.',
    penaltyShortFile: 'Topshiriq fayli juda qisqa yoki mazmunli matn saqlamaydi.',
    // Shown when the work turns out not to be writing at all.
    nonsenseSummary:
      'Yakuniy baho: 0/100. Topshirilgan ishda mazmunli matn yo\'q — bu topshiriqqa javob emas, balki tasodifiy harflar, takrorlanuvchi to\'ldiruvchi yoki shablon matn. Mezonlar bo\'yicha baholaydigan narsaning o\'zi yo\'q.',
    nonsenseCriterion: 'Mazmunli matn yo\'q: bu mezon bo\'yicha baholaydigan narsa yo\'q.',
    nonsenseAdvice:
      'Ishni o\'z so\'zlaringiz bilan yozib, qaytadan topshiring — chin ko\'ngildan qilingan urinish, hatto to\'liq bo\'lmasa ham, mazmuniga qarab baholanadi.',
  },

  // Prompts sent to the model — they also fix the language of the AI's answer.
  prompt: {
    evaluateSection: `
        Sen — qat'iy universitet o'qituvchisisan. Vazifang — kurs ishining "{{sectionName}}" bo'limini baholash.

        KIRISH MA'LUMOTLARI:
        1. Talabaning bo'lim bo'yicha matni:
        """{{content}}"""

        2. Butun ishning konteksti (fayldan):
        """{{fileCtx}}"""

        BAHOLASH MEZONLARI (0-100 ball):
        - 0-30 (Qoniqarsiz): Matn mavzuga aloqador emas, mazmunsiz yoki juda qisqa. Plagiat yoki "quruq gap".
        - 31-59 (Qoniqarli): Mavzuga tegilgan, lekin juda yuzaki.
        - 60-79 (Yaxshi): Bo'lim yomon yozilmagan, ammo chuqurlik, misollar yoki asoslash yetishmaydi.
        - 80-100 (A'lo): To'liq, mantiqiy, professional javob.

        MUHIM: Yomon ishga past ball qo'ygan afzal, nomunosib yuqori ball qo'ygandan ko'ra. Iloji boricha qat'iy tanqidchi bo'l.

        Javobni FAQAT JSON formatida qaytar:
        {"score": <0-100 butun son>, "feedback": "<o'zbek tilida aniq izoh>"}
  `,
    overallFeedback: `
        Talabaning bandlar (1–9) bo'yicha baholari:
        {{scores}}

        Yakuniy o'rtacha ball: {{totalScore}}/100

        Hisobotni O'ZBEK tilida, qat'iy quyidagi formatda shakllantir:
        Summary: ...
        Comment 1: ...
        Comment 2: ...
        {{perPointHeader}}
        1) ...
        ... 9) gacha
  `,
  },
};
