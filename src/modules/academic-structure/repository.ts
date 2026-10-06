import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { academicYears, classGroups, classPlans, grades, majors, periods, schoolBreaks, schoolDays, schoolDaySchedules } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";
import type { SchoolDayTimeline } from "./school-day-timeline";

export interface AcademicYearView { id: string; title: string; startYear: number; endYear: number; isActive: boolean }
export interface GradeView { id: string; name: string; code: string; sortOrder: number; isActive: boolean }
export interface MajorView { id: string; name: string; code: string | null; isActive: boolean }
export interface ClassGroupView { id: string; name: string; studentCount: number; maxCapacity: number; isActive: boolean }
export interface ClassPlanView {
  id: string;
  academicYearId: string;
  gradeId: string;
  gradeName: string;
  majorId: string | null;
  majorName: string | null;
  studentCount: number;
  maxClassCapacity: number;
  classCountOverride: number | null;
  classes: ClassGroupView[];
}
export interface PeriodView { id: string; position: number; label: string; startTime: string; endTime: string; instructionalUnits: number; breakAfterMinutes: number; isActive: boolean }
export interface SchoolDayView { id: string; dayOfWeek: number; label: string; sortOrder: number; isActive: boolean; periods: PeriodView[]; schedule: SchoolDayTimeline | null }
export interface StructureWorkspaceData {
  academicYears: AcademicYearView[];
  activeAcademicYear: AcademicYearView | null;
  grades: GradeView[];
  majors: MajorView[];
  classPlans: ClassPlanView[];
  schoolDays: SchoolDayView[];
}

export interface NewClassGroup { name: string; studentCount: number; maxCapacity: number }
export interface ClassScope { yearTitle: string; gradeName: string; majorName: string | null }

export interface AcademicStructureRepository {
  getWorkspace(context: TenantContext): Promise<StructureWorkspaceData>;
  createAcademicYear(context: TenantContext, input: { title: string; startYear: number; endYear: number; makeActive: boolean }): Promise<void>;
  setActiveAcademicYear(context: TenantContext, academicYearId: string): Promise<boolean>;
  createGrade(context: TenantContext, input: { name: string; code: string; sortOrder: number }): Promise<void>;
  createMajor(context: TenantContext, input: { name: string; code: string | null }): Promise<void>;
  updateGradeStatus(context: TenantContext, gradeId: string, isActive: boolean): Promise<boolean>;
  updateMajorStatus(context: TenantContext, majorId: string, isActive: boolean): Promise<boolean>;
  resolveClassScope(context: TenantContext, input: { academicYearId: string; gradeId: string; majorId: string | null }): Promise<ClassScope | null>;
  saveClassPlan(context: TenantContext, input: { academicYearId: string; gradeId: string; majorId: string | null; studentCount: number; maxClassCapacity: number; classCountOverride: number | null; groups: NewClassGroup[] }): Promise<void>;
  updateClassGroup(context: TenantContext, input: { classGroupId: string; name: string; isActive: boolean }): Promise<boolean>;
  addSchoolDay(context: TenantContext, input: { academicYearId: string; dayOfWeek: number; label: string; sortOrder: number }): Promise<void>;
  updateSchoolDayStatus(context: TenantContext, schoolDayId: string, isActive: boolean): Promise<boolean>;
  saveDaySchedule(context: TenantContext, academicYearId: string, schoolDayId: string, timeline: SchoolDayTimeline): Promise<boolean>;
}

