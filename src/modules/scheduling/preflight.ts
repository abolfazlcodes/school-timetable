import { validateSessionPattern } from "@/modules/planning/domain";
import type { SchedulingIssue, SchedulingProblem } from "./types";

export interface PreflightResult { canGenerate: boolean; issues: SchedulingIssue[]; summary: { classCount: number; teacherCount: number; weeklyPeriods: number; sessionCount: number; errorCount: number; warningCount: number } }

export function runPreflight(problem: SchedulingProblem): PreflightResult {
  const issues: SchedulingIssue[] = [];
  const activePeriods = problem.periods.length;
  if (!activePeriods) issues.push({ code: "MISSING_PERIODS", severity: "ERROR", message: "روزها و زنگ‌های مدرسه کامل نشده‌اند.", entityType: "school", fixHref: "/planning?step=structure" });
  if (!problem.classes.length) issues.push({ code: "MISSING_CLASSES", severity: "ERROR", message: "هیچ کلاس فعالی برای سال تحصیلی ثبت نشده است.", entityType: "school", fixHref: "/planning?step=structure" });
  for (const schoolClass of problem.classes) if (!problem.curriculum.some((item) => item.classId === schoolClass.id)) issues.push({ code: "MISSING_CURRICULUM", severity: "ERROR", message: `برنامه درسی کلاس «${schoolClass.name}» کامل نشده است.`, entityType: "class", entityId: schoolClass.id, fixHref: "/planning?step=curriculum" });
  for (const item of problem.curriculum) {
    const patternError = validateSessionPattern(item.weeklyPeriods, item.sessionPattern.length, item.sessionPattern);
    if (patternError) issues.push({ code: "INVALID_SESSION_PATTERN", severity: "ERROR", message: `الگوی جلسات «${item.subjectName}» برای کلاس «${item.className}» معتبر نیست.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=curriculum" });
    const qualified = problem.teachers.filter((teacher) => teacher.subjectIds.includes(item.subjectId));
    if (!qualified.length) issues.push({ code: "MISSING_TEACHER", severity: "ERROR", message: `برای درس «${item.subjectName}» دبیر واجد شرایط تعیین نشده است.`, entityType: "subject", entityId: item.subjectId, fixHref: "/planning?step=teachers" });
  }
  for (const teacher of problem.teachers) {
    if (!teacher.profileConfigured) issues.push({ code: "MISSING_WORKLOAD", severity: "ERROR", message: `موظفی سالانه «${teacher.name}» ثبت نشده است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    const configured = Object.keys(teacher.availability).length;
    if (configured < activePeriods) issues.push({ code: "MISSING_AVAILABILITY", severity: "ERROR", message: `جدول حضور «${teacher.name}» برای همه زنگ‌ها کامل نیست.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
    if (teacher.requiredWorkload > teacher.maximumWorkload + teacher.overtimeAllowance) issues.push({ code: "INVALID_WORKLOAD", severity: "ERROR", message: `موظفی «${teacher.name}» از سقف مجاز بیشتر است.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
  }
  const demandBySubject = new Map<string, { name: string; periods: number }>();
  for (const item of problem.curriculum) { const current = demandBySubject.get(item.subjectId) ?? { name: item.subjectName, periods: 0 }; current.periods += item.weeklyPeriods; demandBySubject.set(item.subjectId, current); }
  for (const [subjectId, demand] of demandBySubject) {
    const capacity = problem.teachers.filter((teacher) => teacher.subjectIds.includes(subjectId)).reduce((sum, teacher) => {
      const available = problem.periods.filter((period) => ["AVAILABLE", "PREFERRED"].includes(teacher.availability[period.id])).length;
      return sum + Math.min(teacher.maximumWorkload + teacher.overtimeAllowance, available);
    }, 0);
    if (capacity < demand.periods) issues.push({ code: "INSUFFICIENT_CAPACITY", severity: "ERROR", message: `درس «${demand.name}» به ${demand.periods.toLocaleString("fa-IR")} ساعت نیاز دارد، اما ظرفیت دبیران ${capacity.toLocaleString("fa-IR")} ساعت است.`, entityType: "subject", entityId: subjectId, fixHref: "/planning?step=teachers" });
  }
  const totalDemand = problem.curriculum.reduce((sum, item) => sum + item.weeklyPeriods, 0);
  const totalNormalCapacity = problem.teachers.reduce((sum, teacher) => sum + teacher.maximumWorkload, 0);
  if (totalNormalCapacity >= totalDemand && !issues.some((issue) => issue.severity === "ERROR")) issues.push({ code: "CAPACITY_OK", severity: "INFO", message: "ظرفیت ثبت‌شده دبیران برای ساعات آموزشی کافی است." });
  const warnings = problem.teachers.filter((teacher) => teacher.minimumWorkload > problem.curriculum.filter((item) => teacher.subjectIds.includes(item.subjectId)).reduce((sum, item) => sum + item.weeklyPeriods, 0));
  for (const teacher of warnings) issues.push({ code: "LOW_POTENTIAL_WORKLOAD", severity: "WARNING", message: `ساعات قابل تخصیص به «${teacher.name}» ممکن است از حداقل موظفی کمتر باشد.`, entityType: "teacher", entityId: teacher.id, fixHref: `/planning?step=teachers&teacher=${teacher.id}` });
  const errorCount = issues.filter((issue) => issue.severity === "ERROR").length;
  return { canGenerate: errorCount === 0, issues, summary: { classCount: problem.classes.length, teacherCount: problem.teachers.length, weeklyPeriods: totalDemand, sessionCount: problem.curriculum.reduce((sum, item) => sum + item.sessionPattern.length, 0), errorCount, warningCount: issues.filter((issue) => issue.severity === "WARNING").length } };
}
