"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import { createSchedulingRepository } from "@/modules/scheduling/repository";
import { AuthorizationError } from "@/modules/tenancy/types";
import { createTimetableRepository } from "./repository";
import { createEditableWorkspace, editTimetable, type TimetableEditInput, type TimetableEditResult } from "./service";

export async function createScheduleWorkspaceAction(formData: FormData) {
  const context = await requireTenantContext();
  const db = getDatabase();
  const returnTo = formData.get("returnTo") === "planning" ? "planning" : "timetable";
  let workspaceId: string;
  try {
    workspaceId = await createEditableWorkspace(
      context,
      createSchedulingRepository(db),
      createTimetableRepository(db),
      { runId: formData.get("runId"), rank: formData.get("rank") },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/");
    console.error("Schedule workspace creation failed", error);
    redirect(returnTo === "planning" ? "/planning?step=generate&workspaceError=1" : "/timetable?workspaceError=1");
  }
  redirect(returnTo === "planning" ? `/planning?step=edit&workspace=${workspaceId}` : `/timetable?workspace=${workspaceId}`);
}

export async function editTimetableAction(input: TimetableEditInput): Promise<TimetableEditResult> {
  const context = await requireTenantContext();
  const db = getDatabase();
  try {
    const result = await editTimetable(
      context,
      createSchedulingRepository(db),
      createTimetableRepository(db),
      input,
    );
    if (result.status === "success") {
      revalidatePath("/planning");
      revalidatePath("/timetable");
    }
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: error.message };
    return { status: "error", message: "اعمال تغییر انجام نشد. دوباره تلاش کنید." };
  }
}
