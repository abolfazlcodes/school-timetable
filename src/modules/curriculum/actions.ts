"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import type { ActionState } from "@/modules/planning/action-state";
import { AuthorizationError } from "@/modules/tenancy/types";
import { createCurriculumRepository } from "./repository";
import { addSubject, saveCurriculumItem, setSubjectStatus } from "./service";

async function run(
  operation:
    | typeof addSubject
    | typeof saveCurriculumItem
    | typeof setSubjectStatus,
  input: unknown,
) {
  const context = await requireTenantContext();
  try {
    const result = await operation(
      context,
      input,
      createCurriculumRepository(getDatabase()),
    );
    if (result.status === "success") revalidatePath("/planning");
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError)
      return { status: "error", message: error.message } satisfies ActionState;
    if (
      error instanceof Error &&
      (error.message.includes("unique") || error.message.includes("duplicate"))
    )
      return {
        status: "error",
        message: "این درس یا برنامه درسی قبلاً ثبت شده است.",
      } satisfies ActionState;
    return {
      status: "error",
      message: "ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.",
    } satisfies ActionState;
  }
}

export async function addSubjectAction(
  _state: ActionState,
  formData: FormData,
) {
  return run(addSubject, {
    name: formData.get("name"),
    code: formData.get("code"),
  });
}
export async function setSubjectStatusAction(
  _state: ActionState,
  formData: FormData,
) {
  return run(setSubjectStatus, {
    subjectId: formData.get("subjectId"),
    isActive: formData.get("isActive") === "true",
  });
}
export async function saveCurriculumItemAction(
  _state: ActionState,
  formData: FormData,
) {
  return run(saveCurriculumItem, {
    academicYearId: formData.get("academicYearId"),
    gradeId: formData.get("gradeId"),
    majorId: formData.get("majorId"),
    subjectId: formData.get("subjectId"),
    weeklyHours: formData.get("weeklyHours"),
    sessionCount: formData.get("sessionCount"),
    sessionPattern: formData.get("sessionPattern"),
  });
}
