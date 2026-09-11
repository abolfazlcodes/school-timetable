import type { SchoolRole } from "@/db/schema";

export interface TenantContext {
  sessionId: string;
  userId: string;
  userName: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string | null;
  role: SchoolRole;
}

export class AuthorizationError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "CROSS_TENANT", message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requireRole(context: TenantContext, allowedRoles: readonly SchoolRole[]) {
  if (!allowedRoles.includes(context.role)) {
    throw new AuthorizationError("FORBIDDEN", "شما اجازه انجام این عملیات را ندارید.");
  }
  return context;
}

export function requireSameSchool(context: TenantContext, resourceSchoolId: string) {
  if (context.schoolId !== resourceSchoolId) {
    throw new AuthorizationError("CROSS_TENANT", "این اطلاعات در مدرسه فعال شما قرار ندارد.");
  }
  return context;
}
