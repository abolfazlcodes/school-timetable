import { and, desc, eq, max, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { scheduleCandidates, scheduleVersions, scheduleWorkspaces } from "@/db/schema";
import type { ScheduleAssignment, SchedulingIssue } from "@/modules/scheduling/types";
import type { TenantContext } from "@/modules/tenancy/types";
import type { StoredScheduleWorkspace } from "@/modules/timetable/repository";

export type VersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ScheduleVersionSummary {
  id: string;
  academicYearId: string;
  versionNumber: number;
  status: VersionStatus;
  score: number;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface StoredScheduleVersion extends ScheduleVersionSummary {
  scheduleRunId: string;
  sourceCandidateId: string;
  sourceWorkspaceId: string;
  sourceRank: number;
  assignments: ScheduleAssignment[];
  validationIssues: SchedulingIssue[];
}

export interface ScheduleVersionRepository {
  list(context: TenantContext, academicYearId?: string): Promise<ScheduleVersionSummary[]>;
  get(context: TenantContext, versionId: string): Promise<StoredScheduleVersion | null>;
  createSnapshot(context: TenantContext, workspace: StoredScheduleWorkspace, issues: SchedulingIssue[], status: "DRAFT" | "PUBLISHED"): Promise<StoredScheduleVersion>;
  archive(context: TenantContext, versionId: string): Promise<boolean>;
  fork(context: TenantContext, version: StoredScheduleVersion, issues: SchedulingIssue[]): Promise<string>;
}

export function createScheduleVersionRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): ScheduleVersionRepository {
  return {
    async list(context, academicYearId) {
      const conditions = [eq(scheduleVersions.schoolId, context.schoolId)];
      if (academicYearId) conditions.push(eq(scheduleVersions.academicYearId, academicYearId));
      return db.select({
        id: scheduleVersions.id,
        academicYearId: scheduleVersions.academicYearId,
        versionNumber: scheduleVersions.versionNumber,
        status: scheduleVersions.status,
        score: scheduleVersions.score,
        createdAt: scheduleVersions.createdAt,
        publishedAt: scheduleVersions.publishedAt,
      }).from(scheduleVersions).where(and(...conditions)).orderBy(desc(scheduleVersions.createdAt)).limit(30);
    },

    async get(context, versionId) {
      const [row] = await db.select({
        id: scheduleVersions.id,
        academicYearId: scheduleVersions.academicYearId,
        versionNumber: scheduleVersions.versionNumber,
        status: scheduleVersions.status,
        score: scheduleVersions.score,
        createdAt: scheduleVersions.createdAt,
        publishedAt: scheduleVersions.publishedAt,
        scheduleRunId: scheduleVersions.scheduleRunId,
        sourceCandidateId: scheduleVersions.sourceCandidateId,
        sourceWorkspaceId: scheduleVersions.sourceWorkspaceId,
        sourceRank: scheduleCandidates.rank,
        assignments: scheduleVersions.assignments,
        validationIssues: scheduleVersions.validationIssues,
      }).from(scheduleVersions)
        .innerJoin(scheduleCandidates, and(
          eq(scheduleCandidates.id, scheduleVersions.sourceCandidateId),
          eq(scheduleCandidates.scheduleRunId, scheduleVersions.scheduleRunId),
          eq(scheduleCandidates.schoolId, scheduleVersions.schoolId),
        ))
        .where(and(eq(scheduleVersions.id, versionId), eq(scheduleVersions.schoolId, context.schoolId)))
        .limit(1);
      return row ? {
        ...row,
        assignments: row.assignments as ScheduleAssignment[],
        validationIssues: row.validationIssues as SchedulingIssue[],
      } : null;
    },

    async createSnapshot(context, workspace, issues, status) {
      const versionId = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM academic_years WHERE id = ${workspace.academicYearId} AND school_id = ${context.schoolId} FOR UPDATE`);
        const [numberRow] = await tx.select({ value: max(scheduleVersions.versionNumber) })
          .from(scheduleVersions)
          .where(and(eq(scheduleVersions.schoolId, context.schoolId), eq(scheduleVersions.academicYearId, workspace.academicYearId)));
        const versionNumber = (numberRow?.value ?? 0) + 1;
        const now = new Date();
        if (status === "PUBLISHED") {
          await tx.update(scheduleVersions).set({ status: "ARCHIVED" }).where(and(
            eq(scheduleVersions.schoolId, context.schoolId),
            eq(scheduleVersions.academicYearId, workspace.academicYearId),
            eq(scheduleVersions.status, "PUBLISHED"),
          ));
        }
        const [created] = await tx.insert(scheduleVersions).values({
          schoolId: context.schoolId,
          academicYearId: workspace.academicYearId,
          scheduleRunId: workspace.scheduleRunId,
          sourceCandidateId: workspace.sourceCandidateId,
          sourceWorkspaceId: workspace.id,
          createdByUserId: context.userId,
          publishedByUserId: status === "PUBLISHED" ? context.userId : null,
          versionNumber,
          status,
          score: workspace.sourceScore,
          assignments: workspace.assignments,
          validationIssues: issues,
          publishedAt: status === "PUBLISHED" ? now : null,
        }).returning({ id: scheduleVersions.id });
        return created.id;
      });
      const created = await this.get(context, versionId);
      if (!created) throw new Error("VERSION_CREATION_FAILED");
      return created;
    },

    async archive(context, versionId) {
      const [updated] = await db.update(scheduleVersions).set({ status: "ARCHIVED" }).where(and(
        eq(scheduleVersions.id, versionId),
        eq(scheduleVersions.schoolId, context.schoolId),
      )).returning({ id: scheduleVersions.id });
      return Boolean(updated);
    },

    async fork(context, version, issues) {
      const [workspace] = await db.insert(scheduleWorkspaces).values({
        schoolId: context.schoolId,
        academicYearId: version.academicYearId,
        scheduleRunId: version.scheduleRunId,
        sourceCandidateId: version.sourceCandidateId,
        sourceVersionId: version.id,
        createdByUserId: context.userId,
        assignments: version.assignments,
        validationIssues: issues,
      }).returning({ id: scheduleWorkspaces.id });
      return workspace.id;
    },
  };
}
