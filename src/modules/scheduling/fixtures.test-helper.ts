import type { SchedulingProblem } from "./types";

export function makeProblem(overrides: Partial<SchedulingProblem> = {}): SchedulingProblem {
  const periods = [
    { id: "sa-1", dayId: "sat", dayLabel: "شنبه", dayOrder: 0, position: 1, label: "زنگ ۱", startTime: "07:30", endTime: "08:15", isLast: false },
    { id: "sa-2", dayId: "sat", dayLabel: "شنبه", dayOrder: 0, position: 2, label: "زنگ ۲", startTime: "08:20", endTime: "09:05", isLast: false },
    { id: "sa-3", dayId: "sat", dayLabel: "شنبه", dayOrder: 0, position: 3, label: "زنگ ۳", startTime: "09:10", endTime: "09:55", isLast: true },
    { id: "su-1", dayId: "sun", dayLabel: "یکشنبه", dayOrder: 1, position: 1, label: "زنگ ۱", startTime: "07:30", endTime: "08:15", isLast: false },
    { id: "su-2", dayId: "sun", dayLabel: "یکشنبه", dayOrder: 1, position: 2, label: "زنگ ۲", startTime: "08:20", endTime: "09:05", isLast: false },
    { id: "su-3", dayId: "sun", dayLabel: "یکشنبه", dayOrder: 1, position: 3, label: "زنگ ۳", startTime: "09:10", endTime: "09:55", isLast: true },
  ];
  const availability = Object.fromEntries(periods.map((period) => [period.id, period.position === 1 ? "PREFERRED" : "AVAILABLE"]));
  return {
    schoolId: "school", academicYearId: "year", academicYearTitle: "۱۴۰۵",
    classes: [{ id: "c1", name: "دهم ۱", gradeId: "g", gradeName: "دهم", majorId: null, majorName: null }, { id: "c2", name: "دهم ۲", gradeId: "g", gradeName: "دهم", majorId: null, majorName: null }],
    periods,
    curriculum: [
      { id: "r1", classId: "c1", className: "دهم ۱", subjectId: "math", subjectName: "ریاضی", weeklyHours: 2, sessionPattern: [1, 1] },
      { id: "r2", classId: "c2", className: "دهم ۲", subjectId: "math", subjectName: "ریاضی", weeklyHours: 2, sessionPattern: [1, 1] },
    ],
    teachers: [{ id: "t1", name: "دبیر ریاضی", profileConfigured: true, subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 4 }], minimumWorkload: 0, requiredWorkload: 4, maximumWorkload: 6, overtimeAllowance: 0, dailyMaximum: 3, maxConsecutive: 2, availability: availability as SchedulingProblem["teachers"][number]["availability"] }],
    ...overrides,
  };
}
