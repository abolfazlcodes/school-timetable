import { createHash } from "node:crypto";
import type { TenantContext } from "@/modules/tenancy/types";
import { requireRole } from "@/modules/tenancy/types";
import { runPreflight, type PreflightResult } from "./preflight";
import type { SchedulingRepository } from "./repository";
import { ENGINE_VERSION, solveSchedule } from "./solver";
import type { SchedulingIssue, SchedulingProblem } from "./types";

export interface SchedulingInspection { problem: SchedulingProblem | null; preflight: PreflightResult }

export async function inspectSchedulingData(context: TenantContext, repository: SchedulingRepository): Promise<SchedulingInspection> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const problem = await repository.loadProblem(context);
  if (!problem) {
    const issue: SchedulingIssue = { code: "MISSING_ACADEMIC_YEAR", severity: "ERROR", message: "سال تحصیلی فعال تعیین نشده است.", entityType: "school", fixHref: "/planning?step=structure" };
    return { problem: null, preflight: { canGenerate: false, issues: [issue], summary: { classCount: 0, teacherCount: 0, weeklyHours: 0, sessionCount: 0, errorCount: 1, warningCount: 0 } } };
  }
  return { problem, preflight: runPreflight(problem) };
}

export function fingerprintProblem(problem: SchedulingProblem) { return createHash("sha256").update(JSON.stringify({ engineVersion: ENGINE_VERSION, problem })).digest("hex"); }

export async function generateTimetable(context: TenantContext, repository: SchedulingRepository) {
  const inspection = await inspectSchedulingData(context, repository);
  if (!inspection.problem || !inspection.preflight.canGenerate) return { ok: false as const, issues: inspection.preflight.issues };
  const result = solveSchedule(inspection.problem, { maxCandidates: 3, nodeBudget: 150_000, timeBudgetMs: 3_000 });
  const runId = await repository.saveRun(context, { problem: inspection.problem, fingerprint: fingerprintProblem(inspection.problem), engineVersion: ENGINE_VERSION, result, summary: inspection.preflight.summary });
  return { ok: true as const, runId, result };
}
