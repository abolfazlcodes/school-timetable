import { describe, expect, it } from "vitest";
import { cn, formatNumber, formatPersianDate } from "./utils";

describe("ابزارهای نمایش فارسی", () => {
  it("عدد را با رقم‌های فارسی نمایش می‌دهد", () => {
    expect(formatNumber(123456)).toBe("۱۲۳٬۴۵۶");
  });

  it("تاریخ را با تقویم فارسی نمایش می‌دهد", () => {
    expect(formatPersianDate("2026-09-09T12:00:00Z")).toContain("۱۴۰۵");
  });

  it("کلاس‌های شرطی را ترکیب می‌کند", () => {
    expect(cn("base", false, "active")).toBe("base active");
  });
});
