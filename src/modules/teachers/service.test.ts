import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/modules/tenancy/types";
import type { TeacherRepository } from "./repository";
import { saveTeacherAvailability, saveTeacherProfile, saveTeacherSubjects } from "./service";

const context: TenantContext = { sessionId: "s", userId: "u", userName: "معاون", schoolId: "school-a", schoolName: "الف", schoolCode: null, role: "VICE_PRINCIPAL" };
const ids = { year: "30000000-0000-4000-8000-000000000001", teacher: "35000000-0000-4000-8000-000000000001", subject: "34000000-0000-4000-8000-000000000001", day: "36000000-0000-4000-8000-000000000001", period: "37000000-0000-4000-8000-000000000001" };

describe("دبیر، موظفی و حضور", () => {
  it("رابطه چنددرس را به repository واگذار می‌کند", async () => {
    const repository = { saveSubjects: vi.fn(async () => true) } as unknown as TeacherRepository;
    const result = await saveTeacherSubjects(context, { teacherId: ids.teacher, subjectIds: [ids.subject] }, repository);
    expect(result.status).toBe("success");
    expect(repository.saveSubjects).toHaveBeenCalledWith(context, ids.teacher, [ids.subject]);
  });

  it("درس تکراری را پیش از mutation رد می‌کند", async () => {
    const repository = { saveSubjects: vi.fn() } as unknown as TeacherRepository;
    const result = await saveTeacherSubjects(context, { teacherId: ids.teacher, subjectIds: [ids.subject, ids.subject] }, repository);
    expect(result.status).toBe("error");
    expect(repository.saveSubjects).not.toHaveBeenCalled();
  });

  it("workload نامرتب را رد می‌کند", async () => {
    const repository = { saveProfile: vi.fn() } as unknown as TeacherRepository;
    const result = await saveTeacherProfile(context, { teacherId: ids.teacher, academicYearId: ids.year, minimumWorkload: 25, requiredWorkload: 24, maximumWorkload: 28, overtimeAllowance: 4, dailyMinimum: 0, dailyMaximum: 6, maxConsecutive: 3 }, repository);
    expect(result.status).toBe("error");
    expect(repository.saveProfile).not.toHaveBeenCalled();
  });

  it("تمام slotهای جدول حضور را با شناسه روز ذخیره می‌کند", async () => {
    const repository = { getWorkspace: vi.fn(async () => ({ activeAcademicYear: { id: ids.year, title: "۱۴۰۵" }, teachers: [], selectedTeacher: { id: ids.teacher }, subjects: [], schoolDays: [{ id: ids.day, label: "شنبه", sortOrder: 0, periods: [{ id: ids.period, schoolDayId: ids.day, position: 1, label: "زنگ ۱", startTime: "07:30", endTime: "08:15" }] }] })), saveAvailability: vi.fn(async () => true) } as unknown as TeacherRepository;
    const result = await saveTeacherAvailability(context, { teacherId: ids.teacher, academicYearId: ids.year, statuses: { [ids.period]: "PREFERRED" } }, repository);
    expect(result.status).toBe("success");
    expect(repository.saveAvailability).toHaveBeenCalledWith(context, ids.year, ids.teacher, [{ periodId: ids.period, schoolDayId: ids.day, status: "PREFERRED" }]);
  });
});
