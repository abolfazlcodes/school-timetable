import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { academicYears, classGroups, classPlans, grades, majors, periods, schoolDays } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";

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
export interface PeriodView { id: string; position: number; label: string; startTime: string; endTime: string; breakAfterMinutes: number; isActive: boolean }
export interface SchoolDayView { id: string; dayOfWeek: number; label: string; sortOrder: number; isActive: boolean; periods: PeriodView[] }
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
  addPeriod(context: TenantContext, input: { academicYearId: string; schoolDayId: string; position: number; label: string; startTime: string; endTime: string; breakAfterMinutes: number }): Promise<boolean>;
  updateSchoolDayStatus(context: TenantContext, schoolDayId: string, isActive: boolean): Promise<boolean>;
  updatePeriod(context: TenantContext, input: { periodId: string; label: string; startTime: string; endTime: string; breakAfterMinutes: number; isActive: boolean }): Promise<boolean>;
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

      const [planRows, classRows, dayRows, periodRows] = await Promise.all([
        db.select({ id: classPlans.id, academicYearId: classPlans.academicYearId, gradeId: classPlans.gradeId, gradeName: grades.name, majorId: classPlans.majorId, majorName: majors.name, studentCount: classPlans.studentCount, maxClassCapacity: classPlans.maxClassCapacity, classCountOverride: classPlans.classCountOverride })
          .from(classPlans).innerJoin(grades, and(eq(grades.id, classPlans.gradeId), eq(grades.schoolId, context.schoolId)))
          .leftJoin(majors, and(eq(majors.id, classPlans.majorId), eq(majors.schoolId, context.schoolId)))
          .where(and(eq(classPlans.schoolId, context.schoolId), eq(classPlans.academicYearId, activeAcademicYear.id)))
          .orderBy(asc(grades.sortOrder), asc(majors.name)),
        db.select({ id: classGroups.id, classPlanId: classGroups.classPlanId, name: classGroups.name, studentCount: classGroups.studentCount, maxCapacity: classGroups.maxCapacity, isActive: classGroups.isActive })
          .from(classGroups).where(and(eq(classGroups.schoolId, context.schoolId), eq(classGroups.academicYearId, activeAcademicYear.id))).orderBy(asc(classGroups.name)),
        db.select({ id: schoolDays.id, dayOfWeek: schoolDays.dayOfWeek, label: schoolDays.label, sortOrder: schoolDays.sortOrder, isActive: schoolDays.isActive })
          .from(schoolDays).where(and(eq(schoolDays.schoolId, context.schoolId), eq(schoolDays.academicYearId, activeAcademicYear.id))).orderBy(asc(schoolDays.sortOrder)),
        db.select({ id: periods.id, schoolDayId: periods.schoolDayId, position: periods.position, label: periods.label, startTime: periods.startTime, endTime: periods.endTime, breakAfterMinutes: periods.breakAfterMinutes, isActive: periods.isActive })
          .from(periods).where(and(eq(periods.schoolId, context.schoolId), eq(periods.academicYearId, activeAcademicYear.id))).orderBy(asc(periods.position)),
      ]);
      return {
        academicYears: yearRows,
        activeAcademicYear,
        grades: gradeRows,
        majors: majorRows,
        classPlans: planRows.map((plan) => ({ ...plan, classes: classRows.filter((group) => group.classPlanId === plan.id).map((group) => ({ id: group.id, name: group.name, studentCount: group.studentCount, maxCapacity: group.maxCapacity, isActive: group.isActive })) })),
        schoolDays: dayRows.map((day) => ({ ...day, periods: periodRows.filter((period) => period.schoolDayId === day.id).map((period) => ({ id: period.id, position: period.position, label: period.label, startTime: period.startTime, endTime: period.endTime, breakAfterMinutes: period.breakAfterMinutes, isActive: period.isActive })) })),
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
    async addPeriod(context, input) {
      const [day] = await db.select({ id: schoolDays.id }).from(schoolDays).where(and(eq(schoolDays.id, input.schoolDayId), eq(schoolDays.academicYearId, input.academicYearId), eq(schoolDays.schoolId, context.schoolId))).limit(1);
      if (!day) return false;
      await db.insert(periods).values({ schoolId: context.schoolId, ...input });
      return true;
    },
    async updateSchoolDayStatus(context, schoolDayId, isActive) { const [row] = await db.update(schoolDays).set({ isActive }).where(and(eq(schoolDays.id, schoolDayId), eq(schoolDays.schoolId, context.schoolId))).returning({ id: schoolDays.id }); return Boolean(row); },
    async updatePeriod(context, input) {
      const { periodId, ...changes } = input;
      const [row] = await db.update(periods).set(changes).where(and(eq(periods.id, periodId), eq(periods.schoolId, context.schoolId))).returning({ id: periods.id });
      return Boolean(row);
    },
  };
}
