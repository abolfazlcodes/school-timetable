import { z } from "zod";
import { requireRole, type TenantContext } from "@/modules/tenancy/types";
import type { SchoolRepository } from "./repository";

const optionalText = (max: number) => z.string().trim().max(max, "مقدار واردشده بیش از حد طولانی است.").transform((value) => value || null);

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(2, "نام مدرسه باید حداقل ۲ نویسه باشد.").max(160, "نام مدرسه بیش از حد طولانی است."),
  code: optionalText(32),
  province: optionalText(80),
  city: optionalText(80),
  phone: optionalText(24).refine((value) => value === null || /^[۰-۹0-9+()\-\s]+$/.test(value), "شماره تماس معتبر نیست."),
});

export type SchoolProfileFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "code" | "province" | "city" | "phone", string[]>>;
};

export async function updateSchoolProfile(
  context: TenantContext,
  input: unknown,
  repository: SchoolRepository,
  now = new Date(),
): Promise<SchoolProfileFormState> {
  requireRole(context, ["ADMIN"]);
  const parsed = schoolProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "اطلاعات مدرسه را بررسی کنید.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const updated = await repository.updateProfile(context, parsed.data, now);
  if (!updated) return { status: "error", message: "مدرسه فعال پیدا نشد." };
  return { status: "success", message: "اطلاعات مدرسه ذخیره شد." };
}
