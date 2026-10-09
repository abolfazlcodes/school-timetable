/**
 * دادهٔ کامل‌تر تحویلی معاون دبیرستان شهید بهشتی برای سال ۱۴۰۵–۱۴۰۶.
 * منبع: تصاویر موجود در docs-assets و اصلاحات مستقیم مدرسه.
 * اعداد و نام‌ها دادهٔ seed/fixture هستند و قاعدهٔ عمومی محصول محسوب نمی‌شوند.
 */

export type CompleteMajorCode = "MATH" | "SCIENCE" | "HUMANITIES";
export type CompleteGradeCode = "10" | "11" | "12";

export type CompleteLessonRow = {
  classKey: string;
  grade: CompleteGradeCode;
  major: CompleteMajorCode;
  subject: string;
  hours: number;
  teacherKey: string;
  teacherAllocations?: readonly {
    teacherKey: string;
    hours: number;
  }[];
  sessionPattern?: readonly number[];
};

type LessonInput = readonly [
  subject: string,
  hours: number,
  teacherKey: string,
];

function lessons(
  classKey: string,
  grade: CompleteGradeCode,
  major: CompleteMajorCode,
  rows: readonly LessonInput[],
): CompleteLessonRow[] {
  return rows.map(([subject, hours, teacherKey]) => ({
    classKey,
    grade,
    major,
    subject,
    hours,
    teacherKey,
  }));
}

export const shahidBeheshtiClasses = [
  {
    key: "10-math",
    grade: "10",
    major: "MATH",
    name: "دهم ریاضی",
    students: 24,
  },
  {
    key: "11-math",
    grade: "11",
    major: "MATH",
    name: "یازدهم ریاضی",
    students: 24,
  },
  {
    key: "12-math",
    grade: "12",
    major: "MATH",
    name: "دوازدهم ریاضی",
    students: 17,
  },
  {
    key: "10-science",
    grade: "10",
    major: "SCIENCE",
    name: "دهم تجربی",
    students: 8,
  },
  {
    key: "11-science",
    grade: "11",
    major: "SCIENCE",
    name: "یازدهم تجربی",
    students: 15,
  },
  {
    key: "12-science",
    grade: "12",
    major: "SCIENCE",
    name: "دوازدهم تجربی",
    students: 5,
  },
  {
    key: "10-humanities",
    grade: "10",
    major: "HUMANITIES",
    name: "دهم انسانی",
    students: 21,
  },
  {
    key: "11-humanities",
    grade: "11",
    major: "HUMANITIES",
    name: "یازدهم انسانی",
    students: 24,
  },
  {
    key: "12-humanities-a",
    grade: "12",
    major: "HUMANITIES",
    name: "دوازدهم انسانی A",
    students: 17,
  },
  {
    key: "12-humanities-b",
    grade: "12",
    major: "HUMANITIES",
    name: "دوازدهم انسانی B",
    students: 23,
  },
] as const;

