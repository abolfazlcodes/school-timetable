import { describe, expect, it } from "vitest";
import { classifyGenerationFailure } from "./generation-error";

describe("پیام امن خطای تولید برنامه", () => {
  it("نبود فایل‌های native حل‌گر را به خطای قابل اقدام تبدیل می‌کند", () => {
    const result = classifyGenerationFailure(
      new Error("[@ortools-node/cp-sat] no prebuilt binary for linux-x64-glibc"),
      "REF12345",
    );
    expect(result).toMatchObject({
      status: "error",
      code: "SOLVER_UNAVAILABLE",
      reference: "REF12345",
    });
    expect(result.message).not.toContain("linux-x64");
  });

  it("خطای timeout و دیتابیس را از هم جدا می‌کند", () => {
    expect(classifyGenerationFailure(new Error("FUNCTION_INVOCATION_TIMEOUT"), "TIME1234").code).toBe("GENERATION_TIMEOUT");
    expect(classifyGenerationFailure(new Error("Failed query: connect ECONNREFUSED"), "DB123456").code).toBe("DATABASE_UNAVAILABLE");
  });

  it("جزئیات خطای ناشناخته را به کاربر نشت نمی‌دهد", () => {
    const result = classifyGenerationFailure(new Error("secret SQL and credentials"), "SAFE1234");
    expect(result.code).toBe("GENERATION_FAILED");
    expect(result.reference).toBe("SAFE1234");
    expect(result.message).not.toContain("secret");
  });
});
