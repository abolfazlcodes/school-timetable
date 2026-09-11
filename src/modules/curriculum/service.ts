import { z } from "zod";
import type { TenantContext } from "@/modules/tenancy/types";
import { requireRole } from "@/modules/tenancy/types";
import type { ActionState } from "@/modules/planning/action-state";
import { parseSessionPattern, positiveInteger, validateSessionPattern } from "@/modules/planning/domain";
import type { CurriculumRepository } from "./repository";

const uuid = z.string().uuid("شناسه انتخاب‌شده معتبر نیست.");
const subjectSchema = z.object({ name: z.string().trim().min(2, "نام درس باید حداقل ۲ نویسه باشد.").max(100), code: z.string().trim().max(24).transform((value) => value || null) });
const itemSchema = z.object({
  academicYearId: uuid,
  gradeId: uuid,
  majorId: z.union([uuid, z.literal("")]).transform((value) => value || null),
  subjectId: uuid,
  weeklyPeriods: positiveInteger("ساعات هفتگی", 30),
  sessionCount: positiveInteger("تعداد جلسه", 15),
  sessionPattern: z.unknown().transform(parseSessionPattern),
});

export async function addSubject(context: TenantContext, input: unknown, repository: CurriculumRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "مشخصات درس را بررسی کنید.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  await repository.createSubject(context, parsed.data);
  return { status: "success", message: "درس افزوده شد." };
}

export async function setSubjectStatus(context: TenantContext, input: unknown, repository: CurriculumRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = z.object({ subjectId: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "درس معتبر نیست." };
  return await repository.updateSubjectStatus(context, parsed.data.subjectId, parsed.data.isActive) ? { status: "success", message: "وضعیت درس تغییر کرد." } : { status: "error", message: "درس در مدرسه فعال پیدا نشد." };
}

export async function saveCurriculumItem(context: TenantContext, input: unknown, repository: CurriculumRepository): Promise<ActionState> {
  requireRole(context, ["ADMIN", "VICE_PRINCIPAL"]);
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "اطلاعات ساعات درس را بررسی کنید.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const patternError = validateSessionPattern(parsed.data.weeklyPeriods, parsed.data.sessionCount, parsed.data.sessionPattern);
  if (patternError) return { status: "error", message: patternError, fieldErrors: { sessionPattern: [patternError] } };
  if (!await repository.resolveScope(context, parsed.data)) return { status: "error", message: "سال، پایه، رشته یا درس متعلق به مدرسه فعال نیست." };
  await repository.saveItem(context, parsed.data);
  return { status: "success", message: "ساعات و الگوی جلسات درس ذخیره شد." };
}
