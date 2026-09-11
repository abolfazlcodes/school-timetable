"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import { AuthorizationError } from "@/modules/tenancy/types";
import { createSchoolRepository } from "./repository";
import { updateSchoolProfile, type SchoolProfileFormState } from "./service";

export async function updateSchoolProfileAction(_previousState: SchoolProfileFormState, formData: FormData): Promise<SchoolProfileFormState> {
  const context = await requireTenantContext();
  try {
    const result = await updateSchoolProfile(context, {
      name: formData.get("name"),
      code: formData.get("code"),
      province: formData.get("province"),
      city: formData.get("city"),
      phone: formData.get("phone"),
    }, createSchoolRepository(getDatabase()));
    if (result.status === "success") revalidatePath("/", "layout");
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: error.message };
    return { status: "error", message: "ذخیره اطلاعات انجام نشد. دوباره تلاش کنید." };
  }
}
