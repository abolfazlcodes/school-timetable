import { describe, expect, it } from "vitest";
import { calculateCurriculumWorkload, calculateSuggestedClassCount, distributeStudents, normalizeDigits, parseSessionPattern, validateAvailability, validateSessionPattern, validateWorkload } from "./domain";

describe("قواعد داده‌ورودی برنامه‌ریزی", () => {
  it("تعداد کلاس پیشنهادی را با گرد کردن رو به بالا محاسبه می‌کند", () => {
    expect(calculateSuggestedClassCount(73, 28)).toBe(3);
  });

  it("دانش‌آموزان را بدون عبور از ظرفیت توزیع می‌کند", () => {
    expect(distributeStudents(73, 3, 28)).toEqual([25, 24, 24]);
    expect(() => distributeStudents(73, 2, 28)).toThrow("کافی نیست");
  });

  it("ارقام فارسی و الگوی جلسه را می‌پذیرد", () => {
    expect(normalizeDigits("۱۴۰۵")).toBe("1405");
    expect(parseSessionPattern("۲ + ۱")).toEqual([2, 1]);
  });

  it("جمع و تعداد بخش‌های session pattern را enforce می‌کند", () => {
    expect(validateSessionPattern(4, 2, [2, 2])).toBeNull();
    expect(validateSessionPattern(4, 2, [3, 2])).toContain("مجموع");
    expect(validateSessionPattern(4, 3, [2, 2])).toContain("تعداد");
  });

  it("workload curriculum را از تعداد کلاس محاسبه می‌کند", () => {
    expect(calculateCurriculumWorkload(10, 4)).toBe(40);
  });

  it("ترتیب workload و محدودیت روزانه را بررسی می‌کند", () => {
    expect(validateWorkload({ minimum: 20, required: 24, maximum: 28, overtime: 4, dailyMinimum: 1, dailyMaximum: 6, maxConsecutive: 3 })).toBeNull();
    expect(validateWorkload({ minimum: 25, required: 24, maximum: 28, overtime: 0, dailyMinimum: 0, dailyMaximum: 6, maxConsecutive: 3 })).toContain("به‌ترتیب");
  });

  it("حضور را فقط برای period معتبر و status شناخته‌شده می‌پذیرد", () => {
    const periods = new Set(["p1", "p2"]);
    expect(validateAvailability({ p1: "AVAILABLE", p2: "PREFERRED" }, periods)).toBeNull();
    expect(validateAvailability({ foreign: "AVAILABLE" }, periods)).toContain("متعلق");
    expect(validateAvailability({ p1: "UNKNOWN" }, periods)).toContain("وضعیت");
  });
});
