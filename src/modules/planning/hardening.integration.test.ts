// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { academicYears, classGroups, classPlans, grades, periods, scheduleCandidates, scheduleRuns, scheduleVersions, scheduleWorkspaces, schoolBreaks, schoolDays, schoolDaySchedules, schoolMemberships, schools, users } from "@/db/schema";

const migrationNames = ["0000_auth_and_schools.sql", "0001_planning_inputs.sql", "0002_planning_invariants.sql", "0003_schedule_runs.sql", "0004_schedule_workspaces.sql", "0005_schedule_versions.sql", "0006_hardening_invariants.sql", "0007_period_overlap_upsert.sql", "0008_school_day_timeline.sql", "0009_real_school_calibration.sql"];
const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  outsider: "10000000-0000-4000-8000-000000000002",
  school: "20000000-0000-4000-8000-000000000001",
  year: "30000000-0000-4000-8000-000000000001",
  grade: "31000000-0000-4000-8000-000000000001",
  otherGrade: "31000000-0000-4000-8000-000000000002",
  plan: "33000000-0000-4000-8000-000000000001",
  day: "36000000-0000-4000-8000-000000000001",
};

describe("قیود سخت‌سازی پایگاه‌داده", () => {
  it("همپوشانی زمان، scope ناسازگار، actor غیرعضو و snapshot منتشرشده نامعتبر را رد می‌کند", async () => {
    const client = new PGlite();
    try {
      for (const migrationName of migrationNames) await client.exec(await readFile(new URL(`../../../migrations/${migrationName}`, import.meta.url), "utf8"));
      const db = drizzle(client, { schema });
      await db.insert(users).values([{ id: ids.user, email: "admin@example.com", fullName: "مدیر", passwordHash: "hash" }, { id: ids.outsider, email: "outside@example.com", fullName: "بیرون", passwordHash: "hash" }]);
      await db.insert(schools).values({ id: ids.school, name: "مدرسه آزمون" });
      await db.insert(schoolMemberships).values({ userId: ids.user, schoolId: ids.school, role: "ADMIN" });
      await db.insert(academicYears).values({ id: ids.year, schoolId: ids.school, title: "۱۴۰۵–۱۴۰۶", startYear: 1405, endYear: 1406, isActive: true });
      await db.insert(grades).values([{ id: ids.grade, schoolId: ids.school, name: "پایه دهم", code: "10" }, { id: ids.otherGrade, schoolId: ids.school, name: "پایه یازدهم", code: "11" }]);
      await db.insert(classPlans).values({ id: ids.plan, schoolId: ids.school, academicYearId: ids.year, gradeId: ids.grade, majorId: null, studentCount: 20, maxClassCapacity: 25 });
      await expect(db.insert(classGroups).values({ schoolId: ids.school, academicYearId: ids.year, classPlanId: ids.plan, gradeId: ids.otherGrade, majorId: null, name: "کلاس ناسازگار", studentCount: 20, maxCapacity: 25 })).rejects.toThrow();

      await db.insert(schoolDays).values({ id: ids.day, schoolId: ids.school, academicYearId: ids.year, dayOfWeek: 0, label: "شنبه", sortOrder: 0 });
      await db.insert(periods).values({ schoolId: ids.school, academicYearId: ids.year, schoolDayId: ids.day, position: 1, label: "زنگ ۱", startTime: "07:30", endTime: "08:15", breakAfterMinutes: 5 });
      await expect(db.insert(periods).values({ schoolId: ids.school, academicYearId: ids.year, schoolDayId: ids.day, position: 2, label: "زنگ ۲", startTime: "08:00", endTime: "08:45", breakAfterMinutes: 5 })).rejects.toThrow();

      await expect(db.insert(scheduleRuns).values({ schoolId: ids.school, academicYearId: ids.year, createdByUserId: ids.outsider, status: "NO_SOLUTION", inputFingerprint: "a".repeat(64), engineVersion: "test", generationTimeMs: 1, exploredNodes: 1, issues: [], summary: {} })).rejects.toThrow();
      await expect(db.insert(scheduleRuns).values({ schoolId: ids.school, academicYearId: ids.year, createdByUserId: ids.user, status: "NO_SOLUTION", inputFingerprint: "b".repeat(64), engineVersion: "test", generationTimeMs: 1, exploredNodes: 1, issues: {} as unknown as unknown[], summary: {} })).rejects.toThrow();

      const [run] = await db.insert(scheduleRuns).values({ schoolId: ids.school, academicYearId: ids.year, createdByUserId: ids.user, status: "SUCCEEDED", inputFingerprint: "c".repeat(64), engineVersion: "test", generationTimeMs: 1, exploredNodes: 1, issues: [], summary: {} }).returning({ id: scheduleRuns.id });
      const [candidate] = await db.insert(scheduleCandidates).values({ schoolId: ids.school, scheduleRunId: run.id, rank: 1, score: 9900, penalty: 1, penaltyBreakdown: {}, assignments: [] }).returning({ id: scheduleCandidates.id });
      const [workspace] = await db.insert(scheduleWorkspaces).values({ schoolId: ids.school, academicYearId: ids.year, scheduleRunId: run.id, sourceCandidateId: candidate.id, createdByUserId: ids.user, assignments: [], validationIssues: [] }).returning({ id: scheduleWorkspaces.id });
      await expect(db.insert(scheduleVersions).values({ schoolId: ids.school, academicYearId: ids.year, scheduleRunId: run.id, sourceCandidateId: candidate.id, sourceWorkspaceId: workspace.id, createdByUserId: ids.user, publishedByUserId: ids.user, versionNumber: 1, status: "PUBLISHED", score: 9900, assignments: [], validationIssues: [{ severity: "ERROR", code: "MISSING_SESSION" }], publishedAt: new Date() })).rejects.toThrow();
      await expect(db.insert(scheduleVersions).values({ schoolId: ids.school, academicYearId: ids.year, scheduleRunId: run.id, sourceCandidateId: candidate.id, sourceWorkspaceId: workspace.id, createdByUserId: ids.user, versionNumber: 1, status: "DRAFT", score: 10001, assignments: [], validationIssues: [] })).rejects.toThrow();
    } finally { await client.close(); }
  }, 20_000);

  it("timeline ناقص یا دارای شکاف را در سطح پایگاه‌داده رد می‌کند", async () => {
    const client = new PGlite();
    try {
      for (const migrationName of migrationNames) await client.exec(await readFile(new URL(`../../../migrations/${migrationName}`, import.meta.url), "utf8"));
      const db = drizzle(client, { schema });
      await db.insert(users).values({ id: ids.user, email: "timeline@example.com", fullName: "مدیر", passwordHash: "hash" });
      await db.insert(schools).values({ id: ids.school, name: "مدرسه آزمون" });
      await db.insert(schoolMemberships).values({ userId: ids.user, schoolId: ids.school, role: "ADMIN" });
      await db.insert(academicYears).values({ id: ids.year, schoolId: ids.school, title: "۱۴۰۵–۱۴۰۶", startYear: 1405, endYear: 1406, isActive: true });
      await db.insert(schoolDays).values({ id: ids.day, schoolId: ids.school, academicYearId: ids.year, dayOfWeek: 0, label: "شنبه", sortOrder: 0 });
      await db.transaction(async (tx) => {
        await tx.insert(schoolDaySchedules).values({ schoolId: ids.school, academicYearId: ids.year, schoolDayId: ids.day, mode: "MANUAL", startTime: "08:00", endTime: "10:00", periodCount: 2, defaultBreakMinutes: 10 });
        await tx.insert(periods).values([
          { schoolId: ids.school, academicYearId: ids.year, schoolDayId: ids.day, position: 1, label: "زنگ ۱", startTime: "08:00", endTime: "08:50", breakAfterMinutes: 10 },
          { schoolId: ids.school, academicYearId: ids.year, schoolDayId: ids.day, position: 2, label: "زنگ ۲", startTime: "09:00", endTime: "10:00", breakAfterMinutes: 0 },
        ]);
        await tx.insert(schoolBreaks).values({ schoolId: ids.school, academicYearId: ids.year, schoolDayId: ids.day, afterPeriodPosition: 1, kind: "BREAK", startTime: "08:50", endTime: "09:00" });
      });
      await expect(db.update(schoolBreaks).set({ endTime: "09:05" }).where(eq(schoolBreaks.schoolDayId, ids.day))).rejects.toThrow();
      await expect(db.update(schoolDaySchedules).set({ endTime: "09:55" }).where(eq(schoolDaySchedules.schoolDayId, ids.day))).rejects.toThrow();
    } finally { await client.close(); }
  }, 20_000);
});
