import { z } from "zod";
import type { SchedulingRepository } from "@/modules/scheduling/repository";
import type { ScheduleAssignment, SchedulingIssue, SchedulingProblem } from "@/modules/scheduling/types";
import { expandSessions } from "@/modules/scheduling/types";
import { validateSchedule } from "@/modules/scheduling/validator";
import type { TenantContext } from "@/modules/tenancy/types";
import { requireRole } from "@/modules/tenancy/types";
import type { ScheduleVersionRepository, VersionStatus } from "@/modules/schedule-versions/repository";
import { evaluateChange, placeSession, removeSession, swapSessions, TimetableEditError } from "./editor";
import type { CandidateSource, StoredScheduleWorkspace, TimetableRepository } from "./repository";

const id = z.string().uuid("شناسه ارسال‌شده معتبر نیست.");
const editSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("PLACE"),
    workspaceId: id,
    revision: z.number().int().nonnegative(),
    sessionId: z.string().min(1),
    teacherId: id,
    dayId: id,
    startPosition: z.number().int().positive(),
    weekPattern: z.enum(["EVERY_WEEK", "WEEK_A", "WEEK_B"]).optional(),
    confirmWarnings: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("SWAP"),
    workspaceId: id,
    revision: z.number().int().nonnegative(),
    sessionId: z.string().min(1),
    targetSessionId: z.string().min(1),
    confirmWarnings: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("REMOVE"),
    workspaceId: id,
    revision: z.number().int().nonnegative(),
    sessionId: z.string().min(1),
    confirmInvalid: z.boolean().default(false),
  }),
]);

export type TimetableEditInput = z.input<typeof editSchema>;

export interface TimetableViewData {
  mode: "workspace" | "candidate" | "version";
  workspaceId: string | null;
  revision: number;
  source: Pick<CandidateSource, "candidateId" | "runId" | "rank" | "score">;
  academicYearTitle: string;
  generatedAt: string;
  updatedAt: string;
  problem: SchedulingProblem;
  assignments: ScheduleAssignment[];
  issues: SchedulingIssue[];
  version: { id: string; versionNumber: number; status: VersionStatus; createdAt: string; publishedAt: string | null } | null;
  versions: Array<{ id: string; versionNumber: number; status: VersionStatus; createdAt: string; publishedAt: string | null }>;
}

export type TimetableEditResult =
  | { status: "success"; message: string; revision: number; assignments: ScheduleAssignment[]; issues: SchedulingIssue[]; updatedAt: string }
  | { status: "error"; message: string; issues?: SchedulingIssue[] }
  | { status: "confirm-warning"; message: string; issues: SchedulingIssue[] }
  | { status: "confirm-invalid"; message: string; issues: SchedulingIssue[] };

function sourceFromWorkspace(workspace: StoredScheduleWorkspace) {
  return {
    candidateId: workspace.sourceCandidateId,
    runId: workspace.scheduleRunId,
    rank: workspace.sourceRank,
    score: workspace.sourceScore,
  };
}

export async function getTimetableView(
  context: TenantContext,
  schedulingRepository: SchedulingRepository,
  repository: TimetableRepository,
  versionRepository: ScheduleVersionRepository,
  query: { workspaceId?: string; runId?: string; rank?: number; versionId?: string } = {},
): Promise<TimetableViewData | null> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  if (query.versionId) {
    const version = await versionRepository.get(context, query.versionId);
    if (!version) return null;
    const problem = await schedulingRepository.loadProblem(context, version.academicYearId);
    if (!problem) return null;
    const versions = await versionRepository.list(context, version.academicYearId);
    return {
      mode: "version",
      workspaceId: null,
      revision: 0,
      source: { candidateId: version.sourceCandidateId, runId: version.scheduleRunId, rank: version.sourceRank, score: version.score },
      academicYearTitle: problem.academicYearTitle,
      generatedAt: version.createdAt.toISOString(),
      updatedAt: (version.publishedAt ?? version.createdAt).toISOString(),
      problem,
      assignments: version.assignments,
      issues: validateSchedule(problem, version.assignments),
      version: { ...version, createdAt: version.createdAt.toISOString(), publishedAt: version.publishedAt?.toISOString() ?? null },
      versions: versions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), publishedAt: item.publishedAt?.toISOString() ?? null })),
    };
  }
  const workspace = query.workspaceId || !query.runId ? await repository.getWorkspace(context, query.workspaceId) : null;
  if (query.workspaceId && !workspace) return null;
  if (workspace) {
    const problem = await schedulingRepository.loadProblem(context, workspace.academicYearId);
    if (!problem) return null;
    const versions = await versionRepository.list(context, workspace.academicYearId);
    return {
      mode: "workspace",
      workspaceId: workspace.id,
      revision: workspace.revision,
      source: sourceFromWorkspace(workspace),
      academicYearTitle: problem.academicYearTitle,
      generatedAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
      problem,
      assignments: workspace.assignments,
      issues: validateSchedule(problem, workspace.assignments),
      version: null,
      versions: versions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), publishedAt: item.publishedAt?.toISOString() ?? null })),
    };
  }
  const candidate = await repository.getCandidate(context, query.runId, query.rank);
  if (!candidate) return null;
  const problem = await schedulingRepository.loadProblem(context, candidate.academicYearId);
  if (!problem) return null;
  const versions = await versionRepository.list(context, candidate.academicYearId);
  return {
    mode: "candidate",
    workspaceId: null,
    revision: 0,
    source: candidate,
    academicYearTitle: problem.academicYearTitle,
    generatedAt: candidate.generatedAt.toISOString(),
    updatedAt: candidate.generatedAt.toISOString(),
    problem,
    assignments: candidate.assignments,
    issues: validateSchedule(problem, candidate.assignments),
    version: null,
    versions: versions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), publishedAt: item.publishedAt?.toISOString() ?? null })),
  };
}

