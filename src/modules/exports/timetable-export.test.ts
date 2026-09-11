// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createExcelWorkbook, createPersianPdf } from "./timetable-export";
import { parseExportQuery } from "./load-export";

const model = {
  title: "برنامه هفتگی کلاس دهم تجربی ۱",
  subtitle: "سال تحصیلی ۱۴۰۵–۱۴۰۶ · نسخه ۱",
  rows: [{ day: "شنبه", period: "زنگ ۱", time: "۰۷:۳۰ تا ۰۸:۱۵", className: "دهم تجربی ۱", subject: "زبان انگلیسی", teacher: "ابوالفضل جمشیدی" }],
};

describe("خروجی فارسی برنامه", () => {
  it("Excel سازگار، UTF-8 و راست‌به‌چپ تولید می‌کند", () => {
    const xml = new TextDecoder().decode(createExcelWorkbook(model));
    expect(xml).toContain("DisplayRightToLeft");
    expect(xml).toContain("برنامه هفتگی کلاس دهم تجربی ۱");
    expect(xml).toContain("زبان انگلیسی");
  });

  it("PDF واقعی با فونت فارسی embed می‌کند", async () => {
    const pdf = await createPersianPdf(model);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
  });

  it("query مبهم، شناسه نامعتبر و فیلتر ناسازگار را رد می‌کند", () => {
    const workspace = "40000000-0000-4000-8000-000000000001";
    const version = "50000000-0000-4000-8000-000000000001";
    expect(() => parseExportQuery(new URL(`http://localhost/api?workspace=${workspace}&version=${version}&view=school`))).toThrow("منبع برنامه");
    expect(() => parseExportQuery(new URL("http://localhost/api?workspace=bad&view=school"))).toThrow("منبع برنامه");
    expect(() => parseExportQuery(new URL(`http://localhost/api?workspace=${workspace}&view=class`))).toThrow("کلاس یا دبیر");
    expect(() => parseExportQuery(new URL(`http://localhost/api?workspace=${workspace}&view=unknown`))).toThrow("نوع نمای خروجی");
  });
});
