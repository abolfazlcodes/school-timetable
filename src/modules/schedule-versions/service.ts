import { z } from "zod";
import type { SchedulingRepository } from "@/modules/scheduling/repository";
import { validateSchedule } from "@/modules/scheduling/validator";
import type { TenantContext } from "@/modules/tenancy/types";
import { requireRole } from "@/modules/tenancy/types";
import type { TimetableRepository } from "@/modules/timetable/repository";
import type { ScheduleVersionRepository, ScheduleVersionSummary } from "./repository";

const idSchema = z.string().uuid("شناسه ارسال‌شده معتبر نیست.");

export type VersionMutationResult =
  | { status: "success"; message: string; version?: ScheduleVersionSummary; workspaceId?: string }
  | { status: "confirm-warning"; message: string }
  | { status: "error"; message: string };

export async function snapshotWorkspace(
  context: TenantContext,
  schedulingRepository: SchedulingRepository,
  timetableRepository: TimetableRepository,
  versionRepository: ScheduleVersionRepository,
  input: { workspaceId: unknown; publish: boolean; confirmWarnings?: boolean },
): Promise<VersionMutationResult> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = idSchema.safeParse(input.workspaceId);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "شناسه نسخهٔ کاری معتبر نیست." };
  const workspace = await timetableRepository.getWorkspace(context, parsed.data);
  if (!workspace) return { status: "error", message: "نسخهٔ کاری در مدرسه فعال پیدا نشد." };
  const problem = await schedulingRepository.loadProblem(context, workspace.academicYearId);
  if (!problem) return { status: "error", message: "اطلاعات سال تحصیلی برنامه در دسترس نیست." };
  const issues = validateSchedule(problem, workspace.assignments);
  const errors = issues.filter((issue) => issue.severity === "ERROR");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  if (input.publish && errors.length) return { status: "error", message: `انتشار ممکن نیست؛ ${errors[0].message}` };
  if (input.publish && warnings.length && !input.confirmWarnings) {
    return { status: "confirm-warning", message: `برنامه معتبر است، اما ${warnings.length.toLocaleString("fa-IR")} هشدار دارد. برای انتشار، هشدارها را آگاهانه تأیید کنید.` };
  }
  const version = await versionRepository.createSnapshot(context, workspace, issues, input.publish ? "PUBLISHED" : "DRAFT");
  return {
    status: "success",
    message: input.publish ? `نسخه ${version.versionNumber.toLocaleString("fa-IR")} منتشر شد.` : `نسخه پیش‌نویس ${version.versionNumber.toLocaleString("fa-IR")} ذخیره شد.`,
    version,
  };
}

export async function forkScheduleVersion(
  context: TenantContext,
  schedulingRepository: SchedulingRepository,
  versionRepository: ScheduleVersionRepository,
  versionId: unknown,
): Promise<VersionMutationResult> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = idSchema.safeParse(versionId);
  if (!parsed.success) return { status: "error", message: "نسخه انتخاب‌شده معتبر نیست." };
  const version = await versionRepository.get(context, parsed.data);
  if (!version) return { status: "error", message: "نسخه در مدرسه فعال پیدا نشد." };
  const problem = await schedulingRepository.loadProblem(context, version.academicYearId);
  if (!problem) return { status: "error", message: "اطلاعات سال تحصیلی این نسخه در دسترس نیست." };
  const issues = validateSchedule(problem, version.assignments);
  const workspaceId = await versionRepository.fork(context, version, issues);
  return { status: "success", message: "یک نسخهٔ کاری مستقل ساخته شد؛ نسخهٔ قبلی بدون تغییر باقی ماند.", workspaceId };
}

export async function archiveScheduleVersion(
  context: TenantContext,
  versionRepository: ScheduleVersionRepository,
  versionId: unknown,
): Promise<VersionMutationResult> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = idSchema.safeParse(versionId);
  if (!parsed.success) return { status: "error", message: "نسخه انتخاب‌شده معتبر نیست." };
  const archived = await versionRepository.archive(context, parsed.data);
  return archived ? { status: "success", message: "نسخه بایگانی شد." } : { status: "error", message: "نسخه در مدرسه فعال پیدا نشد." };
}
