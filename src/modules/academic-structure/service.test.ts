import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/modules/tenancy/types";
import type { AcademicStructureRepository } from "./repository";
import { addPeriod, saveClassPlan } from "./service";

const context: TenantContext = { sessionId: "s", userId: "u", userName: "مدیر", schoolId: "school-a", schoolName: "الف", schoolCode: null, role: "ADMIN" };
const ids = { year: "30000000-0000-4000-8000-000000000001", grade: "31000000-0000-4000-8000-000000000001", major: "32000000-0000-4000-8000-000000000001", day: "36000000-0000-4000-8000-000000000001" };

function repository(overrides: Partial<AcademicStructureRepository> = {}) {
  return { resolveClassScope: vi.fn(async () => ({ yearTitle: "۱۴۰۵", gradeName: "دهم", majorName: "تجربی" })), saveClassPlan: vi.fn(), getWorkspace: vi.fn(async () => ({ academicYears: [], activeAcademicYear: { id: ids.year, title: "۱۴۰۵", startYear: 1405, endYear: 1406, isActive: true }, grades: [], majors: [], classPlans: [], schoolDays: [{ id: ids.day, dayOfWeek: 0, label: "شنبه", sortOrder: 0, isActive: true, periods: [{ id: "p1", position: 1, label: "زنگ ۱", startTime: "07:30:00", endTime: "08:15:00", breakAfterMinutes: 5, isActive: true }] }] })), addPeriod: vi.fn(async () => true), ...overrides } as unknown as AcademicStructureRepository;
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

  it("تداخل زمانی زنگ‌های یک روز را رد می‌کند", async () => {
    const repo = repository();
    const result = await addPeriod(context, { academicYearId: ids.year, schoolDayId: ids.day, position: 2, label: "زنگ ۲", startTime: "08:00", endTime: "08:45", breakAfterMinutes: 5 }, repo);
    expect(result).toMatchObject({ status: "error" });
    expect(repo.addPeriod).not.toHaveBeenCalled();
  });

  it("زمان نامعتبر و عدد منفی فارسی را پیش از repository رد می‌کند", async () => {
    const repo = repository();
    const invalidTime = await addPeriod(context, { academicYearId: ids.year, schoolDayId: ids.day, position: 2, label: "زنگ ۲", startTime: "25:00", endTime: "26:00", breakAfterMinutes: 5 }, repo);
    const invalidCount = await saveClassPlan(context, { academicYearId: ids.year, gradeId: ids.grade, majorId: ids.major, studentCount: "−۷۳", maxClassCapacity: "۲۸", classCountOverride: "" }, repo);
    expect(invalidTime.status).toBe("error");
    expect(invalidCount.status).toBe("error");
    expect(repo.addPeriod).not.toHaveBeenCalled();
    expect(repo.saveClassPlan).not.toHaveBeenCalled();
  });
});
