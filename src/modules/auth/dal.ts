import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "@/db/client";
import { createAuthRepository } from "./repository";
import { resolveTenantSession } from "./service";
import { sessionCookieName } from "./session-token";

export const getOptionalTenantContext = cache(async () => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;
  return resolveTenantSession(token, createAuthRepository(getDatabase()));
});

export const requireTenantContext = cache(async () => {
  const context = await getOptionalTenantContext();
  if (!context) redirect("/login");
  return context;
});

export const getShellIdentity = cache(async () => {
  const context = await requireTenantContext();
  const schools = await createAuthRepository(getDatabase()).listUserSchools(context.userId);
  return { context, schools };
});
