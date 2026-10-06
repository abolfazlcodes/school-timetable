// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  shahidBeheshtiClasses,
  shahidBeheshtiCurriculum,
  shahidBeheshtiLessonRows,
  shahidBeheshtiTeachers,
  shahidBeheshtiSessionPattern,
} from "../../../scripts/shahid-beheshti-complete-data";
import { makeProblem } from "./fixtures.test-helper";
import { runPreflight } from "./preflight";
import { solveSchedule } from "./solver";
import type { SchedulingProblem } from "./types";
import { validateSchedule } from "./validator";

function makeCompleteShahidProblem(): SchedulingProblem {
  const periods = Array.from({ length: 5 }, (_, dayOrder) => Array.from({ length: 4 }, (_, offset) => ({
    id: `d${dayOrder}-p${offset + 1}`,
    dayId: `d${dayOrder}`,
    dayLabel: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"][dayOrder],
    dayOrder,
    position: offset + 1,
    label: `زنگ ${offset + 1}`,
    startTime: ["08:00", "09:25", "11:00", "12:30"][offset],
    endTime: ["09:15", "10:45", "12:25", "13:20"][offset],
    instructionalUnits: offset < 3 ? 2 : 1,
    isLast: offset === 3,
  }))).flat();
  const classes = shahidBeheshtiClasses.map((schoolClass) => ({
    id: schoolClass.key,
    name: schoolClass.name,
    gradeId: schoolClass.grade,
    gradeName: schoolClass.grade,
    majorId: schoolClass.major,
    majorName: schoolClass.major,
  }));
  const curriculum = shahidBeheshtiLessonRows.map((row, index) => ({
    id: `requirement-${index}`,
    classId: row.classKey,
    className: classes.find((schoolClass) => schoolClass.id === row.classKey)!.name,
    subjectId: row.subject,
    subjectName: row.subject,
    weeklyHours: row.hours,
    sessionPattern: [...shahidBeheshtiSessionPattern(row)],
    assignedTeacherId: null,
  }));
  const teachers = shahidBeheshtiTeachers.map((teacher) => ({
    id: teacher.key,
    name: `${teacher.firstName} ${teacher.lastName}`,
    profileConfigured: true,
    subjectAssignments: Object.entries(teacher.assignments).map(([subjectId, assignedWeeklyHours]) => ({ subjectId, assignedWeeklyHours })),
    minimumWorkload: teacher.workload,
    requiredWorkload: teacher.requiredWorkload,
    maximumWorkload: teacher.requiredWorkload,
    overtimeAllowance: teacher.overtimeAllowance,
    dailyMaximum: 4,
    maxConsecutive: 4,
    availability: Object.fromEntries(
      periods.map((period) => [
        period.id,
        teacher.attendanceDays.includes(period.dayOrder)
          ? "AVAILABLE"
          : "UNAVAILABLE",
      ]),
    ),
  })) as SchedulingProblem["teachers"];
  return { schoolId: "shahid-beheshti", academicYearId: "1405", academicYearTitle: "۱۴۰۵–۱۴۰۶", classes, periods, curriculum, teachers };
}

