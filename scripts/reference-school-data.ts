import { createHash } from "node:crypto";

export function referenceId(scope: string, key: string) {
  const chars = createHash("sha256").update(`school-panel:${scope}:${key}`).digest("hex").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = "8";
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const referenceTeachers = [
  { key: "amir-chogini", firstName: "امیر", lastName: "چگینی", workload: 24, attendanceDays: [0, 1, 2, 3], assignments: { "فارسی": 16, "فنون ادبی": 8 } },
  { key: "abolfazl-jamshidi", firstName: "ابوالفضل", lastName: "جمشیدی", workload: 24, attendanceDays: [1, 2, 3, 4], assignments: { "زبان انگلیسی": 24 } },
  { key: "seyed-mohammad-hosseini", firstName: "سیدمحمد", lastName: "حسینی", workload: 24, attendanceDays: [1, 2, 3], assignments: { "فیزیک": 7, "ریاضیات": 17 } },
  { key: "esmail-hamzeh", firstName: "اسماعیل", lastName: "حمزه", workload: 18, attendanceDays: [0, 2, 3, 4], assignments: { "جامعه‌شناسی": 11, "علوم اجتماعی": 4, "اقتصاد": 2, "تفکر": 1 } },
  { key: "abbas-nazari", firstName: "عباس", lastName: "نظری", workload: 21, attendanceDays: [0, 1, 2], assignments: { "زیست‌شناسی": 13, "محیط زیست": 6, "جغرافیا": 1, "نگارش": 1 } },
  { key: "ashkan-zand", firstName: "اشکان", lastName: "زند", workload: 18, attendanceDays: [0, 1, 3], assignments: { "دین و زندگی": 10, "منطق و فلسفه": 8 } },
  { key: "peyman-karami", firstName: "پیمان", lastName: "کرمی", workload: 12, attendanceDays: [0, 2], assignments: { "فیزیک": 12 } },
  { key: "mohammadreza-hemmati", firstName: "محمدرضا", lastName: "همتی", workload: 12, attendanceDays: [0, 2], assignments: { "دین و زندگی": 12 } },
  { key: "alireza-salimi", firstName: "علیرضا", lastName: "سلیمی", workload: 12, attendanceDays: [0, 2], assignments: { "ریاضیات": 12 } },
  { key: "mohammadreza-salimi", firstName: "محمدرضا", lastName: "سلیمی", workload: 12, attendanceDays: [0, 2], assignments: { "ریاضیات": 7, "زمین‌شناسی": 4, "آمادگی دفاعی": 1 } },
  { key: "rasoul-janjaneh", firstName: "رسول", lastName: "جانجانه", workload: 12, attendanceDays: [3, 4], assignments: { "تاریخ": 8, "مطالعات فرهنگی": 4 } },
] as const;

export const referenceClasses = [
  { key: "10-math", grade: "10", major: "MATH", name: "دهم ریاضی", students: 25 },
  { key: "11-math", grade: "11", major: "MATH", name: "یازدهم ریاضی", students: 25 },
  { key: "12-math", grade: "12", major: "MATH", name: "دوازدهم ریاضی", students: 25 },
  { key: "10-science", grade: "10", major: "SCIENCE", name: "دهم تجربی", students: 25 },
  { key: "11-science", grade: "11", major: "SCIENCE", name: "یازدهم تجربی", students: 25 },
  { key: "12-science", grade: "12", major: "SCIENCE", name: "دوازدهم تجربی", students: 25 },
  { key: "10-humanities", grade: "10", major: "HUMANITIES", name: "دهم انسانی", students: 25 },
  { key: "11-humanities", grade: "11", major: "HUMANITIES", name: "یازدهم انسانی", students: 25 },
  { key: "12-humanities-a", grade: "12", major: "HUMANITIES", name: "دوازدهم انسانی ۱", students: 25 },
  { key: "12-humanities-b", grade: "12", major: "HUMANITIES", name: "دوازدهم انسانی ۲", students: 25 },
] as const;

type CurriculumRow = { grade: "10" | "11" | "12"; major: "MATH" | "SCIENCE" | "HUMANITIES"; subject: string; hours: number; pattern?: number[] };

const rows = (subject: string, scopes: Array<[CurriculumRow["grade"], CurriculumRow["major"], number, number[]?]>): CurriculumRow[] => scopes.map(([grade, major, hours, pattern]) => ({ grade, major, subject, hours, pattern }));

export const referenceCurriculum: CurriculumRow[] = [
  ...rows("فارسی", [["10", "HUMANITIES", 4], ["11", "HUMANITIES", 4], ["12", "HUMANITIES", 4]]),
  ...rows("فنون ادبی", [["10", "HUMANITIES", 2], ["11", "HUMANITIES", 2], ["12", "HUMANITIES", 2]]),
  ...rows("زبان انگلیسی", [["10", "MATH", 4], ["11", "MATH", 4], ["12", "MATH", 4], ["10", "SCIENCE", 4], ["11", "SCIENCE", 4], ["12", "SCIENCE", 4]]),
  ...rows("فیزیک", [["10", "MATH", 3], ["11", "MATH", 3], ["12", "MATH", 3], ["10", "SCIENCE", 3], ["11", "SCIENCE", 3], ["12", "SCIENCE", 4]]),
  ...rows("ریاضیات", [["10", "MATH", 6, [2, 2, 1, 1]], ["11", "MATH", 6], ["12", "MATH", 6], ["10", "SCIENCE", 6, [2, 2, 1, 1]], ["11", "SCIENCE", 6], ["12", "SCIENCE", 6]]),
  ...rows("جامعه‌شناسی", [["10", "HUMANITIES", 3], ["11", "HUMANITIES", 4], ["12", "HUMANITIES", 2]]),
  ...rows("علوم اجتماعی", [["12", "HUMANITIES", 2]]),
  ...rows("اقتصاد", [["10", "HUMANITIES", 2]]),
  ...rows("تفکر", [["10", "HUMANITIES", 1]]),
  ...rows("زیست‌شناسی", [["10", "SCIENCE", 4], ["11", "SCIENCE", 4], ["12", "SCIENCE", 5]]),
  ...rows("محیط زیست", [["12", "MATH", 2], ["12", "SCIENCE", 2], ["12", "HUMANITIES", 1]]),
  ...rows("جغرافیا", [["10", "HUMANITIES", 1]]),
  ...rows("نگارش", [["10", "HUMANITIES", 1]]),
  ...rows("دین و زندگی", [["10", "MATH", 2], ["11", "MATH", 2], ["12", "MATH", 2], ["10", "SCIENCE", 2], ["11", "SCIENCE", 2], ["12", "SCIENCE", 2], ["10", "HUMANITIES", 2], ["11", "HUMANITIES", 2], ["12", "HUMANITIES", 3]]),
  ...rows("منطق و فلسفه", [["10", "HUMANITIES", 2], ["11", "HUMANITIES", 2], ["12", "HUMANITIES", 2]]),
  ...rows("زمین‌شناسی", [["11", "SCIENCE", 4]]),
  ...rows("آمادگی دفاعی", [["10", "MATH", 1]]),
  ...rows("تاریخ", [["10", "HUMANITIES", 2], ["11", "HUMANITIES", 2], ["12", "HUMANITIES", 2]]),
  ...rows("مطالعات فرهنگی", [["12", "HUMANITIES", 2]]),
];

export function defaultPattern(hours: number) {
  const pattern: number[] = [];
  let remaining = hours;
  while (remaining > 0) { const part = Math.min(2, remaining); pattern.push(part); remaining -= part; }
  return pattern;
}

export const referenceSubjectNames = [...new Set(referenceTeachers.flatMap((teacher) => Object.keys(teacher.assignments)))];
