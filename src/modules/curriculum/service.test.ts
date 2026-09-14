import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/modules/tenancy/types";
import type { CurriculumRepository } from "./repository";
import { saveCurriculumItem } from "./service";

const context: TenantContext = { sessionId: "s", userId: "u", userName: "معاون", schoolId: "school-a", schoolName: "الف", schoolCode: null, role: "VICE_PRINCIPAL" };
const ids = { year: "30000000-0000-4000-8000-000000000001", grade: "31000000-0000-4000-8000-000000000001", subject: "34000000-0000-4000-8000-000000000001" };

describe("برنامه درسی", () => {
  it("pattern منعطف را ذخیره می‌کند", async () => {
    const repository = { resolveScope: vi.fn(async () => ({ valid: true })), saveItem: vi.fn() } as unknown as CurriculumRepository;
    const result = await saveCurriculumItem(context, { academicYearId: ids.year, gradeId: ids.grade, majorId: "", subjectId: ids.subject, weeklyHours: "۳", sessionCount: "۲", sessionPattern: "۲ + ۱" }, repository);
    expect(result.status).toBe("success");
    expect(repository.saveItem).toHaveBeenCalledWith(context, expect.objectContaining({ weeklyHours: 3, sessionCount: 2, sessionPattern: [2, 1] }));
  });

  it("pattern ناسازگار را پیش از repository رد می‌کند", async () => {
    const repository = { resolveScope: vi.fn(), saveItem: vi.fn() } as unknown as CurriculumRepository;
    const result = await saveCurriculumItem(context, { academicYearId: ids.year, gradeId: ids.grade, majorId: "", subjectId: ids.subject, weeklyHours: 4, sessionCount: 2, sessionPattern: "۳+۲" }, repository);
    expect(result.status).toBe("error");
    expect(repository.saveItem).not.toHaveBeenCalled();
  });
});
