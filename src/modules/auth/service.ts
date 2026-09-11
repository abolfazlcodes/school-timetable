import { z } from "zod";
import type { AuthRepository } from "./repository";
import { hashPassword, verifyPassword } from "./password";
import { hashSessionToken, newSessionIdentity } from "./session-token";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("نشانی ایمیل معتبر وارد کنید."),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ نویسه باشد.").max(128, "رمز عبور بیش از حد طولانی است."),
});

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; fieldErrors?: { email?: string[]; password?: string[] }; message: string };

let dummyPasswordHash: Promise<string> | undefined;

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword("invalid-account-password");
  return dummyPasswordHash;
}

export async function authenticate(input: unknown, repository: AuthRepository, now = new Date()): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors, message: "اطلاعات ورود را بررسی کنید." };
  }

  const identity = await repository.findLoginIdentity(parsed.data.email);
  const passwordHash = identity?.passwordHash ?? await getDummyPasswordHash();
  const passwordIsValid = await verifyPassword(parsed.data.password, passwordHash);
  if (!identity || !passwordIsValid || identity.memberships.length === 0) {
    return { ok: false, message: "ایمیل یا رمز عبور صحیح نیست." };
  }

  const session = newSessionIdentity(now);
  await repository.createSession({
    id: session.id,
    tokenHash: hashSessionToken(session.token),
    userId: identity.userId,
    activeSchoolId: identity.memberships[0].schoolId,
    expiresAt: session.expiresAt,
    now,
  });
  return { ok: true, token: session.token, expiresAt: session.expiresAt };
}

export async function resolveTenantSession(token: string | undefined, repository: AuthRepository, now = new Date()) {
  if (!token || token.length < 32 || token.length > 128) return null;
  return repository.resolveSession(hashSessionToken(token), now);
}

export async function revokeTenantSession(token: string | undefined, repository: AuthRepository, now = new Date()) {
  if (!token) return false;
  return repository.revokeSession(hashSessionToken(token), now);
}
