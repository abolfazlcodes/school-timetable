import { validateSessionPattern } from "@/modules/planning/domain";
import { assignedHoursFor } from "./types";
import type { SchedulingIssue, SchedulingProblem } from "./types";

export interface PreflightResult { canGenerate: boolean; issues: SchedulingIssue[]; summary: { classCount: number; teacherCount: number; weeklyHours: number; sessionCount: number; errorCount: number; warningCount: number } }

export function runPreflight(problem: SchedulingProblem): PreflightResult {
  const issues: SchedulingIssue[] = [];
  const activePeriods = problem.periods.length;
  if (!activePeriods) issues.push({ code: "MISSING_PERIODS", severity: "ERROR", message: "روزها و زنگ‌های مدرسه کامل نشده‌اند.", entityType: "school", fixHref: "/planning?step=structure" });
  if (!problem.classes.length) issues.push({ code: "MISSING_CLASSES", severity: "ERROR", message: "هیچ کلاس فعالی برای سال تحصیلی ثبت نشده است.", entityType: "school", fixHref: "/planning?step=structure" });
  for (const schoolClass of problem.classes) if (!problem.curriculum.some((item) => item.classId === schoolClass.id)) issues.push({ code: "MISSING_CURRICULUM", severity: "ERROR", message: `برنامه درسی کلاس «${schoolClass.name}» کامل نشده است.`, entityType: "class", entityId: schoolClass.id, fixHref: "/planning?step=curriculum" });
  for (const item of problem.curriculum) {
    const patternError = validateSessionPattern(item.weeklyHours, item.sessionPattern.length, item.sessionPattern);
    if (patternError) issues.push({ code: "INVALID_SESSION_PATTERN", severity: "ERROR", message: `الگوی جلسات «${item.subjectName}» برای کلاس «${item.className}» معتبر نیست.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=curriculum" });
    const qualified = problem.teachers.filter((teacher) => assignedHoursFor(teacher, item.subjectId) > 0);
    if (!qualified.length) issues.push({ code: "MISSING_TEACHER", severity: "ERROR", message: `برای درس «${item.subjectName}» دبیر واجد شرایط تعیین نشده است.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=teachers" });
  }
  for (const teacher of problem.teachers) {
    if (!teacher.profileConfigured) issues.push({ code: "MISSING_WORKLOAD", severity: "ERROR", message: `موظفی سالانه «${teacher.name}» ثبت نشده است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    const configured = Object.keys(teacher.availability).length;
    if (configured < activePeriods) issues.push({ code: "MISSING_AVAILABILITY", severity: "ERROR", message: `جدول حضور «${teacher.name}» برای همه زنگ‌ها کامل نیست.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    if (teacher.requiredWorkload > teacher.maximumWorkload + teacher.overtimeAllowance) issues.push({ code: "INVALID_WORKLOAD", severity: "ERROR", message: `موظفی «${teacher.name}» از سقف مجاز بیشتر است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    const assignedTotal = teacher.subjectAssignments.reduce((sum, item) => sum + item.assignedWeeklyHours, 0);
    if (assignedTotal > teacher.maximumWorkload + teacher.overtimeAllowance) issues.push({ code: "ASSIGNED_WORKLOAD_EXCEEDED", severity: "ERROR", message: `جمع تخصیص درس‌های «${teacher.name}» از سقف ساعت مجاز بیشتر است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    else if (teacher.profileConfigured && assignedTotal !== teacher.requiredWorkload) issues.push({ code: "ASSIGNED_WORKLOAD_MISMATCH", severity: "WARNING", message: `جمع تخصیص درس‌های «${teacher.name}» ${assignedTotal.toLocaleString("fa-IR")} ساعت است و با موظفی ${teacher.requiredWorkload.toLocaleString("fa-IR")} ساعت برابر نیست.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
  }
  const demandBySubject = new Map<string, { name: string; hours: number }>();
  for (const item of problem.curriculum) { const current = demandBySubject.get(item.subjectId) ?? { name: item.subjectName, hours: 0 }; current.hours += item.weeklyHours; demandBySubject.set(item.subjectId, current); }
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
