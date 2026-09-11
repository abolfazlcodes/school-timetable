import { z } from "zod";
import type { TenantContext } from "@/modules/tenancy/types";
import { requireRole } from "@/modules/tenancy/types";
import type { ActionState } from "@/modules/planning/action-state";
import { calculateSuggestedClassCount, distributeStudents, integerFromForm, nonNegativeInteger, positiveInteger } from "@/modules/planning/domain";
import type { AcademicStructureRepository } from "./repository";
import { validateSchoolDayTimeline, type SchoolDayTimeline } from "./school-day-timeline";

const uuid = z.string().uuid("شناسه انتخاب‌شده معتبر نیست.");
const name = (label: string, max: number) => z.string().trim().min(2, `${label} باید حداقل ۲ نویسه باشد.`).max(max, `${label} بیش از حد طولانی است.`);

const academicYearSchema = z.object({
  title: name("عنوان سال تحصیلی", 40),
  startYear: z.preprocess(integerFromForm, z.number().int().min(1300, "سال شروع معتبر نیست.").max(1600, "سال شروع معتبر نیست.")),
  endYear: z.preprocess(integerFromForm, z.number().int().min(1301, "سال پایان معتبر نیست.").max(1601, "سال پایان معتبر نیست.")),
  makeActive: z.boolean(),
}).refine((value) => value.endYear > value.startYear, { path: ["endYear"], message: "سال پایان باید بعد از سال شروع باشد." });

const gradeSchema = z.object({ name: name("نام پایه", 60), code: z.string().trim().min(1, "کد پایه لازم است.").max(24), sortOrder: nonNegativeInteger("ترتیب", 100) });
const majorSchema = z.object({ name: name("نام رشته", 80), code: z.string().trim().max(24).transform((value) => value || null) });
const statusSchema = z.object({ id: uuid, isActive: z.boolean() });
const classPlanSchema = z.object({
  academicYearId: uuid,
  gradeId: uuid,
  majorId: z.union([uuid, z.literal("")]).transform((value) => value || null),
  studentCount: positiveInteger("تعداد دانش‌آموز", 5000),
  maxClassCapacity: positiveInteger("حداکثر ظرفیت", 100),
  classCountOverride: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value) => value === "" || value === null || value === undefined ? null : integerFromForm(value)).refine((value) => value === null || Number.isInteger(value) && value > 0 && value <= 100, "تعداد کلاس دستی معتبر نیست."),
});
const classGroupSchema = z.object({ classGroupId: uuid, name: name("نام کلاس", 80), isActive: z.boolean() });
const schoolDaySchema = z.object({ academicYearId: uuid, dayOfWeek: nonNegativeInteger("روز هفته", 6), label: name("نام روز", 24), sortOrder: nonNegativeInteger("ترتیب", 6) });
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "ساعت معتبر نیست.");
const timelineSchema = z.object({
  academicYearId: uuid,
  schoolDayId: uuid,
  mode: z.enum(["AUTO", "MANUAL"]),
  startTime: clock,
  endTime: clock,
  periodCount: z.number().int().min(1).max(20),
  defaultBreakMinutes: z.number().int().min(0).max(180),
  periods: z.array(z.object({ position: z.number().int().min(1).max(20), label: name("عنوان زنگ", 32), startTime: clock, endTime: clock })).min(1).max(20),
  intermissions: z.array(z.object({ afterPeriodPosition: z.number().int().min(1).max(19), kind: z.enum(["BREAK", "TRANSITION"]), startTime: clock, endTime: clock })).max(19),
});

