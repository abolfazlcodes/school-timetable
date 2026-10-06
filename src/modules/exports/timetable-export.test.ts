// @vitest-environment node
import { describe, expect, it } from "vitest";
import { makeProblem } from "@/modules/scheduling/fixtures.test-helper";
import type { TimetableViewData } from "@/modules/timetable/service";
import { buildSchoolTimetablePages, buildTimetableExport, createExcelWorkbook, createPersianPdf } from "./timetable-export";
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

  it("PDF کل مدرسه برای هر رشته یک صفحه A4 افقی و همان جدول برنامه می‌سازد", async () => {
    const problem = makeProblem();
    problem.classes = [
      { ...problem.classes[0], id: "c-math", name: "دهم ریاضی", gradeId: "g10", gradeName: "دهم", majorId: "m-math", majorName: "ریاضی" },
      { ...problem.classes[1], id: "c-science", name: "یازدهم تجربی", gradeId: "g11", gradeName: "یازدهم", majorId: "m-science", majorName: "علوم تجربی" },
      { ...problem.classes[0], id: "c-humanities", name: "دوازدهم انسانی", gradeId: "g12", gradeName: "دوازدهم", majorId: "m-humanities", majorName: "ادبیات و علوم انسانی" },
    ];
    problem.curriculum = [
      { ...problem.curriculum[0], id: "r-math", classId: "c-math", className: "دهم ریاضی" },
      { ...problem.curriculum[1], id: "r-science", classId: "c-science", className: "یازدهم تجربی" },
    ];
    const data = {
      mode: "workspace",
      workspaceId: "40000000-0000-4000-8000-000000000001",
      revision: 0,
      source: { candidateId: "50000000-0000-4000-8000-000000000001", runId: "60000000-0000-4000-8000-000000000001", rank: 1, score: 10_000 },
      academicYearTitle: problem.academicYearTitle,
      generatedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      problem,
      assignments: [
        { sessionId: "r-math:1", curriculumId: "r-math", classId: "c-math", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"], weekPattern: "WEEK_A" },
        { sessionId: "r-science:1", curriculumId: "r-science", classId: "c-science", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 2, periodIds: ["su-2"] },
      ],
      issues: [],
      version: null,
      versions: [],
    } satisfies TimetableViewData;

    const pages = buildSchoolTimetablePages(data);
    expect(pages.map((page) => page.majorName)).toEqual([
      "علوم تجربی",
      "ریاضی",
      "ادبیات و علوم انسانی",
    ]);
    expect(pages[0].classes.map((item) => item.name)).toEqual(["یازدهم تجربی"]);
    expect(Object.values(pages[0].cells).flatMap((cell) => cell.lessons).map((lesson) => lesson.subject)).toContain("ریاضی");
    expect(Object.values(pages[2].cells).every((cell) => cell.lessons.length === 0)).toBe(true);

    const pdf = await createPersianPdf(buildTimetableExport(data, "school"));
    const source = Buffer.from(pdf).toString("latin1");
    expect(source.match(/\/Type \/Page\b/g)).toHaveLength(3);
    expect(source.match(/\/MediaBox \[0 0 841\.89 595\.28\]/g)).toHaveLength(3);
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });

  it("نوبت هفته جلسه یک‌هفته‌درمیان را در خروجی حفظ می‌کند", () => {
    const problem = makeProblem();
    const data = {
      mode: "workspace",
      workspaceId: "40000000-0000-4000-8000-000000000001",
      revision: 0,
      source: { candidateId: "50000000-0000-4000-8000-000000000001", runId: "60000000-0000-4000-8000-000000000001", rank: 1, score: 10_000 },
      academicYearTitle: problem.academicYearTitle,
      generatedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      problem,
      assignments: [{ sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"], weekPattern: "WEEK_A" }],
      issues: [],
      version: null,
      versions: [],
    } satisfies TimetableViewData;
    expect(buildTimetableExport(data, "class", "c1").rows[0].period).toContain("هفته اول");
  });
});