describe("داده کامل‌تر شهید بهشتی", () => {
  it("ده کلاس، ۳۴۹ ساعت قابل‌زمان‌بندی و ۲۱ دبیر را بدون کمبود پوشش می‌دهد", () => {
    const teacherKeys = new Set(shahidBeheshtiTeachers.map((teacher) => teacher.key));
    const byClass = new Map<string, number>();
    const demandBySubject = new Map<string, number>();
    for (const row of shahidBeheshtiLessonRows) {
      expect(teacherKeys.has(row.teacherKey)).toBe(true);
      byClass.set(row.classKey, (byClass.get(row.classKey) ?? 0) + row.hours);
      demandBySubject.set(row.subject, (demandBySubject.get(row.subject) ?? 0) + row.hours);
    }
    const assignedBySubject = new Map<string, number>();
    for (const teacher of shahidBeheshtiTeachers) {
      expect(teacher.workload).toBe(Object.values(teacher.assignments).reduce((sum, hours) => sum + hours, 0));
      for (const [subject, hours] of Object.entries(teacher.assignments)) assignedBySubject.set(subject, (assignedBySubject.get(subject) ?? 0) + hours);
    }
    expect(shahidBeheshtiClasses).toHaveLength(10);
    expect(shahidBeheshtiTeachers).toHaveLength(21);
    expect(shahidBeheshtiLessonRows.reduce((sum, row) => sum + row.hours, 0)).toBe(349);
    expect(Object.fromEntries(byClass)).toMatchObject({ "10-math": 34 });
    expect([...byClass].filter(([classKey]) => classKey !== "10-math").map(([, hours]) => hours)).toEqual(Array(9).fill(35));
    expect(Object.fromEntries(assignedBySubject)).toEqual(Object.fromEntries(demandBySubject));
  });

  it("آمار فعلی ۱۰ کلاس شهید بهشتی را دقیق نگه می‌دارد", () => {
    expect(Object.fromEntries(shahidBeheshtiClasses.map((schoolClass) => [schoolClass.key, schoolClass.students]))).toEqual({
      "10-math": 24,
      "10-science": 8,
      "10-humanities": 21,
      "11-math": 24,
      "11-science": 15,
      "11-humanities": 24,
      "12-math": 17,
      "12-science": 5,
      "12-humanities-a": 17,
      "12-humanities-b": 23,
    });
    expect(shahidBeheshtiClasses.reduce((sum, schoolClass) => sum + schoolClass.students, 0)).toBe(178);
  });

  it("الگوی جلسه‌های هر کلاس مجموع ساعت صحیح دارد و curriculum دو کلاس دوازدهم انسانی یکسان است", () => {
    for (const schoolClass of shahidBeheshtiClasses) {
      const rows = shahidBeheshtiLessonRows.filter((row) => row.classKey === schoolClass.key);
      expect(rows.reduce((sum, row) => sum + row.hours, 0)).toBe(schoolClass.key === "10-math" ? 34 : 35);
      expect(rows.flatMap((row) => shahidBeheshtiSessionPattern(row)).every((hours) => hours === 1 || hours === 2)).toBe(true);
    }
    expect(shahidBeheshtiCurriculum).toHaveLength(130);
    const humanities12 = shahidBeheshtiCurriculum.filter((row) => row.grade === "12" && row.major === "HUMANITIES");
    expect(humanities12.reduce((sum, row) => sum + row.hours, 0)).toBe(35);
    expect(shahidBeheshtiLessonRows.find((row) => row.classKey === "12-humanities-a" && row.subject === "نگارش")?.teacherKey).toBe("abbas-nazari");
    expect(shahidBeheshtiLessonRows.find((row) => row.classKey === "12-humanities-b" && row.subject === "نگارش")?.teacherKey).toBe("amir-chogini");
  });

  it("قاعده معاون را برای سه‌ساعته‌ها و فهرست محدود دوساعته‌های قابل شکستن اعمال می‌کند", () => {
    const patterns = shahidBeheshtiLessonRows.map((row) => ({
      row,
      pattern: [...shahidBeheshtiSessionPattern(row)],
    }));
    for (const item of patterns.filter(({ row }) => row.hours === 3)) {
      expect(item.pattern, `${item.row.classKey}/${item.row.subject}`).toEqual([2, 1]);
    }

    const splittable = patterns.filter(({ row, pattern }) => row.hours === 2 && pattern.length === 2);
    expect(splittable.length).toBeGreaterThan(0);
    for (const { row, pattern } of splittable) {
      expect(pattern).toEqual([1, 1]);
      expect(
        ["تفکر و سواد رسانه", "تفکر و سواد رسانه‌ای", "کارآفرینی", "ریاضیات گسسته", "هویت اجتماعی", "علوم اجتماعی", "مطالعات فرهنگی", "تربیت بدنی"].includes(row.subject)
          || (row.subject === "عربی" && row.grade === "12" && row.major === "SCIENCE")
          || (row.subject === "آزمایشگاه" && row.grade === "10")
          || (row.subject === "نگارش" && ["10", "12"].includes(row.grade)),
        `${row.classKey}/${row.subject}`,
      ).toBe(true);
    }
    for (const { row, pattern } of patterns.filter(({ row, pattern }) => row.hours === 2 && pattern.length === 1)) {
      expect(pattern, `${row.classKey}/${row.subject}`).toEqual([2]);
    }

    expect(shahidBeheshtiSessionPattern({ grade: "12", major: "MATH", subject: "حسابان", hours: 3 })).toEqual([2, 1]);
    expect(shahidBeheshtiSessionPattern({ grade: "10", major: "SCIENCE", subject: "آمادگی دفاعی", hours: 3 })).toEqual([2, 1]);
    expect(shahidBeheshtiSessionPattern({ grade: "11", major: "SCIENCE", subject: "فیزیک", hours: 2 })).toEqual([2]);
    expect(shahidBeheshtiSessionPattern({ grade: "12", major: "MATH", subject: "ریاضیات گسسته", hours: 2 })).toEqual([1, 1]);
    expect(shahidBeheshtiSessionPattern({ grade: "12", major: "SCIENCE", subject: "عربی", hours: 2 })).toEqual([1, 1]);
    expect(shahidBeheshtiSessionPattern({ grade: "12", major: "MATH", subject: "عربی", hours: 2 })).toEqual([2]);
    expect(shahidBeheshtiSessionPattern({ grade: "10", major: "SCIENCE", subject: "عربی", hours: 2 })).toEqual([2]);
    expect(shahidBeheshtiSessionPattern({ grade: "12", major: "SCIENCE", subject: "تربیت بدنی", hours: 2 })).toEqual([1, 1]);
  });

  it("تقسیم نیاز درسی میان چند دبیر را بدون تغییر مجموع درس نگه می‌دارد", () => {
    const splitRows = shahidBeheshtiLessonRows.filter((row) => row.teacherAllocations);
    expect(splitRows).toHaveLength(5);
    for (const row of splitRows) {
      expect(row.teacherAllocations!.reduce((sum, item) => sum + item.hours, 0)).toBe(row.hours);
      for (const allocation of row.teacherAllocations!) {
        expect(shahidBeheshtiTeachers.some((teacher) => teacher.key === allocation.teacherKey)).toBe(true);
      }
    }
  });

  it("روزهای حضور قطعی اعلام‌شده را مستقل از موظفی نگه می‌دارد", () => {
    const attendance = Object.fromEntries(
      shahidBeheshtiTeachers.map((teacher) => [teacher.key, teacher.attendanceDays]),
    );
    expect(attendance["rohollah-ahmadi"]).toEqual([0, 1, 2]);
    expect(attendance["ali-asadi"]).toEqual([0, 1, 2, 3, 4]);
    expect(attendance["ali-raziei"]).toEqual([0, 1, 2, 3, 4]);
    expect(attendance["mohammadreza-hemmati"]).toEqual([0, 2]);
    expect(attendance["alireza-salimi"]).toEqual([0, 4]);
    expect(attendance["rasoul-janjaneh"]).toEqual([3, 4]);
  });

  it("موظفی و اضافه‌کار نهایی ۲۱ دبیر را دقیقاً به ۳۴۹ ساعت قابل‌زمان‌بندی می‌رساند", () => {
    const profiles = Object.fromEntries(
      shahidBeheshtiTeachers.map((teacher) => [
        teacher.key,
        [teacher.workload, teacher.requiredWorkload, teacher.overtimeAllowance],
      ]),
    );
    expect(profiles).toEqual({
      "amir-chogini": [28, 24, 4],
      "abolfazl-jamshidi": [28, 24, 4],
      "seyed-mohammad-hosseini": [27, 24, 3],
      "esmail-hamzeh": [28, 24, 4],
      "abbas-nazari": [21, 20, 1],
      "ashkan-zand": [18, 18, 0],
      "peyman-karami": [14, 12, 2],
      "mohammadreza-hemmati": [14, 12, 2],
      "alireza-salimi": [14, 12, 2],
      "mohammadreza-salimi": [14, 12, 2],
      "rasoul-janjaneh": [14, 12, 2],
      "rashid-janjaneh": [14, 12, 2],
      "abolfazl-khalili": [20, 18, 2],
      "hamid-vesali": [21, 0, 21],
      "hamid-bagheri": [6, 6, 0],
      "morteza-soltani": [14, 12, 2],
      "rohollah-ahmadi": [21, 6, 15],
      "hossein-farahani": [6, 6, 0],
      "majid-khani": [15, 6, 9],
      "ali-asadi": [6, 6, 0],
      "ali-raziei": [6, 6, 0],
    });
    expect(shahidBeheshtiTeachers.reduce((sum, teacher) => sum + teacher.requiredWorkload, 0)).toBe(272);
    expect(shahidBeheshtiTeachers.reduce((sum, teacher) => sum + teacher.overtimeAllowance, 0)).toBe(77);
    expect(shahidBeheshtiTeachers.reduce((sum, teacher) => sum + teacher.workload, 0)).toBe(349);
  });

  it("با شکستن عربی دوازدهم تجربی و قواعد تربیت بدنی، پیش‌بررسی را بدون خطا می‌گذراند", () => {
    const result = runPreflight(makeCompleteShahidProblem());
    expect(result.summary).toMatchObject({
      classCount: 10,
      teacherCount: 21,
      weeklyHours: 349,
      errorCount: 0,
    });
    expect(result.canGenerate).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === "ERROR")).toEqual([]);
  });

  it("از داده خام و قواعد تأییدشده برنامه معتبر شهید بهشتی می‌سازد", async () => {
    const problem = makeCompleteShahidProblem();
    const result = await solveSchedule(problem, {
      maxCandidates: 1,
      timeBudgetMs: 30_000,
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.candidates).toHaveLength(1);
    expect(validateSchedule(problem, result.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toEqual([]);
  }, 40_000);

  it("توزیع برگه A4 را بدون استفاده از جدول نهایی نگه می‌دارد", () => {
    expect(shahidBeheshtiTeachers.find((teacher) => teacher.key === "morteza-soltani")).toMatchObject({
      firstName: "مرتضی",
      lastName: "سلطانی",
      workload: 14,
      requiredWorkload: 12,
      overtimeAllowance: 2,
    });
    expect(shahidBeheshtiTeachers.some((teacher) => teacher.key === "hashemi")).toBe(false);
    expect(shahidBeheshtiTeachers.find((teacher) => teacher.key === "hamid-vesali")?.workload).toBe(21);
    expect(shahidBeheshtiTeachers.find((teacher) => teacher.key === "mohammadreza-salimi")?.assignments["آمادگی دفاعی"]).toBe(1);
    expect(shahidBeheshtiTeachers.find((teacher) => teacher.key === "alireza-salimi")?.assignments["ریاضی"]).toBe(1);
  });
});

describe("تخصیص قطعی دبیر به کلاس", () => {
  it("پیش‌بررسی، حل‌گر و اعتبارسنج دبیر تعیین‌شده را اعمال می‌کنند", async () => {
    const base = makeProblem();
    const fixed = {
      ...base,
      curriculum: base.curriculum.map((item) => ({ ...item, assignedTeacherId: "t1" })),
      teachers: [
        base.teachers[0],
        { ...base.teachers[0], id: "t2", name: "دبیر دوم" },
      ],
    };
    expect(runPreflight(fixed).canGenerate).toBe(true);
    const result = await solveSchedule(fixed, { maxCandidates: 1, timeBudgetMs: 1_000 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.candidates[0].assignments.every((assignment) => assignment.teacherId === "t1")).toBe(true);
    const invalid = result.candidates[0].assignments.map((assignment, index) => index === 0 ? { ...assignment, teacherId: "t2" } : assignment);
    expect(validateSchedule(fixed, invalid)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CLASS_TEACHER_MISMATCH", severity: "ERROR" })]));
  });
});
