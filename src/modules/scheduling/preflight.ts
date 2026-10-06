import { validateSessionPattern } from "@/modules/planning/domain";
import { assignedHoursFor, compatibleWeekPatterns, expandSessions } from "./types";
import type { SchedulingIssue, SchedulingProblem } from "./types";

export interface PreflightResult { canGenerate: boolean; issues: SchedulingIssue[]; summary: { classCount: number; teacherCount: number; weeklyHours: number; sessionCount: number; errorCount: number; warningCount: number } }

function maximumCompatibleSubjectHours(
  problem: SchedulingProblem,
  teacherId: string,
  subjectId: string,
) {
  const teacher = problem.teachers.find((item) => item.id === teacherId);
  if (!teacher) return 0;
  const workloads = expandSessions(problem)
    .filter((session) => session.subjectId === subjectId)
    .map((session) => session.workloadHours);
  const availablePeriods = problem.periods.filter((period) =>
    ["AVAILABLE", "PREFERRED"].includes(teacher.availability[period.id]),
  );
  if (workloads.every((hours) => hours === 1 || hours === 2) && availablePeriods.every((period) => period.instructionalUnits === 1 || period.instructionalUnits === 2)) {
    const oneHourSessions = workloads.filter((hours) => hours === 1).length;
    const twoHourSessions = workloads.filter((hours) => hours === 2).length;
    const oneUnitPeriods = availablePeriods.filter((period) => period.instructionalUnits === 1).length;
    const twoUnitPeriods = availablePeriods.filter((period) => period.instructionalUnits === 2).length;
    const placedTwoHourSessions = Math.min(twoHourSessions, twoUnitPeriods);
    const remainingTwoUnitPeriods = twoUnitPeriods - placedTwoHourSessions;
    const placedOneHourSessions = Math.min(
      oneHourSessions,
      oneUnitPeriods + remainingTwoUnitPeriods * 2,
    );
    return placedTwoHourSessions * 2 + placedOneHourSessions;
  }
  return Math.min(
    workloads.reduce((sum, hours) => sum + hours, 0),
    availablePeriods.reduce(
      (sum, period) =>
        workloads.some((hours) => compatibleWeekPatterns(hours, period.instructionalUnits).length)
          ? sum + period.instructionalUnits
          : sum,
      0,
    ),
  );
}