export const shahidBeheshtiLessonRows: CompleteLessonRow[] = [
  ...lessons("10-humanities", "10", "HUMANITIES", [
    ["دین و زندگی", 3, "hamid-vesali"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 2, "majid-khani"],
    ["عربی", 2, "mohammadreza-hemmati"],
    ["زبان انگلیسی", 3, "hossein-farahani"],
    ["فنون ادبی", 2, "amir-chogini"],
    ["ریاضی و آمار", 3, "alireza-salimi"],
    ["جامعه‌شناسی", 2, "esmail-hamzeh"],
    ["اقتصاد", 2, "esmail-hamzeh"],
    ["تاریخ", 3, "ali-asadi"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["جغرافیا", 2, "abbas-nazari"],
    ["منطق", 2, "ashkan-zand"],
    ["آمادگی دفاعی", 3, "hamid-vesali"],
    ["تفکر و سواد رسانه", 2, "mohammadreza-hemmati"],
  ]),
  ...lessons("11-humanities", "11", "HUMANITIES", [
    ["دین و زندگی", 4, "majid-khani"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 1, "ali-raziei"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 3, "abolfazl-jamshidi"],
    ["فنون ادبی", 2, "amir-chogini"],
    ["ریاضی و آمار", 2, "alireza-salimi"],
    ["جامعه‌شناسی", 3, "esmail-hamzeh"],
    ["روان‌شناسی", 2, "ashkan-zand"],
    ["تاریخ", 3, "rasoul-janjaneh"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["جغرافیا", 3, "abbas-nazari"],
    ["فلسفه", 2, "ashkan-zand"],
    ["انسان و محیط زیست", 2, "abbas-nazari"],
    ["کارآفرینی", 2, "rasoul-janjaneh"],
  ]),
  ...lessons("12-humanities-a", "12", "HUMANITIES", [
    ["دین و زندگی", 4, "majid-khani"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 2, "abbas-nazari"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 4, "abolfazl-jamshidi"],
    ["فنون ادبی", 2, "amir-chogini"],
    ["ریاضی و آمار", 2, "alireza-salimi"],
    ["جامعه‌شناسی", 3, "esmail-hamzeh"],
    ["مطالعات فرهنگی", 2, "esmail-hamzeh"],
    ["تاریخ", 2, "rasoul-janjaneh"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["جغرافیا", 2, "abbas-nazari"],
    ["فلسفه", 2, "ashkan-zand"],
    ["سلامت و بهداشت", 2, "esmail-hamzeh"],
    ["مدیریت خانواده", 2, "mohammadreza-hemmati"],
  ]),
  ...lessons("12-humanities-b", "12", "HUMANITIES", [
    ["دین و زندگی", 4, "majid-khani"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 2, "amir-chogini"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 4, "abolfazl-jamshidi"],
    ["فنون ادبی", 2, "amir-chogini"],
    ["ریاضی و آمار", 2, "alireza-salimi"],
    ["جامعه‌شناسی", 3, "esmail-hamzeh"],
    ["مطالعات فرهنگی", 2, "esmail-hamzeh"],
    ["تاریخ", 2, "rasoul-janjaneh"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["جغرافیا", 2, "abbas-nazari"],
    ["فلسفه", 2, "ashkan-zand"],
    ["سلامت و بهداشت", 2, "esmail-hamzeh"],
    ["مدیریت خانواده", 2, "hamid-vesali"],
  ]),
  ...lessons("10-science", "10", "SCIENCE", [
    ["دین و زندگی", 2, "hamid-vesali"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 2, "ali-asadi"],
    ["عربی", 2, "mohammadreza-hemmati"],
    ["زبان انگلیسی", 3, "abolfazl-jamshidi"],
    ["آزمایشگاه", 2, "morteza-soltani"],
    ["فیزیک", 3, "peyman-karami"],
    ["شیمی", 3, "rohollah-ahmadi"],
    ["ریاضی", 4, "mohammadreza-salimi"],
    ["زیست‌شناسی", 3, "morteza-soltani"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["جغرافیا", 2, "abbas-nazari"],
    ["آمادگی دفاعی", 3, "hamid-vesali"],
    ["تفکر و سواد رسانه", 2, "abbas-nazari"],
  ]),
  ...lessons("11-science", "11", "SCIENCE", [
    ["دین و زندگی", 2, "ashkan-zand"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 1, "majid-khani"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 3, "abolfazl-jamshidi"],
    ["آزمایشگاه", 1, "morteza-soltani"],
    ["فیزیک", 3, "peyman-karami"],
    ["شیمی", 3, "rohollah-ahmadi"],
    ["ریاضی", 4, "seyed-mohammad-hosseini"],
    ["زیست‌شناسی", 4, "morteza-soltani"],
    ["زمین‌شناسی", 2, "mohammadreza-salimi"],
    ["تاریخ معاصر", 2, "rasoul-janjaneh"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["انسان و محیط زیست", 2, "abbas-nazari"],
    ["کارآفرینی", 2, "mohammadreza-hemmati"],
  ]),
  ...lessons("12-science", "12", "SCIENCE", [
    ["دین و زندگی", 2, "ashkan-zand"],
    ["فارسی", 2, "hamid-bagheri"],
    ["نگارش", 2, "hamid-bagheri"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 4, "abolfazl-jamshidi"],
    ["فیزیک", 3, "seyed-mohammad-hosseini"],
    ["شیمی", 4, "rohollah-ahmadi"],
    ["ریاضی", 4, "seyed-mohammad-hosseini"],
    ["زیست‌شناسی", 4, "morteza-soltani"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["علوم اجتماعی", 2, "esmail-hamzeh"],
    ["سلامت و بهداشت", 2, "esmail-hamzeh"],
    ["مدیریت خانواده", 2, "hamid-vesali"],
  ]),
  ...lessons("10-math", "10", "MATH", [
    ["دین و زندگی", 2, "hamid-vesali"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 2, "ali-raziei"],
    ["عربی", 2, "mohammadreza-hemmati"],
    ["زبان انگلیسی", 3, "hossein-farahani"],
    ["آزمایشگاه", 2, "alireza-salimi"],
    ["فیزیک", 4, "peyman-karami"],
    ["شیمی", 3, "rohollah-ahmadi"],
    ["ریاضی", 4, "mohammadreza-salimi"],
    ["هندسه", 2, "alireza-salimi"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["جغرافیا", 2, "abbas-nazari"],
    ["آمادگی دفاعی", 3, "hamid-vesali"],
    ["تفکر و سواد رسانه", 2, "ali-raziei"],
  ]),
  ...lessons("11-math", "11", "MATH", [
    ["دین و زندگی", 2, "ashkan-zand"],
    ["فارسی", 2, "amir-chogini"],
    ["نگارش", 1, "amir-chogini"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 3, "abolfazl-jamshidi"],
    ["آزمایشگاه", 1, "rohollah-ahmadi"],
    ["فیزیک", 4, "peyman-karami"],
    ["شیمی", 3, "rohollah-ahmadi"],
    ["آمار و احتمال", 2, "alireza-salimi"],
    ["هندسه", 2, "seyed-mohammad-hosseini"],
    ["حسابان", 3, "seyed-mohammad-hosseini"],
    ["زمین‌شناسی", 2, "mohammadreza-salimi"],
    ["تاریخ معاصر", 2, "rasoul-janjaneh"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["انسان و محیط زیست", 2, "mohammadreza-hemmati"],
    ["کارآفرینی", 2, "rasoul-janjaneh"],
  ]),
  ...lessons("12-math", "12", "MATH", [
    ["دین و زندگی", 2, "ashkan-zand"],
    ["فارسی", 2, "hamid-bagheri"],
    ["نگارش", 2, "hamid-bagheri"],
    ["عربی", 2, "rashid-janjaneh"],
    ["زبان انگلیسی", 4, "abolfazl-jamshidi"],
    ["حسابان", 3, "seyed-mohammad-hosseini"],
    ["فیزیک", 4, "seyed-mohammad-hosseini"],
    ["شیمی", 4, "rohollah-ahmadi"],
    ["ریاضیات گسسته", 2, "seyed-mohammad-hosseini"],
    ["هندسه", 2, "seyed-mohammad-hosseini"],
    ["تربیت بدنی", 2, "abolfazl-khalili"],
    ["علوم اجتماعی", 2, "ali-raziei"],
    ["سلامت و بهداشت", 2, "esmail-hamzeh"],
    ["مدیریت خانواده", 2, "hamid-vesali"],
  ]),
];

const splitTeacherAllocations = [
  {
    classKey: "10-science",
    subject: "آمادگی دفاعی",
    allocations: [
      { teacherKey: "hamid-vesali", hours: 2 },
      { teacherKey: "mohammadreza-salimi", hours: 1 },
    ],
    sessionPattern: [2, 1],
  },
  {
    classKey: "10-math",
    subject: "آزمایشگاه",
    allocations: [
      { teacherKey: "alireza-salimi", hours: 1 },
      { teacherKey: "mohammadreza-salimi", hours: 1 },
    ],
    sessionPattern: [1, 1],
  },
  {
    classKey: "12-science",
    subject: "نگارش",
    allocations: [
      { teacherKey: "hamid-bagheri", hours: 1 },
      { teacherKey: "ali-asadi", hours: 1 },
    ],
    sessionPattern: [1, 1],
  },
  {
    classKey: "12-math",
    subject: "نگارش",
    allocations: [
      { teacherKey: "hamid-bagheri", hours: 1 },
      { teacherKey: "amir-chogini", hours: 1 },
    ],
    sessionPattern: [1, 1],
  },
  {
    classKey: "12-math",
    subject: "علوم اجتماعی",
    allocations: [
      { teacherKey: "ali-raziei", hours: 1 },
      { teacherKey: "esmail-hamzeh", hours: 1 },
    ],
    sessionPattern: [1, 1],
  },
] as const;

for (const split of splitTeacherAllocations) {
  const row = shahidBeheshtiLessonRows.find(
    (item) => item.classKey === split.classKey && item.subject === split.subject,
  );
  if (!row) throw new Error(`نیاز درسی ${split.classKey}/${split.subject} پیدا نشد.`);
  row.teacherAllocations = split.allocations;
  if (split.sessionPattern) row.sessionPattern = split.sessionPattern;
}

// معاون در نسخهٔ عملیاتی آزمایشگاه دهم تجربی را یک جلسهٔ پیوسته ثبت کرده است.
// قابلیت شکستن همچنان در UI قابل تغییر است و آزمایشگاه دهم ریاضی با الگوی ۱+۱
// وارد می‌شود.
const tenthScienceLab = shahidBeheshtiLessonRows.find(
  (item) => item.classKey === "10-science" && item.subject === "آزمایشگاه",
);
if (!tenthScienceLab) throw new Error("نیاز آزمایشگاه دهم تجربی پیدا نشد.");
tenthScienceLab.sessionPattern = [2];

// این استثنا فقط متعلق به برنامهٔ ۱۴۰۵–۱۴۰۶ شهید بهشتی است: سهم‌های سالانهٔ
// مدیریت خانواده (۱، ۲ و ۵ ساعت) تنها وقتی دقیقاً قابل تخصیص‌اند که ردیف
// دوازدهم ریاضی به دو جلسهٔ یک‌ساعته شکسته شود. مدارس و سال‌های دیگر الگوی
// ذخیره‌شدهٔ curriculum خودشان را دارند و از این override استفاده نمی‌کنند.
const twelfthMathFamilyManagement = shahidBeheshtiLessonRows.find(
  (item) =>
    item.classKey === "12-math" && item.subject === "مدیریت خانواده",
);
if (!twelfthMathFamilyManagement) {
  throw new Error("نیاز مدیریت خانواده دوازدهم ریاضی پیدا نشد.");
}
twelfthMathFamilyManagement.sessionPattern = [1, 1];

const teacherIdentity = {
  "amir-chogini": ["امیر", "چگینی"],
  "abolfazl-jamshidi": ["ابوالفضل", "جمشیدی"],
  "seyed-mohammad-hosseini": ["سیدمحمد", "حسینی"],
  "esmail-hamzeh": ["اسماعیل", "حمزه"],
  "abbas-nazari": ["عباس", "نظری"],
  "ashkan-zand": ["اشکان", "زند"],
  "peyman-karami": ["پیمان", "کرمی"],
  "mohammadreza-hemmati": ["محمدرضا", "همتی"],
  "alireza-salimi": ["علیرضا", "سلیمی"],
  "mohammadreza-salimi": ["محمدرضا", "سلیمی"],
  "rasoul-janjaneh": ["رسول", "جانجانه"],
  "rashid-janjaneh": ["رشید", "جانجانه"],
  "abolfazl-khalili": ["ابوالفضل", "خلیلی"],
  "hamid-vesali": ["حمید", "وصالی"],
  "hamid-bagheri": ["حمید", "باقری"],
  "morteza-soltani": ["مرتضی", "سلطانی"],
  "rohollah-ahmadi": ["روح‌الله", "احمدی"],
  "hossein-farahani": ["حسین", "فراهانی"],
  "majid-khani": ["مجید", "خانی"],
  "ali-asadi": ["علی", "اسدی"],
  "ali-raziei": ["علی", "رضیئ"],
} as const;

/** ۰=شنبه تا ۴=چهارشنبه. اصلاح مستقیم کاربر بر تصویر اولویت دارد. */
const attendanceDays: Record<keyof typeof teacherIdentity, readonly number[]> =
  {
    "amir-chogini": [0, 1, 2, 3],
    "abolfazl-jamshidi": [1, 2, 3, 4],
    "seyed-mohammad-hosseini": [1, 2, 3, 4],
    "esmail-hamzeh": [0, 2, 3, 4],
    "abbas-nazari": [0, 1, 2],
    "ashkan-zand": [0, 1, 3, 4],
    "peyman-karami": [0, 2],
    "mohammadreza-hemmati": [0, 2],
    "alireza-salimi": [0, 4],
    "mohammadreza-salimi": [0, 3],
    "rasoul-janjaneh": [3, 4],
    "rashid-janjaneh": [1, 3],
    "abolfazl-khalili": [0, 1, 2],
    "hamid-vesali": [0, 3, 4],
    "hamid-bagheri": [0, 4],
    "morteza-soltani": [1, 4],
    "rohollah-ahmadi": [0, 1, 2],
    "hossein-farahani": [3],
    "majid-khani": [2, 3, 4],
    "ali-asadi": [0, 1, 2, 3, 4],
    "ali-raziei": [0, 1, 2, 3, 4],
  };

const finalWorkloadProfiles: Record<
  keyof typeof teacherIdentity,
  {
    requiredWorkload: number;
    overtimeAllowance: number;
    dailyMaximum: number;
    maxConsecutive: number;
  }
> = {
  "amir-chogini": { requiredWorkload: 24, overtimeAllowance: 4, dailyMaximum: 7, maxConsecutive: 7 },
  "abolfazl-jamshidi": { requiredWorkload: 24, overtimeAllowance: 4, dailyMaximum: 7, maxConsecutive: 7 },
  "seyed-mohammad-hosseini": { requiredWorkload: 24, overtimeAllowance: 4, dailyMaximum: 7, maxConsecutive: 7 },
  "esmail-hamzeh": { requiredWorkload: 24, overtimeAllowance: 4, dailyMaximum: 7, maxConsecutive: 7 },
  "abbas-nazari": { requiredWorkload: 20, overtimeAllowance: 1, dailyMaximum: 7, maxConsecutive: 7 },
  "ashkan-zand": { requiredWorkload: 18, overtimeAllowance: 0, dailyMaximum: 6, maxConsecutive: 6 },
  "peyman-karami": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "mohammadreza-hemmati": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "alireza-salimi": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "mohammadreza-salimi": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "rasoul-janjaneh": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "rashid-janjaneh": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "abolfazl-khalili": { requiredWorkload: 18, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "hamid-vesali": { requiredWorkload: 0, overtimeAllowance: 21, dailyMaximum: 7, maxConsecutive: 7 },
  "hamid-bagheri": { requiredWorkload: 6, overtimeAllowance: 0, dailyMaximum: 6, maxConsecutive: 6 },
  "morteza-soltani": { requiredWorkload: 12, overtimeAllowance: 2, dailyMaximum: 7, maxConsecutive: 7 },
  "rohollah-ahmadi": { requiredWorkload: 6, overtimeAllowance: 15, dailyMaximum: 7, maxConsecutive: 7 },
  "hossein-farahani": { requiredWorkload: 6, overtimeAllowance: 0, dailyMaximum: 6, maxConsecutive: 6 },
  "majid-khani": { requiredWorkload: 6, overtimeAllowance: 9, dailyMaximum: 7, maxConsecutive: 7 },
  "ali-asadi": { requiredWorkload: 6, overtimeAllowance: 0, dailyMaximum: 6, maxConsecutive: 6 },
  "ali-raziei": { requiredWorkload: 6, overtimeAllowance: 0, dailyMaximum: 6, maxConsecutive: 6 },
};

/** تخصیص سالانه‌ای که معاون در نسخهٔ آزمایشی تأیید و اصلاح کرده است. */
const finalTeacherAssignments: Record<
  keyof typeof teacherIdentity,
  Readonly<Record<string, number>>
> = {
  "amir-chogini": { "فارسی": 16, "فنون ادبی": 8, "نگارش": 4 },
  "abolfazl-jamshidi": { "زبان انگلیسی": 28 },
  "seyed-mohammad-hosseini": { "تربیت بدنی": 1, "حسابان": 6, "ریاضی": 8, "ریاضیات گسسته": 2, "فیزیک": 7, "هندسه": 4 },
  "esmail-hamzeh": { "اقتصاد": 2, "جامعه‌شناسی": 11, "سلامت و بهداشت": 8, "علوم اجتماعی": 2, "مطالعات فرهنگی": 4, "نگارش": 1 },
  "abbas-nazari": { "انسان و محیط زیست": 4, "تفکر و سواد رسانه": 2, "جغرافیا": 13, "مدیریت خانواده": 1, "نگارش": 1 },
  "ashkan-zand": { "دین و زندگی": 8, "روان‌شناسی": 2, "فلسفه": 6, "منطق": 2 },
  "peyman-karami": { "فیزیک": 14 },
  "mohammadreza-hemmati": { "انسان و محیط زیست": 2, "تفکر و سواد رسانه": 2, "عربی": 6, "مدیریت خانواده": 2, "نگارش": 2 },
  "alireza-salimi": { "آزمایشگاه": 1, "آمار و احتمال": 2, "ریاضی و آمار": 9, "هندسه": 2 },
  "mohammadreza-salimi": { "آزمایشگاه": 1, "ریاضی": 8, "زمین‌شناسی": 4, "کارآفرینی": 1 },
  "rasoul-janjaneh": { "تاریخ": 7, "تاریخ معاصر": 4, "کارآفرینی": 3 },
  "rashid-janjaneh": { "عربی": 14 },
  "abolfazl-khalili": { "تربیت بدنی": 18, "نگارش": 2 },
  "hamid-vesali": { "آمادگی دفاعی": 9, "دین و زندگی": 7, "مدیریت خانواده": 5 },
  "hamid-bagheri": { "فارسی": 4, "نگارش": 2 },
  "morteza-soltani": { "آزمایشگاه": 3, "زیست‌شناسی": 11 },
  "rohollah-ahmadi": { "آزمایشگاه": 1, "شیمی": 20 },
  "hossein-farahani": { "زبان انگلیسی": 6 },
  "majid-khani": { "تربیت بدنی": 1, "دین و زندگی": 12, "نگارش": 2 },
  "ali-asadi": { "تاریخ": 3, "نگارش": 3 },
  "ali-raziei": { "تفکر و سواد رسانه": 2, "علوم اجتماعی": 2, "کارآفرینی": 2 },
};

export const shahidBeheshtiTeachers = Object.entries(teacherIdentity).map(
  ([key, [firstName, lastName]]) => {
    const assignments: Readonly<Record<string, number>> =
      finalTeacherAssignments[key as keyof typeof teacherIdentity];
    const workload = Object.values(assignments).reduce(
      (sum, hours) => sum + hours,
      0,
    );
    const { requiredWorkload, overtimeAllowance, dailyMaximum, maxConsecutive } =
      finalWorkloadProfiles[key as keyof typeof teacherIdentity];
    return {
      key,
      firstName,
      lastName,
      workload,
      requiredWorkload,
      overtimeAllowance,
      dailyMaximum,
      maxConsecutive,
      attendanceDays: attendanceDays[key as keyof typeof teacherIdentity],
      assignments,
    };
  },
);

const shahidBeheshtiSplittableTwoHourSubjects = new Set([
  "تفکر و سواد رسانه",
  "تفکر و سواد رسانه‌ای",
  "کارآفرینی",
  "ریاضیات گسسته",
  "هویت اجتماعی",
  // در snapshot فعلی عنوان معادل این درس «علوم اجتماعی» ثبت شده است.
  "علوم اجتماعی",
  "مطالعات فرهنگی",
  "تربیت بدنی",
]);

/**
 * سیاست جلسه‌بندی سال ۱۴۰۵–۱۴۰۶ شهید بهشتی.
 * این تابع دادهٔ seed همین مدرسه است؛ موتور و مدارس دیگر الگوی ذخیره‌شدهٔ
 * curriculum خودشان را مصرف می‌کنند و به این فهرست وابسته نیستند.
 */
export function shahidBeheshtiSessionPattern(
  row: Pick<CompleteLessonRow, "grade" | "major" | "subject" | "hours" | "sessionPattern">,
): readonly number[] {
  if (row.sessionPattern) return row.sessionPattern;
  if (row.hours === 3) return [2, 1];
  if (row.hours === 2) {
    const canSplit =
      shahidBeheshtiSplittableTwoHourSubjects.has(row.subject) ||
      (row.subject === "عربی" && row.grade === "12" && row.major === "SCIENCE") ||
      (row.subject === "آزمایشگاه" && row.grade === "10") ||
      (row.subject === "نگارش" && (row.grade === "10" || row.grade === "12"));
    return canSplit ? [1, 1] : [2];
  }
  const pattern: number[] = [];
  let remaining = row.hours;
  while (remaining > 0) {
    const part = Math.min(2, remaining);
    pattern.push(part);
    remaining -= part;
  }
  return pattern;
}

export const shahidBeheshtiCurriculum = [
  ...new Map(
    shahidBeheshtiLessonRows.map((row) => [
      `${row.grade}:${row.major}:${row.subject}`,
      {
        grade: row.grade,
        major: row.major,
        subject: row.subject,
        hours: row.hours,
        pattern: shahidBeheshtiSessionPattern(row),
      },
    ]),
  ).values(),
];

export const shahidBeheshtiSubjectNames = [
  ...new Set(shahidBeheshtiLessonRows.map((row) => row.subject)),
];
