// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AuthRepository, LoginIdentity, SchoolMembershipView } from "./repository";
import { hashPassword } from "./password";
import { authenticate, resolveTenantSession, revokeTenantSession } from "./service";
import { hashSessionToken } from "./session-token";
import type { TenantContext } from "@/modules/tenancy/types";

function fakeRepository(identity: LoginIdentity | null) {
  const created: Parameters<AuthRepository["createSession"]>[0][] = [];
  const contexts = new Map<string, TenantContext>();
  let revokedHash: string | undefined;
  const memberships: SchoolMembershipView[] = identity?.memberships ?? [];
  const repository: AuthRepository = {
    findLoginIdentity: async () => identity,
    createSession: async (input) => { created.push(input); },
    resolveSession: async (hash) => contexts.get(hash) ?? null,
    revokeSession: async (hash) => { revokedHash = hash; return true; },
    listUserSchools: async () => memberships,
    switchActiveSchool: async () => false,
  };
  return { repository, created, contexts, getRevokedHash: () => revokedHash };
}

describe("سرویس ورود و نشست", () => {
  it("ورودی نامعتبر را پیش از repository رد می‌کند", async () => {
    const { repository, created } = fakeRepository(null);
    const result = await authenticate({ email: "bad", password: "1" }, repository);
    expect(result.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("نشست opaque می‌سازد و فقط digest آن را ذخیره می‌کند", async () => {
    const passwordHash = await hashPassword("Demo123!");
    const { repository, created } = fakeRepository({ userId: "u1", fullName: "مدیر", passwordHash, memberships: [{ schoolId: "s1", schoolName: "مدرسه", schoolCode: null, role: "ADMIN" }] });
    const result = await authenticate({ email: "ADMIN@MADRESEYAR.IR ", password: "Demo123!" }, repository, new Date("2026-09-10T00:00:00Z"));
    expect(result.ok).toBe(true);
    expect(created).toHaveLength(1);
    if (result.ok) {
      expect(created[0].tokenHash).toBe(hashSessionToken(result.token));
      expect(created[0].tokenHash).not.toContain(result.token);
      expect(created[0].activeSchoolId).toBe("s1");
    }
  });

  it("پیام یکسان برای حساب ناشناخته و رمز نادرست برمی‌گرداند", async () => {
    const unknown = await authenticate({ email: "none@example.com", password: "Wrong123!" }, fakeRepository(null).repository);
    const passwordHash = await hashPassword("Demo123!");
    const wrong = await authenticate({ email: "admin@example.com", password: "Wrong123!" }, fakeRepository({ userId: "u", fullName: "مدیر", passwordHash, memberships: [{ schoolId: "s", schoolName: "مدرسه", schoolCode: null, role: "ADMIN" }] }).repository);
    expect(unknown.ok).toBe(false);
    expect(wrong.ok).toBe(false);
    if (!unknown.ok && !wrong.ok) expect(unknown.message).toBe(wrong.message);
  });

  it("resolve و revoke همیشه با hash token کار می‌کنند", async () => {
    const { repository, contexts, getRevokedHash } = fakeRepository(null);
    const token = "a".repeat(43);
    const context: TenantContext = { sessionId: "x", userId: "u", userName: "مدیر", schoolId: "s", schoolName: "مدرسه", schoolCode: null, role: "ADMIN" };
    contexts.set(hashSessionToken(token), context);
    await expect(resolveTenantSession(token, repository)).resolves.toEqual(context);
    await expect(revokeTenantSession(token, repository)).resolves.toBe(true);
    expect(getRevokedHash()).toBe(hashSessionToken(token));
  });
});
