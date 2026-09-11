import { describe, expect, it, vi } from "vitest";
import type { SchoolRepository } from "./repository";
import { updateSchoolProfile } from "./service";
import type { TenantContext } from "@/modules/tenancy/types";

const baseContext: TenantContext = { sessionId: "session", userId: "user", userName: "مدیر", schoolId: "school-a", schoolName: "الف", schoolCode: null, role: "ADMIN" };

describe("ویرایش مدرسه", () => {
  it("schoolId را فقط از context می‌گیرد و ورودی را پاک‌سازی می‌کند", async () => {
    const updateProfile = vi.fn(async (context, changes) => ({ id: context.schoolId, ...changes }));
    const repository = { getProfile: vi.fn(), updateProfile } as unknown as SchoolRepository;
    const result = await updateSchoolProfile(baseContext, { name: "  مدرسه الف  ", code: "", province: "تهران", city: "تهران", phone: "۰۲۱-۴۴۰۰۰۰۰۰", schoolId: "school-b" }, repository);
    expect(result.status).toBe("success");
    expect(updateProfile).toHaveBeenCalledWith(baseContext, expect.objectContaining({ name: "مدرسه الف", code: null }), expect.any(Date));
  });

  it("معاون را از تغییر تنظیمات مدرسه منع می‌کند", async () => {
    const repository = { getProfile: vi.fn(), updateProfile: vi.fn() } as unknown as SchoolRepository;
    await expect(updateSchoolProfile({ ...baseContext, role: "VICE_PRINCIPAL" }, { name: "مدرسه الف", code: "", province: "", city: "", phone: "" }, repository)).rejects.toThrow(/اجازه/);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });
});
