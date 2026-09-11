import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill("admin@madreseyar.ir");
  await page.getByLabel("رمز عبور").fill("Demo123!");
  await page.getByRole("button", { name: "ورود به سامانه" }).click();
  await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();
  const schoolSelect = page.getByLabel("انتخاب مدرسه فعال");
  await expect(schoolSelect).toContainText("دبیرستان فرزانگان");
  if (await schoolSelect.inputValue() !== "20000000-0000-4000-8000-000000000001") {
    await schoolSelect.selectOption("20000000-0000-4000-8000-000000000001");
    await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("انتخاب مدرسه فعال")).toHaveValue("20000000-0000-4000-8000-000000000001");
    await expect(page.locator(".sidebar__school")).toContainText("دبیرستان فرزانگان");
  }
}

test("سه گام ورود داده در یک جریان هفت‌مرحله‌ای در دسترس است", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "برنامه‌ریزی", exact: true }).click();
  await expect(page.getByRole("heading", { name: "برنامه‌ریزی برنامه هفتگی" })).toBeVisible();
  await expect(page.getByLabel("مراحل برنامه‌ریزی").locator(".planning-step")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "کلاس‌ها" })).toBeVisible();
  await expect(page.getByText("۳ کلاس فعال")).toBeVisible();

  await page.getByLabel("مراحل برنامه‌ریزی").getByRole("link", { name: /دروس و ساعات/ }).click();
  await expect(page.getByText("۲۱ ساعت هفتگی")).toBeVisible();
  await expect(page.getByText("زبان انگلیسی").first()).toBeVisible();
  await expect(page.getByText("۲ + ۲")).toBeVisible();

  await page.getByLabel("مراحل برنامه‌ریزی").getByRole("link", { name: /دبیران و حضور/ }).click();
  await expect(page.getByText("ابوالفضل جمشیدی").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "ذخیره جدول حضور" })).toBeVisible();
});

test("workspace دبیران اطلاعات، موظفی و حضور را در یک صفحه نگه می‌دارد", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "دبیران" }).click();
  await expect(page.getByRole("heading", { name: "دبیران", level: 1 })).toBeVisible();
  await expect(page.getByText("درس‌ها و موظفی")).toBeVisible();
  await expect(page.getByText("روزها و ساعات حضور")).toBeVisible();
  await expect(page.getByRole("table").filter({ has: page.getByText("شنبه") })).toBeVisible();
  await page.getByRole("button", { name: "ذخیره جدول حضور" }).click();
  await expect(page.getByText("جدول حضور دبیر ذخیره شد.")).toBeVisible();
});

