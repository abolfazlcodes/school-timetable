// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { schoolMemberships, schools, sessions, users } from "@/db/schema";
import { createAuthRepository } from "@/modules/auth/repository";
import { hashSessionToken } from "@/modules/auth/session-token";
import { createSchoolRepository } from "@/modules/schools/repository";
import type { TenantContext } from "./types";

const ids = {
  userA: "10000000-0000-4000-8000-000000000001",
  userB: "10000000-0000-4000-8000-000000000002",
  schoolA: "20000000-0000-4000-8000-000000000001",
  schoolB: "20000000-0000-4000-8000-000000000002",
  sessionA: "30000000-0000-4000-8000-000000000001",
  forbiddenSession: "30000000-0000-4000-8000-000000000002",
};

describe("جداسازی واقعی داده دو مدرسه", () => {
  it("membership، session و repository مانع دسترسی متقاطع می‌شوند", async () => {
    const client = new PGlite();
    try {
      const migration = await readFile(new URL("../../../migrations/0000_auth_and_schools.sql", import.meta.url), "utf8");
      await client.exec(migration);
      const db = drizzle(client, { schema });
      await db.insert(users).values([
        { id: ids.userA, email: "a@example.com", fullName: "مدیر الف", passwordHash: "hash" },
        { id: ids.userB, email: "b@example.com", fullName: "مدیر ب", passwordHash: "hash" },
      ]);
      await db.insert(schools).values([
        { id: ids.schoolA, name: "مدرسه الف", code: "A" },
        { id: ids.schoolB, name: "مدرسه ب", code: "B" },
      ]);
      await db.insert(schoolMemberships).values([
        { userId: ids.userA, schoolId: ids.schoolA, role: "ADMIN" },
        { userId: ids.userB, schoolId: ids.schoolB, role: "ADMIN" },
      ]);

      const authRepository = createAuthRepository(db);
      const token = "valid-opaque-token-for-school-a-123456789";
      await authRepository.createSession({ id: ids.sessionA, tokenHash: hashSessionToken(token), userId: ids.userA, activeSchoolId: ids.schoolA, expiresAt: new Date("2026-09-20T00:00:00Z"), now: new Date("2026-09-10T00:00:00Z") });
      const context = await authRepository.resolveSession(hashSessionToken(token), new Date("2026-09-11T00:00:00Z"));
      expect(context).toMatchObject({ userId: ids.userA, schoolId: ids.schoolA, role: "ADMIN" });

      await expect(authRepository.switchActiveSchool({ sessionId: ids.sessionA, userId: ids.userA, schoolId: ids.schoolB, now: new Date("2026-09-11T00:00:00Z") })).resolves.toBe(false);
      await expect(db.insert(sessions).values({ id: ids.forbiddenSession, tokenHash: "f".repeat(64), userId: ids.userA, activeSchoolId: ids.schoolB, expiresAt: new Date("2026-09-20T00:00:00Z") })).rejects.toThrow();

      const tenantA = context as TenantContext;
      const schoolRepository = createSchoolRepository(db);
      await schoolRepository.updateProfile(tenantA, { name: "مدرسه الف ویرایش‌شده", code: "A", province: null, city: null, phone: null }, new Date("2026-09-11T00:00:00Z"));
      const [schoolA] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, ids.schoolA));
      const [schoolB] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, ids.schoolB));
      expect(schoolA.name).toBe("مدرسه الف ویرایش‌شده");
      expect(schoolB.name).toBe("مدرسه ب");

      await expect(authRepository.revokeSession(hashSessionToken(token), new Date("2026-09-11T01:00:00Z"))).resolves.toBe(true);
      await expect(authRepository.resolveSession(hashSessionToken(token), new Date("2026-09-11T02:00:00Z"))).resolves.toBeNull();
    } finally {
      await client.close();
    }
  }, 20_000);
});