function validationError(error: z.ZodError): ActionState {
  return { status: "error", message: "اطلاعات واردشده را بررسی کنید.", fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
}

export async function createAcademicYear(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = academicYearSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await repository.createAcademicYear(context, parsed.data);
  return { status: "success", message: "سال تحصیلی ذخیره شد." };
}

export async function activateAcademicYear(context: TenantContext, academicYearId: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = uuid.safeParse(academicYearId);
  if (!parsed.success) return { status: "error", message: "سال تحصیلی معتبر نیست." };
  return await repository.setActiveAcademicYear(context, parsed.data) ? { status: "success", message: "سال تحصیلی فعال تغییر کرد." } : { status: "error", message: "سال تحصیلی در مدرسه فعال پیدا نشد." };
}

export async function addGrade(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await repository.createGrade(context, parsed.data);
  return { status: "success", message: "پایه افزوده شد." };
}

export async function addMajor(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = majorSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await repository.createMajor(context, parsed.data);
  return { status: "success", message: "رشته افزوده شد." };
}

export async function setGradeStatus(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "پایه معتبر نیست." };
  return await repository.updateGradeStatus(context, parsed.data.id, parsed.data.isActive) ? { status: "success", message: "وضعیت پایه تغییر کرد." } : { status: "error", message: "پایه در مدرسه فعال پیدا نشد." };
}

export async function setMajorStatus(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "رشته معتبر نیست." };
  return await repository.updateMajorStatus(context, parsed.data.id, parsed.data.isActive) ? { status: "success", message: "وضعیت رشته تغییر کرد." } : { status: "error", message: "رشته در مدرسه فعال پیدا نشد." };
}

export async function saveClassPlan(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = classPlanSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const scope = await repository.resolveClassScope(context, parsed.data);
  if (!scope) return { status: "error", message: "سال، پایه یا رشته در مدرسه فعال معتبر نیست." };
  const suggested = calculateSuggestedClassCount(parsed.data.studentCount, parsed.data.maxClassCapacity);
  const classCount = parsed.data.classCountOverride ?? suggested;
  let distribution: number[];
  try { distribution = distributeStudents(parsed.data.studentCount, classCount, parsed.data.maxClassCapacity); }
  catch (error) { return { status: "error", message: error instanceof Error ? error.message : "تعداد کلاس معتبر نیست." }; }
  const prefix = [scope.gradeName, scope.majorName].filter(Boolean).join(" ");
  await repository.saveClassPlan(context, { ...parsed.data, groups: distribution.map((studentCount, index) => ({ name: `${prefix} ${(index + 1).toLocaleString("fa-IR")}`, studentCount, maxCapacity: parsed.data.maxClassCapacity })) });
  return { status: "success", message: `${classCount.toLocaleString("fa-IR")} کلاس برای ${parsed.data.studentCount.toLocaleString("fa-IR")} دانش‌آموز آماده شد.` };
}

export async function editClassGroup(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = classGroupSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  return await repository.updateClassGroup(context, parsed.data) ? { status: "success", message: "کلاس به‌روزرسانی شد." } : { status: "error", message: "کلاس در مدرسه فعال پیدا نشد." };
}

export async function addSchoolDay(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = schoolDaySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await repository.addSchoolDay(context, parsed.data);
  return { status: "success", message: "روز کاری افزوده شد." };
}

export async function setSchoolDayStatus(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "روز کاری معتبر نیست." };
  return await repository.updateSchoolDayStatus(context, parsed.data.id, parsed.data.isActive) ? { status: "success", message: "وضعیت روز کاری تغییر کرد." } : { status: "error", message: "روز کاری در مدرسه فعال پیدا نشد." };
}

export async function saveSchoolDaySchedule(context: TenantContext, input: unknown, repository: AcademicStructureRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = timelineSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const timeline = parsed.data as SchoolDayTimeline & { academicYearId: string; schoolDayId: string };
  const errors = validateSchoolDayTimeline(timeline);
  if (errors.length) return { status: "error", message: errors[0], fieldErrors: { timeline: errors } };
  return await repository.saveDaySchedule(context, timeline.academicYearId, timeline.schoolDayId, timeline)
    ? { status: "success", message: "برنامه زنگ‌های این روز ذخیره شد." }
    : { status: "error", message: "روز کاری در مدرسه و سال فعال پیدا نشد." };
}
