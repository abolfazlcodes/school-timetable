import { describe, expect, it } from "vitest";
import { resolveSeedIdentity, resolveSeedProfile } from "../../../scripts/seed-profile";

describe("delivery seed profile", () => {
  it("keeps the current demo credentials as local defaults", () => {
    expect(resolveSeedProfile(undefined)).toBe("demo");
    expect(resolveSeedIdentity("demo", {})).toMatchObject({
      admin: { email: "admin@madreseyar.ir" },
      vicePrincipal: { email: "moaven@madreseyar.ir" },
    });
  });

  it("creates distinct admin and Hamid Bagheri identities from secrets", () => {
    expect(resolveSeedIdentity("shahid-beheshti", {
      SEED_ADMIN_EMAIL: "OWNER@EXAMPLE.COM",
      SEED_ADMIN_PASSWORD: "admin-password-1405",
      SEED_VICE_PRINCIPAL_EMAIL: "MOAVEN@EXAMPLE.COM",
      SEED_VICE_PRINCIPAL_PASSWORD: "vice-password-1405",
    })).toEqual({
      admin: {
        email: "owner@example.com",
        fullName: "مدیر سامانه",
        password: "admin-password-1405",
      },
      vicePrincipal: {
        email: "moaven@example.com",
        fullName: "حمید باقری",
        password: "vice-password-1405",
      },
    });
  });

  it("rejects missing, short, shared, or unknown delivery configuration", () => {
    expect(() => resolveSeedIdentity("shahid-beheshti", {})).toThrow("SEED_ADMIN_EMAIL");
    expect(() => resolveSeedIdentity("shahid-beheshti", {
      SEED_ADMIN_EMAIL: "owner@example.com",
      SEED_ADMIN_PASSWORD: "short",
      SEED_VICE_PRINCIPAL_EMAIL: "moaven@example.com",
      SEED_VICE_PRINCIPAL_PASSWORD: "vice-password-1405",
    })).toThrow("حداقل ۱۲ نویسه");
    expect(() => resolveSeedIdentity("shahid-beheshti", {
      SEED_ADMIN_EMAIL: "same@example.com",
      SEED_ADMIN_PASSWORD: "shared-password",
      SEED_VICE_PRINCIPAL_EMAIL: "same@example.com",
      SEED_VICE_PRINCIPAL_PASSWORD: "other-password",
    })).toThrow("ایمیل مدیر و معاون");
    expect(() => resolveSeedProfile("production")).toThrow("SEED_PROFILE نامعتبر");
  });
});
