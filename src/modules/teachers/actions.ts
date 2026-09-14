"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import type { ActionState } from "@/modules/planning/action-state";
import { AuthorizationError } from "@/modules/tenancy/types";
import { createTeacherRepository } from "./repository";
import {
  addTeacher,
  editTeacher,
  saveTeacherAvailability,
  saveTeacherProfile,
  saveTeacherSubjectAssignments,
} from "./service";

async function run(
  operation:
    | typeof addTeacher
    | typeof editTeacher
    | typeof saveTeacherSubjectAssignments
    | typeof saveTeacherProfile
    | typeof saveTeacherAvailability,
  input: unknown,
) {
  const context = await requireTenantContext();
  try {
    const result = await operation(
      context,
      input,
      createTeacherRepository(getDatabase()),
    );
    if (result.status === "success") {
      revalidatePath("/teachers");
      revalidatePath("/planning");
    }
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
        message: "این کد پرسنلی قبلاً در مدرسه ثبت شده است.",
      } satisfies ActionState;
    return {
      status: "error",
      message: "ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.",
    } satisfies ActionState;
  }
}

export async function addTeacherAction(
  _state: ActionState,
  formData: FormData,
) {
  return run(addTeacher, {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    personnelCode: formData.get("personnelCode"),
    employmentType: formData.get("employmentType"),
    staffKind: formData.get("staffKind"),
    notes: formData.get("notes"),
  });
}
export async function editTeacherAction(
  _state: ActionState,
  formData: FormData,
) {
  return run(editTeacher, {
    teacherId: formData.get("teacherId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    personnelCode: formData.get("personnelCode"),
    employmentType: formData.get("employmentType"),
    staffKind: formData.get("staffKind"),
    notes: formData.get("notes"),
    isActive: formData.get("isActive") === "on",
  });
}
export async function saveTeacherSubjectAssignmentsAction(
  _state: ActionState,
  formData: FormData,
) {
  const subjectIds = formData.getAll("subjectIds").map(String);
  return run(saveTeacherSubjectAssignments, {
    teacherId: formData.get("teacherId"),
    academicYearId: formData.get("academicYearId"),
    assignments: subjectIds.map((subjectId) => ({
      subjectId,
      assignedWeeklyHours: formData.get(`hours:${subjectId}`),
    })),
  });
}
export async function saveTeacherProfileAction(
  _state: ActionState,
  formData: FormData,
) {
  return run(saveTeacherProfile, {
    teacherId: formData.get("teacherId"),
    academicYearId: formData.get("academicYearId"),
    minimumWorkload: formData.get("minimumWorkload"),
    requiredWorkload: formData.get("requiredWorkload"),
    maximumWorkload: formData.get("maximumWorkload"),
    overtimeAllowance: formData.get("overtimeAllowance"),
    dailyMinimum: formData.get("dailyMinimum"),
    dailyMaximum: formData.get("dailyMaximum"),
    maxConsecutive: formData.get("maxConsecutive"),
  });
}
export async function saveTeacherAvailabilityAction(
  _state: ActionState,
  formData: FormData,
) {
  const statuses = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith("slot:"))
      .map(([key, value]) => [key.slice(5), String(value)]),
  );
  return run(saveTeacherAvailability, {
    teacherId: formData.get("teacherId"),
    academicYearId: formData.get("academicYearId"),
    statuses,
  });
}
