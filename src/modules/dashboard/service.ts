import type { ScheduleVersionRepository } from "@/modules/schedule-versions/repository";
import type { SchedulingRepository } from "@/modules/scheduling/repository";
import { inspectSchedulingData } from "@/modules/scheduling/service";
import { validateSchedule } from "@/modules/scheduling/validator";
import type { SchedulingIssue } from "@/modules/scheduling/types";
import type { TenantContext } from "@/modules/tenancy/types";
import type { TimetableRepository } from "@/modules/timetable/repository";

export interface DashboardData {
  academicYearTitle: string | null;
  classCount: number;
  teacherCount: number;
  weeklyHours: number;
  issueCount: number;
  issues: SchedulingIssue[];
  progress: number;
  planningRows: Array<{ label: string; complete: boolean }>;
  statusLabel: string;
  statusTone: "warning" | "success" | "danger";
  continueHref: string;
  latestVersion: { id: string; number: number; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; date: string } | null;
}

export async function getDashboardData(context: TenantContext, schedulingRepository: SchedulingRepository, timetableRepository: TimetableRepository, versionRepository: ScheduleVersionRepository): Promise<DashboardData> {
  const inspection = await inspectSchedulingData(context, schedulingRepository);
  const problem = inspection.problem;
  const workspace = problem ? await timetableRepository.getWorkspace(context) : null;
  const versions = problem ? await versionRepository.list(context, problem.academicYearId) : [];
  const latestVersion = versions[0] ?? null;
  const currentIssues = workspace && problem ? validateSchedule(problem, workspace.assignments) : inspection.preflight.issues;
  const issues = currentIssues.filter((issue) => issue.severity !== "INFO");
  const structureComplete = Boolean(problem?.classes.length && problem.periods.length);
  const curriculumComplete = Boolean(problem?.curriculum.length) && !inspection.preflight.issues.some((issue) => ["MISSING_CURRICULUM", "INVALID_SESSION_PATTERN"].includes(issue.code));
  const teachersComplete = Boolean(problem?.teachers.length) && !inspection.preflight.issues.some((issue) => ["MISSING_TEACHER", "MISSING_WORKLOAD", "MISSING_AVAILABILITY", "INVALID_WORKLOAD", "INSUFFICIENT_CAPACITY"].includes(issue.code));
  const completed = [structureComplete, curriculumComplete, teachersComplete].filter(Boolean).length;
  const published = versions.find((version) => version.status === "PUBLISHED");
  const workspaceNeedsPublication = Boolean(workspace && (!published || workspace.updatedAt.getTime() > published.createdAt.getTime()));
  let statusLabel = "در حال تنظیم";
  let statusTone: DashboardData["statusTone"] = "warning";
  let continueHref = "/planning?step=structure";
  if (!structureComplete) continueHref = "/planning?step=structure";
  else if (!curriculumComplete) continueHref = "/planning?step=curriculum";
  else if (!teachersComplete) continueHref = "/planning?step=teachers";
  else if (!inspection.preflight.canGenerate) { statusLabel = "نیازمند اصلاح"; statusTone = "danger"; continueHref = "/planning?step=review"; }
  else if (!workspace) { statusLabel = "آماده تولید"; continueHref = "/planning?step=generate"; }
  else if (issues.some((issue) => issue.severity === "ERROR")) { statusLabel = "نیازمند اصلاح"; statusTone = "danger"; continueHref = `/planning?step=edit&workspace=${workspace.id}`; }
  else if (workspaceNeedsPublication) { statusLabel = "آماده انتشار"; statusTone = "success"; continueHref = `/planning?step=publish&workspace=${workspace!.id}`; }
  else { statusLabel = "منتشرشده"; statusTone = "success"; continueHref = `/timetable?version=${published!.id}`; }
  return {
    academicYearTitle: problem?.academicYearTitle ?? null,
    classCount: inspection.preflight.summary.classCount,
    teacherCount: inspection.preflight.summary.teacherCount,
    weeklyHours: inspection.preflight.summary.weeklyHours,
    issueCount: issues.length,
    issues: issues.slice(0, 5),
    progress: Math.round((completed / 3) * 100),
    planningRows: [
      { label: "ساختار مدرسه و کلاس‌ها", complete: structureComplete },
      { label: "دروس و ساعات هفتگی", complete: curriculumComplete },
      { label: "دبیران و حضور", complete: teachersComplete },
    ],
    statusLabel,
    statusTone,
    continueHref,
    latestVersion: latestVersion ? { id: latestVersion.id, number: latestVersion.versionNumber, status: latestVersion.status, date: (latestVersion.publishedAt ?? latestVersion.createdAt).toISOString() } : null,
  };
}
