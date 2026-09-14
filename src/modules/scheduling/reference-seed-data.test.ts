// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultPattern, referenceClasses, referenceCurriculum, referenceTeachers } from "../../../scripts/reference-school-data";

describe("داده مرجع قابل seed مدرسه", () => {
  it("نیاز curriculum و تخصیص یازده دبیر هر دو دقیقاً ۱۸۹ ساعت‌اند", () => {
    const assignedBySubject = new Map<string, number>();
    for (const teacher of referenceTeachers) for (const [subject, hours] of Object.entries(teacher.assignments)) assignedBySubject.set(subject, (assignedBySubject.get(subject) ?? 0) + hours);
    const classCountByScope = new Map<string, number>();
    for (const schoolClass of referenceClasses) classCountByScope.set(`${schoolClass.grade}:${schoolClass.major}`, (classCountByScope.get(`${schoolClass.grade}:${schoolClass.major}`) ?? 0) + 1);
    const requiredBySubject = new Map<string, number>();
    for (const item of referenceCurriculum) requiredBySubject.set(item.subject, (requiredBySubject.get(item.subject) ?? 0) + item.hours * (classCountByScope.get(`${item.grade}:${item.major}`) ?? 0));
    expect(referenceTeachers).toHaveLength(11);
    expect([...assignedBySubject.values()].reduce((sum, hours) => sum + hours, 0)).toBe(189);
    expect([...requiredBySubject.values()].reduce((sum, hours) => sum + hours, 0)).toBe(189);
    expect(Object.fromEntries(requiredBySubject)).toEqual(Object.fromEntries(assignedBySubject));
  });

  it("الگوهای session معتبرند و هیچ کلاس از ۲۰ زنگ هفتگی عبور نمی‌کند", () => {
    const sessionsByScope = new Map<string, number>();
    for (const item of referenceCurriculum) {
      const pattern = item.pattern ?? defaultPattern(item.hours);
      expect(pattern.reduce((sum, hours) => sum + hours, 0)).toBe(item.hours);
      const key = `${item.grade}:${item.major}`;
      sessionsByScope.set(key, (sessionsByScope.get(key) ?? 0) + pattern.length);
    }
    expect(Math.max(...sessionsByScope.values())).toBeLessThanOrEqual(20);
  });
});
