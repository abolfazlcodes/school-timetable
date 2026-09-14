import type {
  CurriculumRequirement,
  ProblemClass,
  ProblemPeriod,
  SchedulingProblem,
  TeacherResource,
} from "../types";

/**
 * A normalized reference slice transcribed from the 1405–1406 Shahid Beheshti
 * documents in docs-assets. It is test data only: the source sheets contain
 * additional staff and handwritten corrections, so this must never be seeded
 * as mandatory production data.
 */
export const referenceTeacherRows = [
  {
    id: "amir-chogini",
    name: "امیر چگینی",
    days: 4,
    assignments: { فارسی: 16, فنون: 8 },
  },
  {
    id: "abolfazl-jamshidi",
    name: "ابوالفضل جمشیدی",
    days: 4,
    assignments: { "زبان خارجه": 24 },
  },
  {
    id: "seyed-mohammad-hosseini",
    name: "سیدمحمد حسینی",
    days: 3,
    assignments: { فیزیک: 7, ریاضیات: 17 },
  },
  {
    id: "esmail-hamzeh",
    name: "اسماعیل حمزه",
    days: 4,
    assignments: { جامعه‌شناسی: 11, "علوم اجتماعی": 4, اقتصاد: 2, تفکر: 1 },
  },
  {
    id: "abbas-nazari",
    name: "عباس نظری",
    days: 3,
    assignments: { زیست: 13, "محیط زیست": 6, جغرافیا: 1, نگارش: 1 },
  },
  {
    id: "ashkan-zand",
    name: "اشکان زند",
    days: 3,
    assignments: { "دین و زندگی": 10, "منطق و فلسفه": 8 },
  },
  {
    id: "peyman-karami",
    name: "پیمان کرمی",
    days: 2,
    assignments: { فیزیک: 12 },
  },
  {
    id: "mohammadreza-hemmati",
    name: "محمدرضا همتی",
    days: 2,
    assignments: { "دین و زندگی": 12 },
  },
  {
    id: "alireza-salimi",
    name: "علیرضا سلیمی",
    days: 2,
    assignments: { ریاضیات: 12 },
  },
  {
    id: "mohammadreza-salimi",
    name: "محمدرضا سلیمی",
    days: 2,
    assignments: { ریاضیات: 7, زمین‌شناسی: 4, دفاعی: 1 },
  },
  {
    id: "rasoul-janjaneh",
    name: "رسول جانجانه",
    days: 2,
    assignments: { تاریخ: 8, "مطالعات فرهنگی": 4 },
  },
] as const;

const dayLabels = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"];

function makePeriods(): ProblemPeriod[] {
  const times = [
    ["08:00", "09:15"],
    ["09:25", "10:45"],
    ["11:00", "12:25"],
    ["12:30", "13:20"],
  ] as const;
  return dayLabels.flatMap((dayLabel, dayOrder) =>
    times.map(([startTime, endTime], index) => ({
      id: `d${dayOrder + 1}-p${index + 1}`,
      dayId: `d${dayOrder + 1}`,
      dayLabel,
      dayOrder,
      position: index + 1,
      label: `زنگ ${index + 1}`,
      startTime,
      endTime,
      isLast: index === times.length - 1,
    })),
  );
}

function makeClasses(): ProblemClass[] {
  return [
    ["10-math", "دهم ریاضی", "g10", "دهم", "math", "ریاضی"],
    ["11-math", "یازدهم ریاضی", "g11", "یازدهم", "math", "ریاضی"],
    ["12-math", "دوازدهم ریاضی", "g12", "دوازدهم", "math", "ریاضی"],
    ["10-science", "دهم تجربی", "g10", "دهم", "science", "تجربی"],
    ["11-science", "یازدهم تجربی", "g11", "یازدهم", "science", "تجربی"],
    ["12-science", "دوازدهم تجربی", "g12", "دوازدهم", "science", "تجربی"],
    ["10-humanities", "دهم انسانی", "g10", "دهم", "humanities", "انسانی"],
    ["11-humanities", "یازدهم انسانی", "g11", "یازدهم", "humanities", "انسانی"],
    [
      "12-humanities-a",
      "دوازدهم انسانی ۱",
      "g12",
      "دوازدهم",
      "humanities",
      "انسانی",
    ],
    [
      "12-humanities-b",
      "دوازدهم انسانی ۲",
      "g12",
      "دوازدهم",
      "humanities",
      "انسانی",
    ],
  ].map(([id, name, gradeId, gradeName, majorId, majorName]) => ({
    id,
    name,
    gradeId,
    gradeName,
    majorId,
    majorName,
  }));
}