export function runPreflight(problem: SchedulingProblem): PreflightResult {
  const issues: SchedulingIssue[] = [];
  const activePeriods = problem.periods.length;
  if (!activePeriods) issues.push({ code: "MISSING_PERIODS", severity: "ERROR", message: "روزها و زنگ‌های مدرسه کامل نشده‌اند.", entityType: "school", fixHref: "/planning?step=structure" });
  if (!problem.classes.length) issues.push({ code: "MISSING_CLASSES", severity: "ERROR", message: "هیچ کلاس فعالی برای سال تحصیلی ثبت نشده است.", entityType: "school", fixHref: "/planning?step=structure" });
  for (const schoolClass of problem.classes) if (!problem.curriculum.some((item) => item.classId === schoolClass.id)) issues.push({ code: "MISSING_CURRICULUM", severity: "ERROR", message: `برنامه درسی کلاس «${schoolClass.name}» کامل نشده است.`, entityType: "class", entityId: schoolClass.id, fixHref: "/planning?step=curriculum" });
  for (const item of problem.curriculum) {
    const patternError = validateSessionPattern(item.weeklyHours, item.sessionPattern.length, item.sessionPattern);
    if (patternError) issues.push({ code: "INVALID_SESSION_PATTERN", severity: "ERROR", message: `الگوی جلسات «${item.subjectName}» برای کلاس «${item.className}» معتبر نیست.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=curriculum" });
    const qualified = problem.teachers.filter((teacher) => assignedHoursFor(teacher, item.subjectId) > 0 && (!item.assignedTeacherId || teacher.id === item.assignedTeacherId));
    if (!qualified.length) issues.push({ code: "MISSING_TEACHER", severity: "ERROR", message: `برای درس «${item.subjectName}» دبیر واجد شرایط تعیین نشده است.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=teachers" });
    else if (item.sessionPattern.some((workloadHours) => !qualified.some((teacher) => problem.periods.some((period) => ["AVAILABLE", "PREFERRED"].includes(teacher.availability[period.id]) && compatibleWeekPatterns(workloadHours, period.instructionalUnits).length)))) {
      issues.push({ code: "INCOMPATIBLE_SESSION_DURATION", severity: "ERROR", message: `برای یکی از جلسه‌های «${item.subjectName}» کلاس «${item.className}» زنگی با ظرفیت آموزشی سازگار و دبیر حاضر وجود ندارد.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=structure" });
    }
  }
  const demandBySubject = new Map<string, { name: string; hours: number }>();
  for (const item of problem.curriculum) {
    const current = demandBySubject.get(item.subjectId) ?? { name: item.subjectName, hours: 0 };
    current.hours += item.weeklyHours;
    demandBySubject.set(item.subjectId, current);
  }
  const exactSubjects = new Set(
    [...demandBySubject]
      .filter(([subjectId, demand]) =>
        problem.teachers.reduce((sum, teacher) => sum + assignedHoursFor(teacher, subjectId), 0) === demand.hours,
      )
      .map(([subjectId]) => subjectId),
  );
  for (const teacher of problem.teachers) {
    if (!teacher.profileConfigured) issues.push({ code: "MISSING_WORKLOAD", severity: "ERROR", message: `موظفی سالانه «${teacher.name}» ثبت نشده است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    const configured = Object.keys(teacher.availability).length;
    if (configured < activePeriods) issues.push({ code: "MISSING_AVAILABILITY", severity: "ERROR", message: `جدول حضور «${teacher.name}» برای همه زنگ‌ها کامل نیست.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    if (teacher.requiredWorkload > teacher.maximumWorkload + teacher.overtimeAllowance) issues.push({ code: "INVALID_WORKLOAD", severity: "ERROR", message: `موظفی «${teacher.name}» از سقف مجاز بیشتر است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    const assignedTotal = teacher.subjectAssignments.reduce((sum, item) => sum + item.assignedWeeklyHours, 0);
    if (assignedTotal > teacher.maximumWorkload + teacher.overtimeAllowance) issues.push({ code: "ASSIGNED_WORKLOAD_EXCEEDED", severity: "ERROR", message: `جمع تخصیص درس‌های «${teacher.name}» از سقف ساعت مجاز بیشتر است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    else if (teacher.profileConfigured && assignedTotal < teacher.requiredWorkload) issues.push({ code: "ASSIGNED_WORKLOAD_SHORTAGE", severity: "WARNING", message: `جمع تخصیص درس‌های «${teacher.name}» ${assignedTotal.toLocaleString("fa-IR")} ساعت است و ${Math.abs(teacher.requiredWorkload - assignedTotal).toLocaleString("fa-IR")} ساعت از موظفی ${teacher.requiredWorkload.toLocaleString("fa-IR")} ساعته کمتر است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    else if (teacher.profileConfigured && assignedTotal > teacher.requiredWorkload) issues.push({ code: "OVERTIME_ASSIGNED", severity: "INFO", message: `«${teacher.name}» ${teacher.requiredWorkload.toLocaleString("fa-IR")} ساعت موظفی و ${Math.abs(assignedTotal - teacher.requiredWorkload).toLocaleString("fa-IR")} ساعت اضافه‌کار دارد.`, entityType: "teacher", entityId: teacher.id });
    const availableInstructionalHours = problem.periods.reduce((sum, period) => ["AVAILABLE", "PREFERRED"].includes(teacher.availability[period.id]) ? sum + period.instructionalUnits : sum, 0);
    if (assignedTotal > availableInstructionalHours) {
      issues.push({
        code: "INSUFFICIENT_TEACHER_SLOTS",
        severity: "ERROR",
        message: `«${teacher.name}» ${assignedTotal.toLocaleString("fa-IR")} ساعت آموزشی تخصیص دارد، اما حضور ثبت‌شده فقط ${availableInstructionalHours.toLocaleString("fa-IR")} ساعت آموزشی ظرفیت دارد؛ ${Math.abs(assignedTotal - availableInstructionalHours).toLocaleString("fa-IR")} ساعت کمبود وجود دارد.`,
        entityType: "teacher",
        entityId: teacher.id,
        fixHref: `/planning?step=teachers&teacher=${teacher.id}`,
      });
    }
    for (const subject of teacher.subjectAssignments) {
      if (!exactSubjects.has(subject.subjectId)) continue;
      const maximumCompatibleHours = maximumCompatibleSubjectHours(
        problem,
        teacher.id,
        subject.subjectId,
      );
      if (subject.assignedWeeklyHours <= maximumCompatibleHours) continue;
      const subjectName = demandBySubject.get(subject.subjectId)?.name ?? "درس";
      issues.push({
        code: "INCOMPATIBLE_TEACHER_PATTERN_CAPACITY",
        severity: "ERROR",
        message: `«${teacher.name}» برای درس «${subjectName}» ${subject.assignedWeeklyHours.toLocaleString("fa-IR")} ساعت تخصیص دارد، اما با الگوی جلسه‌های ثبت‌شده و روزهای حضور حداکثر ${maximumCompatibleHours.toLocaleString("fa-IR")} ساعت آن قابل جای‌گذاری است؛ حضور دبیر یا الگوی مجاز همین درس را بررسی کنید.`,
        entityType: "teacher",
        entityId: teacher.id,
        fixHref: `/planning?step=teachers&teacher=${teacher.id}`,
      });
    }
  }
  for (const [subjectId, demand] of demandBySubject) {
    const capacity = problem.teachers.reduce((sum, teacher) => sum + assignedHoursFor(teacher, subjectId), 0);
    if (capacity < demand.hours) issues.push({ code: "INSUFFICIENT_CAPACITY", severity: "ERROR", message: `درس «${demand.name}» به ${demand.hours.toLocaleString("fa-IR")} ساعت نیاز دارد، اما فقط ${capacity.toLocaleString("fa-IR")} ساعت به دبیران تخصیص یافته است؛ ${Math.abs(capacity - demand.hours).toLocaleString("fa-IR")} ساعت کمبود وجود دارد.`, entityType: "subject", entityId: subjectId, fixHref: "/planning?step=teachers" });
    if (capacity > demand.hours) issues.push({ code: "SURPLUS_SUBJECT_CAPACITY", severity: "WARNING", message: `برای درس «${demand.name}» ${capacity.toLocaleString("fa-IR")} ساعت تخصیص ثبت شده، در حالی که نیاز کلاس‌ها ${demand.hours.toLocaleString("fa-IR")} ساعت است؛ ${Math.abs(capacity - demand.hours).toLocaleString("fa-IR")} ساعت مازاد است.`, entityType: "subject", entityId: subjectId, fixHref: "/planning?step=teachers" });
  }
  const totalDemand = problem.curriculum.reduce((sum, item) => sum + item.weeklyHours, 0);
  const totalAssigned = problem.teachers.reduce((sum, teacher) => sum + teacher.subjectAssignments.reduce((inner, item) => inner + item.assignedWeeklyHours, 0), 0);
  if (totalAssigned >= totalDemand && !issues.some((issue) => issue.severity === "ERROR")) issues.push({ code: "CAPACITY_OK", severity: "INFO", message: `نیاز ${totalDemand.toLocaleString("fa-IR")} ساعته کلاس‌ها با تخصیص سالانه دبیران پوشش داده شده است.` });
  const warnings = problem.teachers.filter((teacher) => teacher.minimumWorkload > teacher.subjectAssignments.reduce((sum, item) => sum + item.assignedWeeklyHours, 0));
  for (const teacher of warnings) issues.push({ code: "LOW_POTENTIAL_WORKLOAD", severity: "WARNING", message: `ساعات قابل تخصیص به «${teacher.name}» ممکن است از حداقل موظفی کمتر باشد.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
  const errorCount = issues.filter((issue) => issue.severity === "ERROR").length;
  return { canGenerate: errorCount === 0, issues, summary: { classCount: problem.classes.length, teacherCount: problem.teachers.length, weeklyHours: totalDemand, sessionCount: problem.curriculum.reduce((sum, item) => sum + item.sessionPattern.length, 0), errorCount, warningCount: issues.filter((issue) => issue.severity === "WARNING").length } };
}