test("جریان ورود داده در عرض موبایل بدون سرریز صفحه قابل استفاده است", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planning");
  await expect(page.getByRole("heading", { name: "برنامه‌ریزی برنامه هفتگی" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.goto("/teachers");
  await expect(page.getByRole("heading", { name: "دبیران", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("پیش‌بررسی موفق است و solver برنامه معتبر و چند گزینه تولید می‌کند", async ({ page }) => {
  await login(page);
  await page.goto("/planning?step=review");
  await expect(page.getByText("اطلاعات برای تولید برنامه آماده است")).toBeVisible();
  await expect(page.getByText("خطای مسدودکننده‌ای پیدا نشد.")).toBeVisible();
  await page.getByRole("link", { name: "ادامه به تولید برنامه" }).click();
  await page.getByRole("button", { name: "تولید برنامه" }).click();
  await expect(page.getByText("برنامه معتبر تولید شد")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".candidate-card")).toHaveCount(3);
  await expect(page.getByText("بدون تداخل")).toHaveCount(3);

  await page.locator(".candidate-card").first().getByRole("button", { name: "بررسی و اصلاح" }).click();
  await expect(page).toHaveURL(/planning\?step=edit&workspace=/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "برنامه هفتگی" })).toBeVisible();
  await expect(page.getByText("برنامه از نظر قیود سخت معتبر است")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const teacherTab = page.getByRole("tab", { name: "دبیران" });
  await teacherTab.click();
  await expect(teacherTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("انتخاب دبیر")).toBeVisible();
  await page.getByRole("tab", { name: "کلاس‌ها" }).click();
  await page.getByRole("button", { name: /^ویرایش / }).first().click();
  await expect(page.getByRole("dialog", { name: "ویرایش جلسه" })).toBeVisible();
  await page.getByRole("button", { name: "ذخیره تغییر" }).click();
  await expect(page.getByText("تغییر ذخیره و برنامه دوباره اعتبارسنجی شد.")).toBeVisible();
});

test("مقصد برنامه هفتگی همان workspace را با فیلتر و چاپ باز می‌کند", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "برنامه هفتگی" }).click();
  await expect(page.getByRole("heading", { name: "برنامه هفتگی" })).toBeVisible();
  await expect(page.getByLabel("نوع نمایش برنامه")).toBeVisible();
  await expect(page.getByLabel("فیلتر پایه")).toBeVisible();
  await expect(page.getByRole("button", { name: "چاپ" })).toBeVisible();
  await page.getByTitle("تیره").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("نسخه ذخیره و منتشر می‌شود، تاریخچه قابل مشاهده است و خروجی‌ها دانلود می‌شوند", async ({ page }) => {
  await login(page);
  await page.goto("/timetable");
  await expect(page.getByRole("button", { name: "ذخیره نسخه" })).toBeVisible();
  await page.getByRole("button", { name: "ذخیره نسخه" }).click();
  await expect(page.getByText(/نسخه پیش‌نویس .* ذخیره شد/)).toBeVisible();

  await page.getByRole("button", { name: "تأیید و انتشار" }).click();
  const warningConfirmation = page.getByRole("button", { name: "پذیرش هشدارها و انتشار" });
  await warningConfirmation.waitFor({ state: "visible", timeout: 3_000 }).catch(() => undefined);
  if (await warningConfirmation.isVisible()) await warningConfirmation.click();
  await expect(page.getByText(/نسخه .* منتشر شد/)).toBeVisible();

  await page.getByText("نسخه‌ها", { exact: true }).click();
  const publishedVersion = page.locator(".version-menu__popover a", { hasText: "منتشرشده" }).first();
  await expect(publishedVersion).toBeVisible();
  const publishedHref = await publishedVersion.getAttribute("href");

  await page.getByText("خروجی", { exact: true }).click();
  const pdfHref = await page.getByRole("link", { name: "PDF فارسی" }).getAttribute("href");
  const excelHref = await page.getByRole("link", { name: "Excel", exact: true }).getAttribute("href");
  expect(pdfHref).toBeTruthy();
  expect(excelHref).toBeTruthy();
  const pdf = await page.request.get(pdfHref!);
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const excel = await page.request.get(excelHref!);
  expect(excel.ok()).toBe(true);
  expect(excel.headers()["content-type"]).toContain("application/vnd.ms-excel");
  expect((await excel.text())).toContain("DisplayRightToLeft");

  await page.goto(publishedHref!);
  await expect(page).toHaveURL(/\/timetable\?version=/);
  await expect(page.getByText(/snapshot فقط‌خواندنی است/)).toBeVisible();
  await page.getByRole("button", { name: "ایجاد نسخهٔ کاری" }).click();
  await expect(page).toHaveURL(/\/timetable\?workspace=/);
  await expect(page.getByRole("button", { name: "ذخیره نسخه" })).toBeVisible();

  const invalidExport = await page.request.get("/api/timetable/export/pdf?workspace=not-a-uuid&view=school");
  expect(invalidExport.status()).toBe(400);
  expect(await invalidExport.json()).toEqual({ message: "منبع برنامه برای خروجی معتبر نیست." });

  const versionId = new URL(publishedHref!, "http://127.0.0.1:3000").searchParams.get("version");
  await page.getByLabel("انتخاب مدرسه فعال").selectOption("20000000-0000-4000-8000-000000000002");
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".sidebar__school")).toContainText("دبیرستان دانا");
  const foreignVersion = await page.request.get(`/api/timetable/export/excel?version=${versionId}&view=school`);
  expect(foreignVersion.status()).toBe(400);
  expect(await foreignVersion.json()).toEqual({ message: "برنامه‌ای برای خروجی پیدا نشد." });
});

test("تغییر حضور، تولید مجدد و حفظ نسخه منتشرشده قبلی سرتاسری کار می‌کند", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/timetable");
  await page.getByText("نسخه‌ها", { exact: true }).click();
  const publishedHref = await page.locator(".version-menu__popover a", { hasText: "منتشرشده" }).first().getAttribute("href");
  expect(publishedHref).toBeTruthy();

  await page.goto("/teachers");
  const saturdayFirstPeriod = page.getByLabel(/شنبه زنگ/).first();
  const currentStatus = await saturdayFirstPeriod.inputValue();
  await saturdayFirstPeriod.selectOption(currentStatus === "PREFERRED" ? "AVAILABLE" : "PREFERRED");
  await page.getByRole("button", { name: "ذخیره جدول حضور" }).click();
  await expect(page.getByText("جدول حضور دبیر ذخیره شد.")).toBeVisible();

  await page.goto("/planning?step=review");
  await expect(page.getByText("اطلاعات برای تولید برنامه آماده است")).toBeVisible();
  await page.getByRole("link", { name: "ادامه به تولید برنامه" }).click();
  await page.getByRole("button", { name: "تولید برنامه" }).click();
  await expect(page.getByText("برنامه معتبر تولید شد")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".candidate-card").first()).toContainText("بدون تداخل");

  await page.goto(publishedHref!);
  await expect(page.getByText(/snapshot فقط‌خواندنی است/)).toBeVisible();
  await expect(page.locator(".candidate-readonly-note")).toContainText("منتشرشده");
});
