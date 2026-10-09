"use server";

import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import { AuthorizationError } from "@/modules/tenancy/types";
import { classifyGenerationFailure, type GenerationActionResult } from "./generation-error";
import { createSchedulingRepository } from "./repository";
import { generateTimetable } from "./service";

export async function generateTimetableAction(): Promise<GenerationActionResult> {
  const reference = randomUUID().slice(0, 8).toUpperCase();
  try {
    const context = await requireTenantContext();
    const result = await generateTimetable(context, createSchedulingRepository(getDatabase()));
    if (!result.ok) {
      return {
        status: "error",
        code: "PREFLIGHT_BLOCKED",
        message: result.issues[0]?.message ?? "اطلاعات برنامه‌ریزی تغییر کرده است؛ دوباره مرحله بررسی اطلاعات را کنترل کنید.",
        reviewRequired: true,
      };
    }
    return { status: "success", runId: result.runId };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthorizationError) {
      return { status: "error", code: "FORBIDDEN", message: error.message };
    }
    console.error(`[schedule-generation:${reference}]`, error);
    return classifyGenerationFailure(error, reference);
  }
}
