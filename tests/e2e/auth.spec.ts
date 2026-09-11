import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill("Demo123!");
  await page.getByRole("button", { name: "ورود به سامانه" }).click();
  await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();
}

test("کاربر ناشناس به ورود هدایت می‌شود", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?from=%2Fsettings$/);
  await expect(page.getByRole("heading", { name: "ورود به پنل مدرسه" })).toBeVisible();
});

test("خروجی محافظت‌شده بدون نشست به ورود هدایت می‌شود", async ({ page }) => {
  const response = await page.request.get("/api/timetable/export/pdf?workspace=40000000-0000-4000-8000-000000000001&view=school", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/login");
});

test("مدیر وارد می‌شود، مدرسه را تغییر می‌دهد، تنظیمات را ذخیره می‌کند و خارج می‌شود", async ({ page, context }) => {
  await login(page, "admin@madreseyar.ir");
  const session = (await context.cookies()).find((cookie) => cookie.name === "school_panel_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");

  await page.getByRole("link", { name: "تنظیمات" }).click();
  await page.getByLabel("شهر").fill("تهران");
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  await expect(page.getByText("اطلاعات مدرسه ذخیره شد.")).toBeVisible();

  const schoolSelect = page.getByLabel("انتخاب مدرسه فعال");
  const currentSchool = await schoolSelect.inputValue();
  const targetSchool = await schoolSelect.locator("option").evaluateAll((options, selected) => options.find((option) => (option as HTMLOptionElement).value !== selected)?.getAttribute("value") ?? "", currentSchool);
  expect(targetSchool).not.toBe("");
  await schoolSelect.selectOption(targetSchool);
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("انتخاب مدرسه فعال")).toHaveValue(targetSchool);

  await page.getByRole("button", { name: "خروج از سامانه" }).click();
  await expect(page.getByRole("heading", { name: "ورود به پنل مدرسه" })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name === "school_panel_session")).toBe(false);
});

test("معاون مشخصات مدرسه را می‌بیند اما امکان ویرایش ندارد", async ({ page }) => {
  await login(page, "moaven@madreseyar.ir");
  await page.getByRole("link", { name: "تنظیمات" }).click();
  await expect(page.getByText("ویرایش مشخصات مدرسه فقط برای مدیر مدرسه مجاز است.")).toBeVisible();
  await expect(page.getByLabel("نام مدرسه")).toBeDisabled();
  await expect(page.getByRole("button", { name: "ذخیره تغییرات" })).toHaveCount(0);
});
