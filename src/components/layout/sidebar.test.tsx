import { describe, expect, it } from "vitest";
import { navigationItems } from "./sidebar";

describe("معماری اطلاعات منوی اصلی", () => {
  it("فقط پنج مقصد اصلی دارد", () => {
    expect(navigationItems.map((item) => item.label)).toEqual([
      "داشبورد",
      "برنامه‌ریزی",
      "دبیران",
      "برنامه هفتگی",
      "تنظیمات",
    ]);
  });

  it("entityها و ابزارهای زمینه‌ای را وارد منوی اصلی نمی‌کند", () => {
    const labels = navigationItems.map((item) => item.label).join(" ");
    for (const forbidden of ["پایه", "رشته", "کلاس", "دروس", "حضور", "اعتبارسنجی", "مرکز بررسی", "خروجی"]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("مقصد برنامه هفتگی را فقط پس از پیاده‌سازی workspace فعال می‌کند", () => {
    expect(navigationItems.filter((item) => item.available).map((item) => item.href)).toEqual(["/", "/planning", "/teachers", "/timetable", "/settings"]);
    expect(navigationItems.find((item) => item.href === "/timetable")?.available).toBe(true);
  });
});