export function createAcademicStructureRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): AcademicStructureRepository {
  return {
    async getWorkspace(context) {
      const [yearRows, gradeRows, majorRows] = await Promise.all([
        db.select({ id: academicYears.id, title: academicYears.title, startYear: academicYears.startYear, endYear: academicYears.endYear, isActive: academicYears.isActive })
          .from(academicYears).where(eq(academicYears.schoolId, context.schoolId)).orderBy(desc(academicYears.startYear)),
        db.select({ id: grades.id, name: grades.name, code: grades.code, sortOrder: grades.sortOrder, isActive: grades.isActive })
          .from(grades).where(eq(grades.schoolId, context.schoolId)).orderBy(asc(grades.sortOrder), asc(grades.name)),
        db.select({ id: majors.id, name: majors.name, code: majors.code, isActive: majors.isActive })
          .from(majors).where(eq(majors.schoolId, context.schoolId)).orderBy(asc(majors.name)),
      ]);
      const activeAcademicYear = yearRows.find((year) => year.isActive) ?? null;
      if (!activeAcademicYear) return { academicYears: yearRows, activeAcademicYear: null, grades: gradeRows, majors: majorRows, classPlans: [], schoolDays: [] };

      const [planRows, classRows, dayRows, periodRows, scheduleRows, breakRows] = await Promise.all([
        db.select({ id: classPlans.id, academicYearId: classPlans.academicYearId, gradeId: classPlans.gradeId, gradeName: grades.name, majorId: classPlans.majorId, majorName: majors.name, studentCount: classPlans.studentCount, maxClassCapacity: classPlans.maxClassCapacity, classCountOverride: classPlans.classCountOverride })
          .from(classPlans).innerJoin(grades, and(eq(grades.id, classPlans.gradeId), eq(grades.schoolId, context.schoolId)))
          .leftJoin(majors, and(eq(majors.id, classPlans.majorId), eq(majors.schoolId, context.schoolId)))
          .where(and(eq(classPlans.schoolId, context.schoolId), eq(classPlans.academicYearId, activeAcademicYear.id)))
          .orderBy(asc(grades.sortOrder), asc(majors.name)),
        db.select({ id: classGroups.id, classPlanId: classGroups.classPlanId, name: classGroups.name, studentCount: classGroups.studentCount, maxCapacity: classGroups.maxCapacity, isActive: classGroups.isActive })
          .from(classGroups).where(and(eq(classGroups.schoolId, context.schoolId), eq(classGroups.academicYearId, activeAcademicYear.id))).orderBy(asc(classGroups.name)),
        db.select({ id: schoolDays.id, dayOfWeek: schoolDays.dayOfWeek, label: schoolDays.label, sortOrder: schoolDays.sortOrder, isActive: schoolDays.isActive })
          .from(schoolDays).where(and(eq(schoolDays.schoolId, context.schoolId), eq(schoolDays.academicYearId, activeAcademicYear.id))).orderBy(asc(schoolDays.sortOrder)),
        db.select({ id: periods.id, schoolDayId: periods.schoolDayId, position: periods.position, label: periods.label, startTime: periods.startTime, endTime: periods.endTime, instructionalUnits: periods.instructionalUnits, breakAfterMinutes: periods.breakAfterMinutes, isActive: periods.isActive })
          .from(periods).where(and(eq(periods.schoolId, context.schoolId), eq(periods.academicYearId, activeAcademicYear.id))).orderBy(asc(periods.position)),
        db.select({ schoolDayId: schoolDaySchedules.schoolDayId, mode: schoolDaySchedules.mode, startTime: schoolDaySchedules.startTime, endTime: schoolDaySchedules.endTime, periodCount: schoolDaySchedules.periodCount, defaultBreakMinutes: schoolDaySchedules.defaultBreakMinutes })
          .from(schoolDaySchedules).where(and(eq(schoolDaySchedules.schoolId, context.schoolId), eq(schoolDaySchedules.academicYearId, activeAcademicYear.id))),
        db.select({ schoolDayId: schoolBreaks.schoolDayId, afterPeriodPosition: schoolBreaks.afterPeriodPosition, kind: schoolBreaks.kind, startTime: schoolBreaks.startTime, endTime: schoolBreaks.endTime })
          .from(schoolBreaks).where(and(eq(schoolBreaks.schoolId, context.schoolId), eq(schoolBreaks.academicYearId, activeAcademicYear.id))).orderBy(asc(schoolBreaks.afterPeriodPosition)),
      ]);
      return {
        academicYears: yearRows,
        activeAcademicYear,
        grades: gradeRows,
        majors: majorRows,
        classPlans: planRows.map((plan) => ({ ...plan, classes: classRows.filter((group) => group.classPlanId === plan.id).map((group) => ({ id: group.id, name: group.name, studentCount: group.studentCount, maxCapacity: group.maxCapacity, isActive: group.isActive })) })),
        schoolDays: dayRows.map((day) => {
          const dayPeriods = periodRows.filter((period) => period.schoolDayId === day.id).map((period) => ({ id: period.id, position: period.position, label: period.label, startTime: period.startTime, endTime: period.endTime, instructionalUnits: period.instructionalUnits, breakAfterMinutes: period.breakAfterMinutes, isActive: period.isActive }));
          const config = scheduleRows.find((item) => item.schoolDayId === day.id);
          return {
            ...day,
            periods: dayPeriods,
            schedule: config ? {
              mode: config.mode,
              startTime: config.startTime,
              endTime: config.endTime,
              periodCount: config.periodCount,
              defaultBreakMinutes: config.defaultBreakMinutes,
              periods: dayPeriods.filter((period) => period.isActive).map(({ position, label, startTime, endTime, instructionalUnits }) => ({ position, label, startTime, endTime, instructionalUnits })),
              intermissions: breakRows.filter((item) => item.schoolDayId === day.id).map(({ afterPeriodPosition, kind, startTime, endTime }) => ({ afterPeriodPosition, kind, startTime, endTime })),
            } : null,
          };
        }),
      };
    },
    async createAcademicYear(context, input) {
      await db.transaction(async (tx) => {
        if (input.makeActive) await tx.update(academicYears).set({ isActive: false }).where(eq(academicYears.schoolId, context.schoolId));
        await tx.insert(academicYears).values({ schoolId: context.schoolId, ...input, isActive: input.makeActive });
      });
    },
    async setActiveAcademicYear(context, academicYearId) {
      return db.transaction(async (tx) => {
        const [owned] = await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, context.schoolId))).limit(1);
        if (!owned) return false;
        await tx.update(academicYears).set({ isActive: false }).where(eq(academicYears.schoolId, context.schoolId));
        await tx.update(academicYears).set({ isActive: true }).where(and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, context.schoolId)));
        return true;
      });
    },
    async createGrade(context, input) { await db.insert(grades).values({ schoolId: context.schoolId, ...input }); },
    async createMajor(context, input) { await db.insert(majors).values({ schoolId: context.schoolId, ...input }); },
    async updateGradeStatus(context, gradeId, isActive) { const [row] = await db.update(grades).set({ isActive }).where(and(eq(grades.id, gradeId), eq(grades.schoolId, context.schoolId))).returning({ id: grades.id }); return Boolean(row); },
    async updateMajorStatus(context, majorId, isActive) { const [row] = await db.update(majors).set({ isActive }).where(and(eq(majors.id, majorId), eq(majors.schoolId, context.schoolId))).returning({ id: majors.id }); return Boolean(row); },
    async resolveClassScope(context, input) {
      const [yearRows, gradeRows, majorRows] = await Promise.all([
        db.select({ title: academicYears.title }).from(academicYears).where(and(eq(academicYears.id, input.academicYearId), eq(academicYears.schoolId, context.schoolId))).limit(1),
        db.select({ name: grades.name }).from(grades).where(and(eq(grades.id, input.gradeId), eq(grades.schoolId, context.schoolId))).limit(1),
        input.majorId ? db.select({ name: majors.name }).from(majors).where(and(eq(majors.id, input.majorId), eq(majors.schoolId, context.schoolId))).limit(1) : Promise.resolve([{ name: null }]),
      ]);
      if (!yearRows[0] || !gradeRows[0] || !majorRows[0]) return null;
      return { yearTitle: yearRows[0].title, gradeName: gradeRows[0].name, majorName: majorRows[0].name };
    },
    async saveClassPlan(context, input) {
      await db.transaction(async (tx) => {
        const majorCondition = input.majorId ? eq(classPlans.majorId, input.majorId) : isNull(classPlans.majorId);
        const [existing] = await tx.select({ id: classPlans.id }).from(classPlans).where(and(eq(classPlans.schoolId, context.schoolId), eq(classPlans.academicYearId, input.academicYearId), eq(classPlans.gradeId, input.gradeId), majorCondition)).limit(1);
        let planId = existing?.id;
        if (planId) {
          await tx.update(classPlans).set({ studentCount: input.studentCount, maxClassCapacity: input.maxClassCapacity, classCountOverride: input.classCountOverride, updatedAt: new Date() }).where(and(eq(classPlans.id, planId), eq(classPlans.schoolId, context.schoolId)));
        } else {
          const [created] = await tx.insert(classPlans).values({ schoolId: context.schoolId, academicYearId: input.academicYearId, gradeId: input.gradeId, majorId: input.majorId, studentCount: input.studentCount, maxClassCapacity: input.maxClassCapacity, classCountOverride: input.classCountOverride }).returning({ id: classPlans.id });
          planId = created.id;
        }
        const existingGroups = await tx.select({ id: classGroups.id, name: classGroups.name }).from(classGroups).where(and(eq(classGroups.classPlanId, planId), eq(classGroups.schoolId, context.schoolId))).orderBy(asc(classGroups.createdAt));
        for (let index = 0; index < input.groups.length; index += 1) {
          const group = input.groups[index];
          const current = existingGroups[index];
          if (current) {
            await tx.update(classGroups).set({ studentCount: group.studentCount, maxCapacity: group.maxCapacity, isActive: true, updatedAt: new Date() }).where(and(eq(classGroups.id, current.id), eq(classGroups.schoolId, context.schoolId)));
          } else {
            await tx.insert(classGroups).values({ schoolId: context.schoolId, academicYearId: input.academicYearId, classPlanId: planId, gradeId: input.gradeId, majorId: input.majorId, ...group });
          }
        }
        for (const extra of existingGroups.slice(input.groups.length)) await tx.update(classGroups).set({ isActive: false, studentCount: 0, updatedAt: new Date() }).where(and(eq(classGroups.id, extra.id), eq(classGroups.schoolId, context.schoolId)));
      });
    },
    async updateClassGroup(context, input) {
      const [updated] = await db.update(classGroups).set({ name: input.name, isActive: input.isActive, updatedAt: new Date() }).where(and(eq(classGroups.id, input.classGroupId), eq(classGroups.schoolId, context.schoolId))).returning({ id: classGroups.id });
      return Boolean(updated);
    },
    async addSchoolDay(context, input) { await db.insert(schoolDays).values({ schoolId: context.schoolId, ...input }); },
    async updateSchoolDayStatus(context, schoolDayId, isActive) { const [row] = await db.update(schoolDays).set({ isActive }).where(and(eq(schoolDays.id, schoolDayId), eq(schoolDays.schoolId, context.schoolId))).returning({ id: schoolDays.id }); return Boolean(row); },
    async saveDaySchedule(context, academicYearId, schoolDayId, timeline) {
      return db.transaction(async (tx) => {
        const [ownedDay] = await tx.select({ id: schoolDays.id }).from(schoolDays).where(and(eq(schoolDays.id, schoolDayId), eq(schoolDays.academicYearId, academicYearId), eq(schoolDays.schoolId, context.schoolId))).limit(1);
        if (!ownedDay) return false;
        await tx.insert(schoolDaySchedules).values({ schoolId: context.schoolId, academicYearId, schoolDayId, mode: timeline.mode, startTime: timeline.startTime, endTime: timeline.endTime, periodCount: timeline.periodCount, defaultBreakMinutes: timeline.defaultBreakMinutes }).onConflictDoUpdate({
          target: schoolDaySchedules.schoolDayId,
          set: { mode: timeline.mode, startTime: timeline.startTime, endTime: timeline.endTime, periodCount: timeline.periodCount, defaultBreakMinutes: timeline.defaultBreakMinutes, updatedAt: new Date() },
        });
        const existingPeriods = await tx.select({ id: periods.id, position: periods.position }).from(periods).where(and(eq(periods.schoolDayId, schoolDayId), eq(periods.schoolId, context.schoolId)));
        const existingByPosition = new Map(existingPeriods.map((period) => [period.position, period.id]));
        await tx.update(periods).set({ isActive: false }).where(and(eq(periods.schoolDayId, schoolDayId), eq(periods.schoolId, context.schoolId)));
        for (const period of timeline.periods) {
          const intermission = timeline.intermissions.find((item) => item.afterPeriodPosition === period.position);
          const breakAfterMinutes = intermission?.kind === "BREAK"
            ? Number(intermission.endTime.slice(0, 2)) * 60 + Number(intermission.endTime.slice(3, 5)) - Number(intermission.startTime.slice(0, 2)) * 60 - Number(intermission.startTime.slice(3, 5))
            : 0;
          const changes = { label: period.label, startTime: period.startTime, endTime: period.endTime, instructionalUnits: period.instructionalUnits, breakAfterMinutes, isActive: true };
          const existingId = existingByPosition.get(period.position);
          if (existingId) await tx.update(periods).set(changes).where(and(eq(periods.id, existingId), eq(periods.schoolId, context.schoolId)));
          else await tx.insert(periods).values({ schoolId: context.schoolId, academicYearId, schoolDayId, position: period.position, ...changes });
        }
        await tx.delete(schoolBreaks).where(and(eq(schoolBreaks.schoolDayId, schoolDayId), eq(schoolBreaks.schoolId, context.schoolId)));
        if (timeline.intermissions.length) await tx.insert(schoolBreaks).values(timeline.intermissions.map((item) => ({ schoolId: context.schoolId, academicYearId, schoolDayId, ...item })));
        return true;
      });
    },
  };
}
