"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { createAuthRepository } from "./repository";
import { authenticate, resolveTenantSession, revokeTenantSession } from "./service";
import { sessionCookieName } from "./session-token";

export type LoginFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

export async function loginAction(_previousState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  let result;
  try {
    result = await authenticate({ email: formData.get("email"), password: formData.get("password") }, createAuthRepository(getDatabase()));
  } catch {
    return { status: "error", message: "در حال حاضر اتصال به سامانه ممکن نیست. کمی بعد دوباره تلاش کنید." };
  }
  if (!result.ok) return { status: "error", message: result.message, fieldErrors: result.fieldErrors };

  (await cookies()).set(sessionCookieName(), result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
    priority: "high",
  });
  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  try {
    await revokeTenantSession(token, createAuthRepository(getDatabase()));
  } finally {
    cookieStore.delete(sessionCookieName());
  }
  redirect("/login");
}

export async function switchSchoolAction(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  const repository = createAuthRepository(getDatabase());
  const context = await resolveTenantSession(token, repository);
  if (!context) redirect("/login");

  const schoolId = formData.get("schoolId");
  if (typeof schoolId !== "string") return;
  const switched = await repository.switchActiveSchool({ sessionId: context.sessionId, userId: context.userId, schoolId, now: new Date() });
  if (!switched) return;
  revalidatePath("/", "layout");
  redirect("/");
}
