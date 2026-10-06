import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill("admin@madreseyar.ir");
  await page.getByLabel("رمز عبور").fill("Demo123!");
  await page.getByRole("button", { name: "ورود به سامانه" }).click();
  await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();
  const schoolSelect = page.getByLabel("انتخاب مدرسه فعال");
  if (await schoolSelect.inputValue() !== "20000000-0000-4000-8000-000000000001") {
    await schoolSelect.selectOption("20000000-0000-4000-8000-000000000001");
    await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
    await page.waitForLoadState("networkidle");
  }
}

async function capture(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo, name: string) {
  if (process.env.VISUAL_REVIEW === "1") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  }
}

test("پیکربندی فشرده ساعات، timeline دستی و محاسبه خودکار قابل استفاده است", async ({ page }) => {
  await login(page);
  await page.goto("/planning?step=structure");
  const saturday = page.locator(".day-schedule-card").filter({ has: page.getByText("شنبه", { exact: true }) }).first();
  await expect(saturday).toHaveAttribute("open", "");
  await expect(saturday.getByLabel("برنامه زنگ‌های شنبه")).toContainText("۷۵ دقیقه");
  await expect(saturday.getByLabel("برنامه زنگ‌های شنبه")).toContainText("۸۰ دقیقه");
  await expect(saturday.getByLabel("برنامه زنگ‌های شنبه")).toContainText("۸۵ دقیقه");
  await expect(saturday.getByLabel("برنامه زنگ‌های شنبه")).toContainText("۵۰ دقیقه");
  await expect(saturday.getByText("زنگ تفریح · ۱۰ دقیقه")).toBeVisible();
  await expect(saturday.getByText("زنگ تفریح · ۱۵ دقیقه")).toBeVisible();
  await expect(saturday.getByText("جابه‌جایی · ۵ دقیقه")).toBeVisible();
  await expect(saturday.getByLabel("واحد آموزشی زنگ ۱ شنبه")).toHaveValue("2");
  await expect(saturday.getByLabel("واحد آموزشی زنگ ۴ شنبه")).toHaveValue("1");
  await saturday.getByRole("button", { name: "ذخیره برنامه این روز" }).click();
  await expect(saturday.getByText("برنامه زنگ‌های این روز ذخیره شد.")).toBeVisible();

  await saturday.getByLabel("محاسبه خودکار").check();
  await expect(saturday.getByText("شروع، زنگ‌ها و فاصله‌ها دقیقاً تا پایان مدرسه ادامه دارند.")).toBeVisible();
  await expect(saturday.getByLabel("برنامه زنگ‌های شنبه")).toContainText("۷۳ دقیقه");
  await saturday.getByLabel("ورود دستی").check();
  await expect(saturday.getByLabel("شروع زنگ ۱ شنبه")).toHaveValue("08:00");

  await page.goto("/teachers");
  await expect(page.getByRole("table").filter({ hasText: "شنبه" })).toContainText("08:00–09:15");
});

test("رابط فارسی در نماهای اصلی، themeها و اندازه‌های مختلف خوانا و بدون سرریز صفحه است", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await capture(page, testInfo, "login-light-desktop");
  await login(page);

  const routes = [
    ["dashboard-light-desktop", "/"],
    ["planning-structure-light-desktop", "/planning?step=structure"],
    ["planning-curriculum-light-desktop", "/planning?step=curriculum"],
    ["teachers-light-desktop", "/teachers"],
    ["preflight-light-desktop", "/planning?step=review"],
    ["settings-light-desktop", "/settings"],
  ] as const;
  for (const [name, route] of routes) {
    await page.goto(route);
    await expect(page.locator("main.page-container")).toBeVisible();
    const viewport = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(viewport.scroll, `${route} از عرض صفحه ${viewport.client}px بیرون زده است`).toBeLessThanOrEqual(viewport.client);
    await capture(page, testInfo, name);
  }

  await page.goto("/planning?step=generate");
  const previousRun = new URL(page.url()).searchParams.get("run");
  await page.getByRole("button", { name: "تولید برنامه" }).click();
  await page.waitForURL((url) => Boolean(url.searchParams.get("run")) && url.searchParams.get("run") !== previousRun);
  await expect(page.getByText("برنامه معتبر تولید شد")).toBeVisible({ timeout: 20_000 });
  await capture(page, testInfo, "generation-light-desktop");
  await page.locator(".candidate-card").first().getByRole("button", { name: "بررسی و اصلاح" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("08:00–09:15").first()).toBeVisible();
  await capture(page, testInfo, "timetable-light-desktop");
  await page.getByRole("button", { name: /^ویرایش / }).first().click();
  await expect(page.getByRole("dialog", { name: "ویرایش جلسه" })).toBeVisible();
  await capture(page, testInfo, "timetable-editor-light-desktop");
  await page.getByRole("button", { name: "بستن", exact: true }).click();

  const typography = await page.evaluate(() => ({
    navigation: parseFloat(getComputedStyle(document.querySelector(".nav-item")!).fontSize),
    input: parseFloat(getComputedStyle(document.querySelector(".input")!).fontSize),
    table: parseFloat(getComputedStyle(document.querySelector(".lesson-cell strong")!).fontSize),
  }));
  expect(typography.navigation).toBeGreaterThanOrEqual(13);
  expect(typography.input).toBeGreaterThanOrEqual(14);
  expect(typography.table).toBeGreaterThanOrEqual(13);

  await page.getByTitle("تیره").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await capture(page, testInfo, "timetable-dark-desktop");
  await page.goto("/planning?step=structure");
  await capture(page, testInfo, "planning-structure-dark-desktop");

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/teachers");
  await expect(page.locator(".teacher-detail:visible")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await capture(page, testInfo, "teachers-dark-tablet");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planning?step=structure");
  await expect(page.locator(".day-schedule-card").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await capture(page, testInfo, "planning-dark-mobile");
  await page.goto("/timetable");
  await expect(page.locator(".timetable-board").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await capture(page, testInfo, "timetable-dark-mobile");
});
