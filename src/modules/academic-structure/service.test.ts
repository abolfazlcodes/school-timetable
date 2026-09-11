import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/modules/tenancy/types";
import type { AcademicStructureRepository } from "./repository";
import { saveClassPlan, saveSchoolDaySchedule } from "./service";
import { calculateAutomaticTimeline } from "./school-day-timeline";

const context: TenantContext = { sessionId: "s", userId: "u", userName: "مدیر", schoolId: "school-a", schoolName: "الف", schoolCode: null, role: "ADMIN" };
const ids = { year: "30000000-0000-4000-8000-000000000001", grade: "31000000-0000-4000-8000-000000000001", major: "32000000-0000-4000-8000-000000000001", day: "36000000-0000-4000-8000-000000000001" };

function repository(overrides: Partial<AcademicStructureRepository> = {}) {
  return { resolveClassScope: vi.fn(async () => ({ yearTitle: "۱۴۰۵", gradeName: "دهم", majorName: "تجربی" })), saveClassPlan: vi.fn(), saveDaySchedule: vi.fn(async () => true), ...overrides } as unknown as AcademicStructureRepository;
}

describe("مدیریت ساختار مدرسه", () => {
  it("پیشنهاد ۷۳/۲۸ را به سه کلاس و توزیع معتبر تبدیل می‌کند", async () => {
    const repo = repository();
    const result = await saveClassPlan(context, { academicYearId: ids.year, gradeId: ids.grade, majorId: ids.major, studentCount: "۷۳", maxClassCapacity: "۲۸", classCountOverride: "" }, repo);
    expect(result.status).toBe("success");
    expect(repo.saveClassPlan).toHaveBeenCalledWith(context, expect.objectContaining({ groups: [expect.objectContaining({ studentCount: 25 }), expect.objectContaining({ studentCount: 24 }), expect.objectContaining({ studentCount: 24 })] }));
  });

  it("override ناکافی را رد می‌کند", async () => {
    const repo = repository();
    const result = await saveClassPlan(context, { academicYearId: ids.year, gradeId: ids.grade, majorId: ids.major, studentCount: 73, maxClassCapacity: 28, classCountOverride: 2 }, repo);
    expect(result.status).toBe("error");
    expect(repo.saveClassPlan).not.toHaveBeenCalled();
  });

  it("timeline معتبر را یکجا ذخیره می‌کند", async () => {
    const repo = repository();
    const timeline = calculateAutomaticTimeline({ startTime: "08:00", endTime: "13:20", periodCount: 4, defaultBreakMinutes: 10 });
    const result = await saveSchoolDaySchedule(context, { ...timeline, academicYearId: ids.year, schoolDayId: ids.day }, repo);
    expect(result.status).toBe("success");
    expect(repo.saveDaySchedule).toHaveBeenCalledWith(context, ids.year, ids.day, expect.objectContaining({ periodCount: 4 }));
  });

  it("timeline هم‌پوشان را پیش از repository رد می‌کند", async () => {
    const repo = repository();
    const timeline = calculateAutomaticTimeline({ startTime: "08:00", endTime: "12:30", periodCount: 4, defaultBreakMinutes: 10 });
    timeline.periods[1].startTime = "08:30";
    const invalidTime = await saveSchoolDaySchedule(context, { ...timeline, academicYearId: ids.year, schoolDayId: ids.day }, repo);
    const invalidCount = await saveClassPlan(context, { academicYearId: ids.year, gradeId: ids.grade, majorId: ids.major, studentCount: "−۷۳", maxClassCapacity: "۲۸", classCountOverride: "" }, repo);
    expect(invalidTime.status).toBe("error");
    expect(invalidCount.status).toBe("error");
    expect(repo.saveDaySchedule).not.toHaveBeenCalled();
    expect(repo.saveClassPlan).not.toHaveBeenCalled();
  });
});
