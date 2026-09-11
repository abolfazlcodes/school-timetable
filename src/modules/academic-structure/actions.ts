"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import type { ActionState } from "@/modules/planning/action-state";
import { AuthorizationError } from "@/modules/tenancy/types";
import { createAcademicStructureRepository } from "./repository";
import { activateAcademicYear, addGrade, addMajor, addSchoolDay, createAcademicYear, editClassGroup, saveClassPlan, saveSchoolDaySchedule, setGradeStatus, setMajorStatus, setSchoolDayStatus } from "./service";

type Operation = (context: Awaited<ReturnType<typeof requireTenantContext>>, input: unknown, repository: ReturnType<typeof createAcademicStructureRepository>) => Promise<ActionState>;

async function run(operation: Operation, input: unknown) {
  const context = await requireTenantContext();
  try {
    const result = await operation(context, input, createAcademicStructureRepository(getDatabase()));
    if (result.status === "success") revalidatePath("/planning");
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: error.message } satisfies ActionState;
    if (error instanceof Error && (error.message.includes("unique") || error.message.includes("duplicate"))) return { status: "error", message: "این مورد قبلاً ثبت شده است." } satisfies ActionState;
    return { status: "error", message: "ذخیره اطلاعات انجام نشد. دوباره تلاش کنید." } satisfies ActionState;
  }
}

export async function createAcademicYearAction(_state: ActionState, formData: FormData) { return run(createAcademicYear, { title: formData.get("title"), startYear: formData.get("startYear"), endYear: formData.get("endYear"), makeActive: formData.get("makeActive") === "on" }); }
export async function activateAcademicYearAction(_state: ActionState, formData: FormData) { return run(activateAcademicYear, formData.get("academicYearId")); }
export async function addGradeAction(_state: ActionState, formData: FormData) { return run(addGrade, { name: formData.get("name"), code: formData.get("code"), sortOrder: formData.get("sortOrder") }); }
export async function addMajorAction(_state: ActionState, formData: FormData) { return run(addMajor, { name: formData.get("name"), code: formData.get("code") }); }
export async function setGradeStatusAction(_state: ActionState, formData: FormData) { return run(setGradeStatus, { id: formData.get("id"), isActive: formData.get("isActive") === "true" }); }
export async function setMajorStatusAction(_state: ActionState, formData: FormData) { return run(setMajorStatus, { id: formData.get("id"), isActive: formData.get("isActive") === "true" }); }
export async function saveClassPlanAction(_state: ActionState, formData: FormData) { return run(saveClassPlan, { academicYearId: formData.get("academicYearId"), gradeId: formData.get("gradeId"), majorId: formData.get("majorId"), studentCount: formData.get("studentCount"), maxClassCapacity: formData.get("maxClassCapacity"), classCountOverride: formData.get("classCountOverride") }); }
export async function editClassGroupAction(_state: ActionState, formData: FormData) { return run(editClassGroup, { classGroupId: formData.get("classGroupId"), name: formData.get("name"), isActive: formData.get("isActive") === "on" }); }
export async function addSchoolDayAction(_state: ActionState, formData: FormData) { return run(addSchoolDay, { academicYearId: formData.get("academicYearId"), dayOfWeek: formData.get("dayOfWeek"), label: formData.get("label"), sortOrder: formData.get("sortOrder") }); }
export async function setSchoolDayStatusAction(_state: ActionState, formData: FormData) { return run(setSchoolDayStatus, { id: formData.get("id"), isActive: formData.get("isActive") === "true" }); }
export async function saveSchoolDayScheduleAction(_state: ActionState, formData: FormData) {
  try {
    const timeline = JSON.parse(String(formData.get("timeline") ?? "")) as Record<string, unknown>;
    return run(saveSchoolDaySchedule, { ...timeline, academicYearId: formData.get("academicYearId"), schoolDayId: formData.get("schoolDayId") });
  } catch {
    return { status: "error", message: "ساختار برنامه زنگ‌ها قابل خواندن نیست." } satisfies ActionState;
  }
}
