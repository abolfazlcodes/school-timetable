"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import { createSchedulingRepository } from "./repository";
import { generateTimetable } from "./service";

export async function generateTimetableAction() {
  const context = await requireTenantContext();
  const result = await generateTimetable(context, createSchedulingRepository(getDatabase()));
  if (!result.ok) redirect("/planning?step=review&blocked=1");
  redirect(`/planning?step=generate&run=${result.runId}`);
}