function sessionPattern(hours: number) {
  const pattern: number[] = [];
  let remaining = hours;
  while (remaining > 0) {
    const part = Math.min(2, remaining);
    pattern.push(part);
    remaining -= part;
  }
  return pattern;
}

interface NormalizedReferenceTeacher { id: string; name: string; days: number; assignments: Readonly<Record<string, number>> }

function makeCurriculum(classes: ProblemClass[], teacherRows: readonly NormalizedReferenceTeacher[]) {
  const subjectTotals = new Map<string, number>();
  const oddAllocations = new Map<string, number>();
  for (const teacher of teacherRows) {
    for (const [subject, hours] of Object.entries(teacher.assignments)) {
      subjectTotals.set(subject, (subjectTotals.get(subject) ?? 0) + hours);
      if (hours % 2)
        oddAllocations.set(subject, (oddAllocations.get(subject) ?? 0) + 1);
    }
  }
  const curriculum: CurriculumRequirement[] = [];
  let classCursor = 0;
  for (const [subjectName, totalHours] of subjectTotals) {
    let remaining = totalHours;
    let oddChunks = oddAllocations.get(subjectName) ?? 0;
    while (remaining > 0) {
      const hours = oddChunks > 0 && remaining >= 3 ? 3 : Math.min(4, remaining);
      const schoolClass = classes[classCursor % classes.length];
      const subjectId = `subject-${subjectName}`;
      curriculum.push({
        id: `requirement-${curriculum.length + 1}`,
        classId: schoolClass.id,
        className: schoolClass.name,
        subjectId,
        subjectName,
        weeklyHours: hours,
        sessionPattern: sessionPattern(hours),
      });
      classCursor += 1;
      remaining -= hours;
      if (hours === 3 && oddChunks > 0) oddChunks -= 1;
    }
  }
  return curriculum;
}

function buildProblem(teacherRows: readonly NormalizedReferenceTeacher[]): SchedulingProblem {
  const periods = makePeriods();
  const classes = makeClasses();
  const teachers: TeacherResource[] = teacherRows.map((row) => {
    const assignedTotal = Object.values(row.assignments).reduce(
      (sum, hours) => sum + hours,
      0,
    );
    const availableDayIds = new Set(
      Array.from({ length: row.days }, (_, index) => `d${index + 1}`),
    );
    return {
      id: row.id,
      name: row.name,
      profileConfigured: true,
      subjectAssignments: Object.entries(row.assignments).map(
        ([subject, assignedWeeklyHours]) => ({
          subjectId: `subject-${subject}`,
          assignedWeeklyHours,
        }),
      ),
      minimumWorkload: assignedTotal,
      requiredWorkload: assignedTotal,
      maximumWorkload: assignedTotal,
      overtimeAllowance: 0,
      dailyMaximum: 4,
      maxConsecutive: 4,
      availability: Object.fromEntries(
        periods.map((period) => [
          period.id,
          availableDayIds.has(period.dayId) ? "AVAILABLE" : "UNAVAILABLE",
        ]),
      ),
    };
  });
  return {
    schoolId: "shahid-beheshti-reference",
    academicYearId: "1405-1406",
    academicYearTitle: "۱۴۰۵–۱۴۰۶",
    classes,
    periods,
    curriculum: makeCurriculum(classes, teacherRows),
    teachers,
  };
}

export function makeRealSchoolReferenceProblem(): SchedulingProblem {
  return buildProblem(referenceTeacherRows);
}

/** A smaller but relationally faithful projection used to exercise the solver quickly. */
export function makeRealSchoolSolverProjection(): SchedulingProblem {
  return buildProblem(referenceTeacherRows.map((row) => ({ ...row, assignments: Object.fromEntries(Object.entries(row.assignments).map(([subject, hours]) => [subject, Math.min(hours, 2)])) })));
}