export async function createEditableWorkspace(
  context: TenantContext,
  schedulingRepository: SchedulingRepository,
  repository: TimetableRepository,
  input: { runId: unknown; rank: unknown },
) {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = z.object({ runId: id, rank: z.coerce.number().int().positive() }).safeParse(input);
  if (!parsed.success) throw new TimetableEditError("گزینه برنامه انتخاب‌شده معتبر نیست.");
  const candidate = await repository.getCandidate(context, parsed.data.runId, parsed.data.rank);
  if (!candidate) throw new TimetableEditError("گزینه برنامه در مدرسه فعال پیدا نشد.");
  const problem = await schedulingRepository.loadProblem(context, candidate.academicYearId);
  if (!problem) throw new TimetableEditError("اطلاعات سال تحصیلی این برنامه در دسترس نیست.");
  const issues = validateSchedule(problem, candidate.assignments);
  if (issues.some((issue) => issue.severity === "ERROR")) throw new TimetableEditError("این گزینه دیگر با اطلاعات فعلی مدرسه معتبر نیست؛ برنامه تازه‌ای تولید کنید.");
  return repository.createWorkspace(context, candidate, issues);
}

export async function editTimetable(
  context: TenantContext,
  schedulingRepository: SchedulingRepository,
  repository: TimetableRepository,
  input: unknown,
): Promise<TimetableEditResult> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "اطلاعات تغییر معتبر نیست." };
  const command = parsed.data;
  const workspace = await repository.getWorkspace(context, command.workspaceId);
  if (!workspace) return { status: "error", message: "نسخهٔ کاری در مدرسه فعال پیدا نشد." };
  if (workspace.revision !== command.revision) return { status: "error", message: "برنامه هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی و دوباره تلاش کنید." };
  const problem = await schedulingRepository.loadProblem(context, workspace.academicYearId);
  if (!problem) return { status: "error", message: "اطلاعات سال تحصیلی این برنامه در دسترس نیست." };

  try {
    let nextAssignments: ScheduleAssignment[];
    if (command.kind === "PLACE") {
      nextAssignments = placeSession(problem, workspace.assignments, command);
    } else if (command.kind === "SWAP") {
      nextAssignments = swapSessions(problem, workspace.assignments, command.sessionId, command.targetSessionId);
    } else {
      nextAssignments = removeSession(workspace.assignments, command.sessionId);
    }
    const evaluation = evaluateChange(problem, workspace.assignments, nextAssignments);

    if (evaluation.introducedErrors.length) {
      const removableOnly = command.kind === "REMOVE"
        && evaluation.introducedErrors.every((issue) => issue.code === "MISSING_SESSION" && issue.entityId === command.sessionId);
      if (!removableOnly) {
        return { status: "error", message: evaluation.introducedErrors[0].message, issues: evaluation.introducedErrors };
      }
      if (!command.confirmInvalid) {
        return {
          status: "confirm-invalid",
          message: "با برداشتن این جلسه، برنامه تا جایگذاری دوباره نامعتبر می‌شود. برای ادامه، تأیید صریح لازم است.",
          issues: evaluation.introducedErrors,
        };
      }
    }

    if (command.kind !== "REMOVE" && evaluation.introducedWarnings.length && !command.confirmWarnings) {
      return {
        status: "confirm-warning",
        message: "تغییر مجاز است، اما هشدار تازه‌ای ایجاد می‌کند. در صورت پذیرش، تغییر را تأیید کنید.",
        issues: evaluation.introducedWarnings,
      };
    }

    const updated = await repository.updateWorkspace(
      context,
      workspace.id,
      workspace.revision,
      evaluation.assignments,
      evaluation.issues,
    );
    if (!updated) return { status: "error", message: "برنامه هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی و دوباره تلاش کنید." };
    const removed = command.kind === "REMOVE";
    return {
      status: "success",
      message: removed ? "جلسه از جدول برداشته شد؛ برای معتبر شدن برنامه آن را دوباره جایگذاری کنید." : "تغییر ذخیره و برنامه دوباره اعتبارسنجی شد.",
      revision: updated.revision,
      assignments: evaluation.assignments,
      issues: evaluation.issues,
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof TimetableEditError) return { status: "error", message: error.message };
    return { status: "error", message: "اعمال تغییر انجام نشد. دوباره تلاش کنید." };
  }
}

export function listUnscheduledSessions(problem: SchedulingProblem, assignments: ScheduleAssignment[]) {
  const scheduled = new Set(assignments.map((assignment) => assignment.sessionId));
  return expandSessions(problem).filter((session) => !scheduled.has(session.id));
}
