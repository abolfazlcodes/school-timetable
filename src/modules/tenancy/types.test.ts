import { describe, expect, it } from "vitest";
import { AuthorizationError, requireRole, requireSameSchool, type TenantContext } from "./types";

const context: TenantContext = { sessionId: "session", userId: "user", userName: "معاون", schoolId: "school-a", schoolName: "الف", schoolCode: null, role: "VICE_PRINCIPAL" };

describe("policyهای tenant و نقش", () => {
  it("دسترسی نقش مجاز را قبول می‌کند", () => {
    expect(requireRole(context, ["ADMIN", "VICE_PRINCIPAL"])).toBe(context);
  });

  it("عمل مدیر را برای معاون رد می‌کند", () => {
    expect(() => requireRole(context, ["ADMIN"])).toThrowError(AuthorizationError);
  });

  it("reference مدرسه دیگر را رد می‌کند", () => {
    expect(() => requireSameSchool(context, "school-b")).toThrowError(/مدرسه فعال/);
  });
});
