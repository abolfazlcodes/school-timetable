// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("رمز عبور", () => {
  it("رمز را با salt مستقل hash و به‌صورت ثابت بررسی می‌کند", async () => {
    const first = await hashPassword("Secret123!");
    const second = await hashPassword("Secret123!");
    expect(first).not.toBe(second);
    await expect(verifyPassword("Secret123!", first)).resolves.toBe(true);
    await expect(verifyPassword("Wrong123!", first)).resolves.toBe(false);
  });

  it("hash خراب را ایمن رد می‌کند", async () => {
    await expect(verifyPassword("Secret123!", "invalid")).resolves.toBe(false);
  });
});
