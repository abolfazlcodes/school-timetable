import { createHash, randomBytes, randomUUID } from "node:crypto";

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_SESSION_COOKIE = "school_panel_session";

export function createOpaqueSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionIdentity(now = new Date()) {
  return {
    id: randomUUID(),
    token: createOpaqueSessionToken(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  };
}

export function sessionCookieName() {
  return process.env.SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE;
}
