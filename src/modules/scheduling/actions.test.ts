import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantContext: vi.fn(),
  generateTimetable: vi.fn(),
}));

vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/auth/dal", () => ({ requireTenantContext: mocks.requireTenantContext }));
vi.mock("./repository", () => ({ createSchedulingRepository: vi.fn(() => ({})) }));
vi.mock("./service", () => ({ generateTimetable: mocks.generateTimetable }));

import { AuthorizationError } from "@/modules/tenancy/types";
import { generateTimetableAction } from "./actions";

describe("Server Action تولید برنامه", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.requireTenantContext.mockReset();
    mocks.generateTimetable.mockReset();
    mocks.requireTenantContext.mockResolvedValue({
      schoolId: "school",
      role: "VICE_PRINCIPAL",
    });
  });

  it("شناسه اجرای موفق را بدون redirect اجباری برمی‌گرداند", async () => {
    mocks.generateTimetable.mockResolvedValue({ ok: true, runId: "run-1" });
    await expect(generateTimetableAction()).resolves.toEqual({ status: "success", runId: "run-1" });
  });

  it("خطای native را ثبت می‌کند و پاسخ امن قابل نمایش می‌دهد", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateTimetable.mockRejectedValue(new Error("libortools.so cannot open shared object"));
    const result = await generateTimetableAction();
    expect(result).toMatchObject({ status: "error", code: "SOLVER_UNAVAILABLE" });
    expect(result.status === "error" && result.reference).toMatch(/^[A-F0-9]{8}$/);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("تغییر هم‌زمان ورودی‌ها را به مرحله بررسی برمی‌گرداند", async () => {
    mocks.generateTimetable.mockResolvedValue({
      ok: false,
      issues: [{ message: "یک خطای پیش‌بررسی وجود دارد." }],
    });
    await expect(generateTimetableAction()).resolves.toMatchObject({
      status: "error",
      code: "PREFLIGHT_BLOCKED",
      reviewRequired: true,
      message: "یک خطای پیش‌بررسی وجود دارد.",
    });
  });

  it("خطای مجوز را بدون ثبت جزئیات داخلی به کاربر برمی‌گرداند", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateTimetable.mockRejectedValue(
      new AuthorizationError("FORBIDDEN", "شما اجازه انجام این عملیات را ندارید."),
    );

    await expect(generateTimetableAction()).resolves.toEqual({
      status: "error",
      code: "FORBIDDEN",
      message: "شما اجازه انجام این عملیات را ندارید.",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("redirect داخلی Next.js را به خطای تولید تبدیل نمی‌کند", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    mocks.requireTenantContext.mockRejectedValue(redirectError);

    await expect(generateTimetableAction()).rejects.toBe(redirectError);
  });
});
