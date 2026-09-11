"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import { createSchedulingRepository } from "@/modules/scheduling/repository";
import { AuthorizationError } from "@/modules/tenancy/types";
import { createTimetableRepository } from "@/modules/timetable/repository";
import { createScheduleVersionRepository } from "./repository";
import { archiveScheduleVersion, forkScheduleVersion, snapshotWorkspace, type VersionMutationResult } from "./service";

function refreshSchedulePages() {
  revalidatePath("/");
  revalidatePath("/planning");
  revalidatePath("/timetable");
}

export async function saveScheduleVersionAction(input: { workspaceId: string; publish: boolean; confirmWarnings?: boolean }): Promise<VersionMutationResult> {
  try {
    const context = await requireTenantContext();
    const db = getDatabase();
    const result = await snapshotWorkspace(context, createSchedulingRepository(db), createTimetableRepository(db), createScheduleVersionRepository(db), input);
    if (result.status === "success") refreshSchedulePages();
    return result;
  } catch (error) {
    return { status: "error", message: error instanceof AuthorizationError ? error.message : "ذخیره نسخه انجام نشد. دوباره تلاش کنید." };
  }
}

export async function forkScheduleVersionAction(versionId: string): Promise<VersionMutationResult> {
  try {
    const context = await requireTenantContext();
    const db = getDatabase();
    const result = await forkScheduleVersion(context, createSchedulingRepository(db), createScheduleVersionRepository(db), versionId);
    if (result.status === "success") refreshSchedulePages();
    return result;
  } catch (error) {
    return { status: "error", message: error instanceof AuthorizationError ? error.message : "ساخت نسخهٔ کاری انجام نشد." };
  }
}

export async function archiveScheduleVersionAction(versionId: string): Promise<VersionMutationResult> {
  try {
    const context = await requireTenantContext();
    const result = await archiveScheduleVersion(context, createScheduleVersionRepository(getDatabase()), versionId);
    if (result.status === "success") refreshSchedulePages();
    return result;
  } catch (error) {
    return { status: "error", message: error instanceof AuthorizationError ? error.message : "بایگانی نسخه انجام نشد." };
  }
}
