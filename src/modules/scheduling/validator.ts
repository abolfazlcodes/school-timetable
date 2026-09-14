import type { ScheduleAssignment, SchedulingIssue, SchedulingProblem } from "./types";
import { assignedHoursFor, expandSessions } from "./types";

function longestRun(positions: number[]) {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = -99;
  for (const position of sorted) {
    current = position === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = position;
  }
  return longest;
}

function gapCount(positions: number[]) {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  return sorted.length < 2 ? 0 : Math.max(0, sorted.at(-1)! - sorted[0] + 1 - sorted.length);
}

export function validationIssueKey(issue: SchedulingIssue) {
  return `${issue.severity}:${issue.code}:${issue.entityType ?? ""}:${issue.entityId ?? ""}:${issue.message}`;
}

export function validateSchedule(problem: SchedulingProblem, assignments: ScheduleAssignment[]): SchedulingIssue[] {
  const issues: SchedulingIssue[] = [];
  const sessions = new Map(expandSessions(problem).map((session) => [session.id, session]));
  const teachers = new Map(problem.teachers.map((teacher) => [teacher.id, teacher]));
  const periods = new Map(problem.periods.map((period) => [period.id, period]));
  const seenSessions = new Set<string>();
  const classSlots = new Map<string, string>();
  const teacherSlots = new Map<string, string>();
  const teacherLoads = new Map<string, number>();
  const teacherSubjectLoads = new Map<string, number>();
  const teacherDayPositions = new Map<string, number[]>();
  const classDayPositions = new Map<string, number[]>();
  const curriculumDays = new Map<string, { dayId: string; sessionId: string }[]>();

  for (const assignment of assignments) {
    const session = sessions.get(assignment.sessionId);
    const teacher = teachers.get(assignment.teacherId);
    if (!session) {
      issues.push({ code: "UNKNOWN_SESSION", severity: "ERROR", message: "یک جلسه ناشناخته در برنامه وجود دارد.", entityType: "session", entityId: assignment.sessionId });
      continue;
    }
    if (seenSessions.has(session.id)) {
      issues.push({ code: "DUPLICATE_SESSION", severity: "ERROR", message: `جلسه «${session.subjectName}» برای «${session.className}» بیش از یک‌بار قرار گرفته است.`, entityType: "session", entityId: session.id });
    }
    seenSessions.add(session.id);
    if (!teacher || assignedHoursFor(teacher, session.subjectId) <= 0) {
      issues.push({ code: "INVALID_TEACHER", severity: "ERROR", message: `دبیر انتخاب‌شده برای درس «${session.subjectName}» مجاز نیست.`, entityType: "session", entityId: session.id });
      continue;
    }
    if (assignment.classId !== session.classId || assignment.subjectId !== session.subjectId || assignment.curriculumId !== session.curriculumId) {
      issues.push({ code: "SESSION_REFERENCE_MISMATCH", severity: "ERROR", message: `اطلاعات جلسه «${session.subjectName}» با نیاز درسی کلاس مطابقت ندارد.`, entityType: "session", entityId: session.id });
    }
    if (assignment.periodIds.length !== 1) {
      issues.push({ code: "INVALID_SESSION_SLOT_COUNT", severity: "ERROR", message: `هر جلسه «${session.subjectName}» باید در یک زنگ مدرسه قرار گیرد.`, entityType: "session", entityId: session.id });
    }
    const selectedPeriods = assignment.periodIds.map((id) => periods.get(id));
    const invalidSequence = selectedPeriods.some((period) => !period)
      || selectedPeriods.some((period) => period?.dayId !== assignment.dayId)
      || selectedPeriods.some((period, index) => index > 0 && period!.position !== selectedPeriods[index - 1]!.position + 1)
      || selectedPeriods[0]?.position !== assignment.startPosition;
    if (invalidSequence) {
      issues.push({ code: "INVALID_PERIOD_SEQUENCE", severity: "ERROR", message: `زنگ‌های جلسه «${session.subjectName}» پیوسته و معتبر نیستند.`, entityType: "session", entityId: session.id });
    }

    for (const periodId of assignment.periodIds) {
      const period = periods.get(periodId);
      if (!["AVAILABLE", "PREFERRED"].includes(teacher.availability[periodId])) {
        issues.push({ code: "OUTSIDE_AVAILABILITY", severity: "ERROR", message: `«${teacher.name}» در زمان انتخاب‌شده حضور ندارد.`, entityType: "session", entityId: session.id });
      }
      const classKey = `${session.classId}:${periodId}`;
      const teacherKey = `${teacher.id}:${periodId}`;
      const conflictingClassSession = classSlots.get(classKey);
      const conflictingTeacherSession = teacherSlots.get(teacherKey);
      if (conflictingClassSession && conflictingClassSession !== session.id) {
        issues.push({ code: "CLASS_CONFLICT", severity: "ERROR", message: `کلاس «${session.className}» در این زمان درس دیگری دارد.`, entityType: "session", entityId: session.id });
      }
      if (conflictingTeacherSession && conflictingTeacherSession !== session.id) {
        issues.push({ code: "TEACHER_CONFLICT", severity: "ERROR", message: `«${teacher.name}» در این زمان برای کلاس دیگری برنامه دارد.`, entityType: "session", entityId: session.id });
      }
      classSlots.set(classKey, session.id);
      teacherSlots.set(teacherKey, session.id);
      if (period?.isLast) {
        issues.push({ code: "LAST_PERIOD", severity: "WARNING", message: `جلسه «${session.subjectName}» در زنگ پایانی ${period.dayLabel} قرار می‌گیرد.`, entityType: "session", entityId: session.id });
      }
    }

    teacherLoads.set(teacher.id, (teacherLoads.get(teacher.id) ?? 0) + session.workloadHours);
    const teacherSubjectKey = `${teacher.id}:${session.subjectId}`;
    teacherSubjectLoads.set(teacherSubjectKey, (teacherSubjectLoads.get(teacherSubjectKey) ?? 0) + session.workloadHours);
    const teacherDayKey = `${teacher.id}:${assignment.dayId}`;
    const classDayKey = `${session.classId}:${assignment.dayId}`;
    const validPositions = selectedPeriods.filter(Boolean).map((period) => period!.position);
    teacherDayPositions.set(teacherDayKey, [...(teacherDayPositions.get(teacherDayKey) ?? []), ...validPositions]);
    classDayPositions.set(classDayKey, [...(classDayPositions.get(classDayKey) ?? []), ...validPositions]);
    curriculumDays.set(session.curriculumId, [...(curriculumDays.get(session.curriculumId) ?? []), { dayId: assignment.dayId, sessionId: session.id }]);
  }

  for (const session of sessions.values()) {
    if (!seenSessions.has(session.id)) {
      issues.push({ code: "MISSING_SESSION", severity: "ERROR", message: `جلسه «${session.subjectName}» برای «${session.className}» هنوز در جدول قرار نگرفته است.`, entityType: "session", entityId: session.id });
    }
  }

  for (const teacher of problem.teachers) {
    const load = teacherLoads.get(teacher.id) ?? 0;
    if (load > teacher.maximumWorkload + teacher.overtimeAllowance) {
      issues.push({ code: "WORKLOAD_EXCEEDED", severity: "ERROR", message: `سقف ساعت مجاز «${teacher.name}» رعایت نشده است.`, entityType: "teacher", entityId: teacher.id });
    } else if (load > teacher.maximumWorkload) {
      issues.push({ code: "OVERTIME", severity: "WARNING", message: `این برنامه برای «${teacher.name}» ${(load - teacher.maximumWorkload).toLocaleString("fa-IR")} ساعت اضافه‌کاری ایجاد می‌کند.`, entityType: "teacher", entityId: teacher.id });
    }
    for (const assignment of teacher.subjectAssignments) {
      const subjectLoad = teacherSubjectLoads.get(`${teacher.id}:${assignment.subjectId}`) ?? 0;
      if (subjectLoad > assignment.assignedWeeklyHours) issues.push({ code: "SUBJECT_ASSIGNMENT_EXCEEDED", severity: "ERROR", message: `سقف تخصیص سالانه درس برای «${teacher.name}» رعایت نشده است.`, entityType: "teacher", entityId: teacher.id });
    }
    for (const [key, positions] of teacherDayPositions) {
      if (!key.startsWith(`${teacher.id}:`)) continue;
      if (positions.length > teacher.dailyMaximum) {
        issues.push({ code: "DAILY_LIMIT_EXCEEDED", severity: "ERROR", message: `حداکثر تدریس روزانه «${teacher.name}» رعایت نشده است.`, entityType: "teacher", entityId: teacher.id });
      }
      if (longestRun(positions) > teacher.maxConsecutive) {
        issues.push({ code: "CONSECUTIVE_LIMIT_EXCEEDED", severity: "ERROR", message: `حداکثر زنگ متوالی «${teacher.name}» رعایت نشده است.`, entityType: "teacher", entityId: teacher.id });
      }
      if (gapCount(positions) > 0) {
        issues.push({ code: "TEACHER_GAP", severity: "WARNING", message: `در برنامه روزانه «${teacher.name}» فاصله خالی ایجاد شده است.`, entityType: "teacher", entityId: teacher.id });
      }
    }
  }

  for (const [key, positions] of classDayPositions) {
    if (gapCount(positions) > 0) {
      const classId = key.split(":")[0];
      const className = problem.classes.find((item) => item.id === classId)?.name ?? "کلاس";
      issues.push({ code: "CLASS_GAP", severity: "WARNING", message: `در برنامه روزانه «${className}» فاصله خالی ایجاد شده است.`, entityType: "class", entityId: classId });
    }
  }

  for (const placements of curriculumDays.values()) {
    const dayCounts = new Map<string, number>();
    for (const placement of placements) dayCounts.set(placement.dayId, (dayCounts.get(placement.dayId) ?? 0) + 1);
    if ([...dayCounts.values()].some((count) => count > 1)) {
      for (const placement of placements) {
        if ((dayCounts.get(placement.dayId) ?? 0) > 1) {
          issues.push({ code: "SUBJECT_SAME_DAY", severity: "WARNING", message: "دو جلسه از یک درس در یک روز قرار گرفته‌اند.", entityType: "session", entityId: placement.sessionId });
        }
      }
    }
  }

  if (!issues.some((issue) => issue.severity === "ERROR")) {
    issues.push({ code: "SCHEDULE_VALID", severity: "INFO", message: "همه جلسات لازم زمان‌بندی شده‌اند و تداخل سختی وجود ندارد.", entityType: "school", entityId: problem.schoolId });
  }
  return [...new Map(issues.map((issue) => [validationIssueKey(issue), issue])).values()];
}
