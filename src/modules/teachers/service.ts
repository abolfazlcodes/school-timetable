import { z } from "zod";
import type { AvailabilityStatus } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";
import { requireRole } from "@/modules/tenancy/types";
import type { ActionState } from "@/modules/planning/action-state";
import { nonNegativeInteger, validateAvailability, validateWorkload } from "@/modules/planning/domain";
import type { TeacherRepository } from "./repository";

const uuid = z.string().uuid("شناسه انتخاب‌شده معتبر نیست.");
const teacherFields = {
  firstName: z.string().trim().min(2, "نام باید حداقل ۲ نویسه باشد.").max(60),
  lastName: z.string().trim().min(2, "نام خانوادگی باید حداقل ۲ نویسه باشد.").max(80),
  personnelCode: z.string().trim().min(2, "کد پرسنلی لازم است.").max(32),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"], { error: "نوع همکاری معتبر نیست." }),
  staffKind: z.enum(["TEACHER", "VICE_PRINCIPAL", "EDUCATIONAL_DEPUTY", "EXECUTIVE_DEPUTY", "CULTURAL_DEPUTY", "OTHER"], { error: "نوع مسئولیت معتبر نیست." }),
  notes: z.string().trim().max(1000, "یادداشت بیش از حد طولانی است.").transform((value) => value || null),
};
const createSchema = z.object(teacherFields);
const updateSchema = z.object({ teacherId: uuid, ...teacherFields, isActive: z.boolean() });
const subjectSchema = z.object({
  teacherId: uuid,
  subjectIds: z.array(uuid).max(30).refine((values) => new Set(values).size === values.length, "یک درس نمی‌تواند دوبار انتخاب شود."),
});
const profileSchema = z.object({
  teacherId: uuid,
  academicYearId: uuid,
  minimumWorkload: nonNegativeInteger("حداقل موظفی", 80),
  requiredWorkload: nonNegativeInteger("موظفی", 80),
  maximumWorkload: nonNegativeInteger("حداکثر موظفی", 100),
  overtimeAllowance: nonNegativeInteger("اضافه‌کاری", 40),
  dailyMinimum: nonNegativeInteger("حداقل روزانه", 12),
  dailyMaximum: nonNegativeInteger("حداکثر روزانه", 12),
  maxConsecutive: nonNegativeInteger("حداکثر متوالی", 12),
});
const availabilitySchema = z.object({ teacherId: uuid, academicYearId: uuid, statuses: z.record(z.string(), z.string()) });

function invalid(error: z.ZodError, message: string): ActionState { return { status: "error", message, fieldErrors: error.flatten().fieldErrors as Record<string, string[]> }; }

export async function addTeacher(context: TenantContext, input: unknown, repository: TeacherRepository): Promise<ActionState & { teacherId?: string }> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "مشخصات دبیر را بررسی کنید.");
  const teacherId = await repository.createTeacher(context, parsed.data);
  return { status: "success", message: "دبیر افزوده شد.", teacherId };
}

export async function editTeacher(context: TenantContext, input: unknown, repository: TeacherRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "مشخصات دبیر را بررسی کنید.");
  const { teacherId, ...changes } = parsed.data;
  return await repository.updateTeacher(context, teacherId, changes) ? { status: "success", message: "مشخصات دبیر ذخیره شد." } : { status: "error", message: "دبیر در مدرسه فعال پیدا نشد." };
}

export async function saveTeacherSubjects(context: TenantContext, input: unknown, repository: TeacherRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "انتخاب درس‌ها معتبر نیست.");
  return await repository.saveSubjects(context, parsed.data.teacherId, parsed.data.subjectIds) ? { status: "success", message: "درس‌های قابل تدریس ذخیره شد." } : { status: "error", message: "دبیر یا یکی از درس‌ها متعلق به مدرسه فعال نیست." };
}

export async function saveTeacherProfile(context: TenantContext, input: unknown, repository: TeacherRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "اطلاعات موظفی را بررسی کنید.");
  const { teacherId, academicYearId, ...limits } = parsed.data;
  const workloadError = validateWorkload({ minimum: limits.minimumWorkload, required: limits.requiredWorkload, maximum: limits.maximumWorkload, overtime: limits.overtimeAllowance, dailyMinimum: limits.dailyMinimum, dailyMaximum: limits.dailyMaximum, maxConsecutive: limits.maxConsecutive });
  if (workloadError) return { status: "error", message: workloadError };
  return await repository.saveProfile(context, academicYearId, teacherId, limits) ? { status: "success", message: "موظفی و محدودیت‌های سالانه ذخیره شد." } : { status: "error", message: "دبیر یا سال تحصیلی متعلق به مدرسه فعال نیست." };
}

export async function saveTeacherAvailability(context: TenantContext, input: unknown, repository: TeacherRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "جدول حضور معتبر نیست.");
  const workspace = await repository.getWorkspace(context, parsed.data.teacherId);
  if (!workspace.activeAcademicYear || workspace.activeAcademicYear.id !== parsed.data.academicYearId || workspace.selectedTeacher?.id !== parsed.data.teacherId) return { status: "error", message: "دبیر یا سال تحصیلی متعلق به مدرسه فعال نیست." };
  const validPeriods = new Map(workspace.schoolDays.flatMap((day) => day.periods.map((period) => [period.id, day.id] as const)));
  const availabilityError = validateAvailability(parsed.data.statuses, new Set(validPeriods.keys()));
  if (availabilityError) return { status: "error", message: availabilityError };
  if (Object.keys(parsed.data.statuses).length !== validPeriods.size) return { status: "error", message: "برای همه زنگ‌های فعال وضعیت حضور را مشخص کنید." };
  const slots = Object.entries(parsed.data.statuses).map(([periodId, status]) => ({ periodId, schoolDayId: validPeriods.get(periodId)!, status: status as AvailabilityStatus }));
  return await repository.saveAvailability(context, parsed.data.academicYearId, parsed.data.teacherId, slots) ? { status: "success", message: "جدول حضور دبیر ذخیره شد." } : { status: "error", message: "جدول حضور به دلیل ناسازگاری داده ذخیره نشد." };
}
