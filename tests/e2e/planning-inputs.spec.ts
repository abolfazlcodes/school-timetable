import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill("admin@madreseyar.ir");
  await page.getByLabel("رمز عبور").fill("Demo123!");
  await page.getByRole("button", { name: "ورود به سامانه" }).click();
  await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();
  const schoolSelect = page.getByLabel("انتخاب مدرسه فعال");
  await expect(schoolSelect).toContainText("دبیرستان فرزانگان");
  if (
    (await schoolSelect.inputValue()) !== "20000000-0000-4000-8000-000000000001"
  ) {
    await schoolSelect.selectOption("20000000-0000-4000-8000-000000000001");
    await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("انتخاب مدرسه فعال")).toHaveValue(
      "20000000-0000-4000-8000-000000000001",
    );
    await expect(page.locator(".sidebar__school")).toContainText(
      "دبیرستان فرزانگان",
    );
  }
}

test("سه گام ورود داده در یک جریان هفت‌مرحله‌ای در دسترس است", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "برنامه‌ریزی", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "برنامه‌ریزی برنامه هفتگی" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("مراحل برنامه‌ریزی").locator(".planning-step"),
  ).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "کلاس‌ها" })).toBeVisible();
  await expect(page.getByText("۳ کلاس فعال")).toBeVisible();

  await page
    .getByLabel("مراحل برنامه‌ریزی")
    .getByRole("link", { name: /دروس و ساعات/ })
    .click();
  await expect(page.getByText("۲۱ ساعت هفتگی")).toBeVisible();
  await expect(page.getByText("زبان انگلیسی").first()).toBeVisible();
  await expect(page.getByText("۲ + ۲")).toBeVisible();
  const englishRequirement = page
    .locator(".requirement-summary-row")
    .filter({ hasText: "زبان انگلیسی" });
  await expect(englishRequirement).toContainText("۱۲ ساعت نیاز");
  await englishRequirement.locator("summary").click();
  await expect(englishRequirement).toContainText("۳ کلاس × ۴ ساعت = ۱۲ ساعت");
  await expect(englishRequirement).toContainText("۱۲ ساعت مازاد");

  await page
    .getByLabel("مراحل برنامه‌ریزی")
    .getByRole("link", { name: /دبیران و حضور/ })
    .click();
  await expect(page.getByText("ابوالفضل جمشیدی").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ذخیره جدول حضور" }),
  ).toBeVisible();
});

test("workspace دبیران اطلاعات، موظفی و حضور را در یک صفحه نگه می‌دارد", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "دبیران" }).click();
  await expect(
    page.getByRole("heading", { name: "دبیران", level: 1 }),
  ).toBeVisible();
  await page.getByText("ابوالفضل جمشیدی", { exact: true }).first().click();
  await expect(page.getByText("درس‌ها و موظفی")).toBeVisible();
  await expect(page.getByText("جمع تخصیص سالانه")).toBeVisible();
  await expect(
    page.getByLabel("ساعت تخصیص زبان انگلیسی", { exact: true }),
  ).toHaveValue("24");
  await expect(page.getByText("روزها و ساعات حضور")).toBeVisible();
  await expect(
    page.getByRole("table").filter({ has: page.getByText("شنبه") }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ذخیره جدول حضور" }).click();
  await expect(page.getByText("جدول حضور دبیر ذخیره شد.")).toBeVisible();
});

test("انتخاب دبیر فرم را تازه می‌کند و ویرایش مشخصات، موظفی و حضور بدون refresh دستی کار می‌کند", async ({
  page,
}, testInfo) => {
  await login(page);
  await page
    .getByLabel("انتخاب مدرسه فعال")
    .selectOption("20000000-0000-4000-8000-000000000003");
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await expect(page.locator(".sidebar__school")).toContainText(
    "دبیرستان شهید بهشتی",
  );
  await page.goto(
    "/teachers?teacher=a0ee0c51-9345-44dd-8281-772136fecea1",
  );

  const teacherSearch = page.getByLabel("جست‌وجوی دبیر");
  await teacherSearch.fill("روح الله");
  await expect(page.locator(".teacher-list__item:visible")).toHaveCount(1);
  await expect(page.getByText("روح‌الله احمدی", { exact: true })).toBeVisible();
  await teacherSearch.clear();

  const identity = page.locator(".teacher-section").first();
  const firstName = identity.getByLabel("نام (در صورت ثبت)", { exact: true });
  await expect(firstName).toHaveValue("امیر");
  await expect(firstName).toBeDisabled();
  await expect(
    identity.getByRole("button", { name: "ذخیره مشخصات" }),
  ).toHaveCount(0);

  await identity
    .getByRole("button", { name: "ویرایش اطلاعات دبیر" })
    .click();
  await expect(firstName).toBeEnabled();
  await identity.getByRole("button", { name: "ذخیره مشخصات" }).click();
  await expect(identity.getByText("مشخصات دبیر ذخیره شد.")).toBeVisible();
  await expect(firstName).toBeDisabled();

  await page.getByText("ابوالفضل جمشیدی", { exact: true }).first().click();
  await expect(identity.getByLabel("نام (در صورت ثبت)", { exact: true })).toHaveValue(
    "ابوالفضل",
  );
  await expect(
    identity.getByLabel("نام خانوادگی", { exact: true }),
  ).toHaveValue("جمشیدی");
  await expect(identity.getByLabel("نام (در صورت ثبت)", { exact: true })).toBeDisabled();
  await page.getByText("امیر چگینی", { exact: true }).first().click();
  await expect(identity.getByLabel("نام (در صورت ثبت)", { exact: true })).toHaveValue("امیر");

  const subjectSection = page.locator(".teacher-section").filter({ hasText: "درس‌ها و موظفی" });
  const subjectSearch = subjectSection.getByLabel("جست‌وجوی درس");
  await subjectSearch.fill("فنون");
  await expect(subjectSection.locator(".subject-assignment-grid > label:visible")).toHaveCount(1);
  await expect(subjectSection.getByText("فنون ادبی", { exact: true })).toBeVisible();
  await subjectSection.getByRole("button", { name: /ذخیره تخصیص درس‌ها/ }).click();
  await expect(subjectSection.getByText("تخصیص سالانه درس‌ها ذخیره شد.")).toBeVisible();
  await subjectSearch.clear();
  await subjectSection.getByRole("button", { name: /انتخاب‌شده/ }).click();
  await expect(subjectSection.locator(".subject-assignment-grid > label:visible")).toHaveCount(3);
  await subjectSection.getByRole("button", { name: "همه", exact: true }).click();
  if (process.env.VISUAL_REVIEW === "1") {
    await page.screenshot({ path: testInfo.outputPath("teacher-search-light-desktop.png"), fullPage: true });
    await page.getByTitle("تیره").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: testInfo.outputPath("teacher-search-dark-desktop.png"), fullPage: true });
    await page.getByTitle("روشن").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("teacher-search-light-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  const workload = page.locator(".workload-form");
  await workload.getByLabel("حداقل", { exact: true }).fill("23");
  await workload.getByLabel("موظفی", { exact: true }).fill("23");
  await expect(workload.getByLabel("موظفی", { exact: true })).toHaveValue("23");
  await workload.getByRole("button", { name: "ذخیره موظفی" }).click();
  await expect(workload.getByText("موظفی و محدودیت‌های سالانه ذخیره شد.")).toBeVisible();
  await expect(page.locator(".subject-assignment-summary")).toContainText(
    "موظفی: ۲۳ ساعت",
  );
  await workload.getByLabel("حداقل", { exact: true }).fill("24");
  await workload.getByLabel("موظفی", { exact: true }).fill("24");
  await workload.getByRole("button", { name: "ذخیره موظفی" }).click();
  await expect(workload.getByText("موظفی و محدودیت‌های سالانه ذخیره شد.")).toBeVisible();
  await expect(page.locator(".subject-assignment-summary")).toContainText(
    "موظفی: ۲۴ ساعت · اضافه‌کار فعلی: ۴ ساعت",
  );

  const saturdayFirstPeriod = page.getByLabel(/شنبه زنگ/).first();
  const availabilitySyncState = page.locator(".availability-sync-state");
  await expect(availabilitySyncState).toContainText(
    "همگام با اطلاعات ذخیره‌شده",
  );
  const originalStatus = await saturdayFirstPeriod.inputValue();
  const changedStatus =
    originalStatus === "PREFERRED" ? "AVAILABLE" : "PREFERRED";
  await saturdayFirstPeriod.selectOption(changedStatus);
  await expect(availabilitySyncState).toContainText("تغییر ذخیره‌نشده");
  await page.getByRole("button", { name: "ذخیره جدول حضور" }).click();
  await expect(page.getByText("جدول حضور دبیر ذخیره شد.")).toBeVisible();
  await expect(availabilitySyncState).toContainText(
    "همگام با اطلاعات ذخیره‌شده",
  );
  await expect(saturdayFirstPeriod).toHaveValue(changedStatus);
  await page.getByText("ابوالفضل جمشیدی", { exact: true }).first().click();
  await expect(identity.getByLabel("نام (در صورت ثبت)", { exact: true })).toHaveValue(
    "ابوالفضل",
  );
  await page.getByText("امیر چگینی", { exact: true }).first().click();
  await expect(identity.getByLabel("نام (در صورت ثبت)", { exact: true })).toHaveValue("امیر");
  await expect(page.getByLabel(/شنبه زنگ/).first()).toHaveValue(changedStatus);
  await page.getByLabel(/شنبه زنگ/).first().selectOption(originalStatus);
  await expect(availabilitySyncState).toContainText("تغییر ذخیره‌نشده");
  await page.getByRole("button", { name: "ذخیره جدول حضور" }).click();
  await expect(page.getByText("جدول حضور دبیر ذخیره شد.")).toBeVisible();
  await expect(availabilitySyncState).toContainText(
    "همگام با اطلاعات ذخیره‌شده",
  );
});

test("برنامه درسی طولانی با پایه و رشته فیلتر می‌شود", async ({ page }) => {
  await login(page);
  const schoolSelect = page.getByLabel("انتخاب مدرسه فعال");
  await schoolSelect.selectOption("20000000-0000-4000-8000-000000000003");
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".sidebar__school")).toContainText(
    "دبیرستان شهید بهشتی",
  );
  await page.goto("/planning?step=curriculum");

  const gradeTabs = page.getByRole("tablist", {
    name: "انتخاب پایه تحصیلی",
  });
  await expect(gradeTabs.getByRole("tab")).toHaveCount(3);
  await expect(gradeTabs.getByRole("tab", { name: /^دهم/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await gradeTabs.getByRole("tab", { name: /^دوازدهم/ }).click();
  const majorFilters = page.getByRole("group", { name: "فیلتر رشته" });
  await majorFilters.getByRole("button", { name: /^علوم تجربی/ }).click();
  const visibleRows = page.locator(".curriculum-table tbody tr");
  await expect(visibleRows.first()).toBeVisible();
  const visibleMajors = await visibleRows.locator("td:nth-child(2)").allTextContents();
  expect(visibleMajors.length).toBeGreaterThan(0);
  expect(visibleMajors.every((major) => major.trim() === "علوم تجربی")).toBe(
    true,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(gradeTabs).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("الگوی اختصاصی عربی دوازدهم تجربی قابل تنظیم است و برنامه معتبر می‌سازد", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  const schoolSelect = page.getByLabel("انتخاب مدرسه فعال");
  await schoolSelect.selectOption("20000000-0000-4000-8000-000000000003");
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".sidebar__school")).toContainText(
    "دبیرستان شهید بهشتی",
  );
  await page.goto("/teachers");
  await expect(page.getByText("مرتضی سلطانی", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("هاشمی", { exact: true })).toHaveCount(0);

  await page.goto("/planning?step=curriculum");
  await page.getByRole("tab", { name: /^دوازدهم/ }).click();
  const arabic12Science = page
    .locator(".curriculum-table tbody tr")
    .filter({ hasText: "عربی" })
    .filter({ hasText: "علوم تجربی" });
  await expect(arabic12Science).toContainText("۱ + ۱");

  await arabic12Science.getByRole("button", { name: /ویرایش الگوی/ }).click();
  await expect(page.getByLabel("الگوی دقیق جلسات")).toHaveValue("1+1");
  await page
    .locator(".curriculum-pattern-option")
    .filter({ hasText: "یک جلسه پیوسته" })
    .click();
  await page.getByRole("button", { name: "ذخیره تغییر الگو" }).click();
  await expect(page.getByText("ساعات و الگوی جلسات درس ذخیره شد.")).toBeVisible();
  await expect(arabic12Science).toContainText("یک جلسه پیوسته");

  await arabic12Science.getByRole("button", { name: /ویرایش الگوی/ }).click();
  await page
    .locator(".curriculum-pattern-option")
    .filter({ hasText: "۲ جلسه تک‌ساعته" })
    .click();
  await page.getByRole("button", { name: "ذخیره تغییر الگو" }).click();
  await expect(arabic12Science).toContainText("۱ + ۱");

  await page.getByRole("tab", { name: /^دهم/ }).click();
  const arabic10Science = page
    .locator(".curriculum-table tbody tr")
    .filter({ hasText: "عربی" })
    .filter({ hasText: "علوم تجربی" });
  await expect(arabic10Science).toContainText("یک جلسه پیوسته");

  await page.getByRole("tab", { name: /^دوازدهم/ }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await arabic12Science.getByRole("button", { name: /ویرایش الگوی/ }).click();
  await expect(page.getByLabel("انتخاب نحوه برگزاری")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/planning?step=review");
  await expect(page.getByText("اطلاعات برای تولید برنامه آماده است")).toBeVisible();
  await expect(page.locator(".preflight-metrics")).toContainText("۳۵۰");
  await expect(page.locator(".preflight-metrics")).toContainText("۲۱");
  await expect(page.locator(".preflight-metrics")).toContainText("۱۰");
  await page.getByRole("link", { name: "ادامه به تولید برنامه" }).click();
  await page.getByRole("button", { name: "تولید برنامه" }).click();
  await expect(page.getByText("برنامه معتبر تولید شد")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".candidate-card").first()).toContainText("بدون تداخل");
  await page
    .getByLabel("انتخاب مدرسه فعال")
    .selectOption("20000000-0000-4000-8000-000000000002");
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await page.waitForLoadState("networkidle");
  await page.goto("/teachers");
  await expect(page.getByText("امیر چگینی").first()).toBeVisible();
  await page.goto("/planning?step=review");
  await expect(
    page.getByText("اطلاعات برای تولید برنامه آماده است"),
  ).toBeVisible();
  await expect(page.locator(".preflight-metrics")).toContainText("۱۱");
});

test("جریان ورود داده در عرض موبایل بدون سرریز صفحه قابل استفاده است", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planning");
  await expect(
    page.getByRole("heading", { name: "برنامه‌ریزی برنامه هفتگی" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto("/teachers");
  await expect(
    page.getByRole("heading", { name: "دبیران", level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("پیش‌بررسی موفق است و solver برنامه معتبر و چند گزینه تولید می‌کند", async ({
  page,
}) => {
  await login(page);
  await page.goto("/planning?step=review");
  await expect(
    page.getByText("اطلاعات برای تولید برنامه آماده است"),
  ).toBeVisible();
  await expect(page.getByText("خطای مسدودکننده‌ای پیدا نشد.")).toBeVisible();
  await page.getByRole("link", { name: "ادامه به تولید برنامه" }).click();
  await page.getByRole("button", { name: "تولید برنامه" }).click();
  await expect(page.getByText("برنامه معتبر تولید شد")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".candidate-card")).toHaveCount(3);
  await expect(page.getByText("بدون تداخل")).toHaveCount(3);

  await page
    .locator(".candidate-card")
    .first()
    .getByRole("button", { name: "بررسی و اصلاح" })
    .click();
  await expect(page).toHaveURL(/planning\?step=edit&workspace=/);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "برنامه هفتگی" }),
  ).toBeVisible();
  await expect(
    page.getByText("برنامه از نظر قیود سخت معتبر است"),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const teacherTab = page.getByRole("tab", { name: "دبیران" });
  await teacherTab.click();
  await expect(teacherTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("انتخاب دبیر")).toBeVisible();
  await page.getByRole("tab", { name: "کلاس‌ها" }).click();
  await page
    .getByRole("button", { name: /^ویرایش / })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "ویرایش جلسه" })).toBeVisible();
  await page.getByRole("button", { name: "ذخیره تغییر" }).click();
  await expect(
    page.getByText("تغییر ذخیره و برنامه دوباره اعتبارسنجی شد."),
  ).toBeVisible();
});

test("مقصد برنامه هفتگی همان workspace را با فیلتر و چاپ باز می‌کند", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "برنامه هفتگی" }).click();
  await expect(
    page.getByRole("heading", { name: "برنامه هفتگی" }),
  ).toBeVisible();
  await expect(page.getByLabel("نوع نمایش برنامه")).toBeVisible();
  await expect(page.getByLabel("فیلتر پایه")).toBeVisible();
  await expect(page.getByRole("button", { name: "چاپ" })).toBeVisible();
  await page.getByTitle("تیره").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("نسخه ذخیره و منتشر می‌شود، تاریخچه قابل مشاهده است و خروجی‌ها دانلود می‌شوند", async ({
  page,
}) => {
  await login(page);
  await page.goto("/timetable");
  await expect(page.getByRole("button", { name: "ذخیره نسخه" })).toBeVisible();
  await page.getByRole("button", { name: "ذخیره نسخه" }).click();
  await expect(page.getByText(/نسخه پیش‌نویس .* ذخیره شد/)).toBeVisible();

  await page.getByRole("button", { name: "تأیید و انتشار" }).click();
  const warningConfirmation = page.getByRole("button", {
    name: "پذیرش هشدارها و انتشار",
  });
  await warningConfirmation
    .waitFor({ state: "visible", timeout: 3_000 })
    .catch(() => undefined);
  if (await warningConfirmation.isVisible()) await warningConfirmation.click();
  await expect(page.getByText(/نسخه .* منتشر شد/)).toBeVisible();

  await page.getByText("نسخه‌ها", { exact: true }).click();
  const publishedVersion = page
    .locator(".version-menu__popover a", { hasText: "منتشرشده" })
    .first();
  await expect(publishedVersion).toBeVisible();
  const publishedHref = await publishedVersion.getAttribute("href");

  await page.getByText("خروجی", { exact: true }).click();
  const pdfHref = await page
    .getByRole("link", { name: "PDF جدول کل مدرسه" })
    .getAttribute("href");
  const excelHref = await page
    .getByRole("link", { name: "Excel کل مدرسه", exact: true })
    .getAttribute("href");
  expect(pdfHref).toBeTruthy();
  expect(excelHref).toBeTruthy();
  const pdf = await page.request.get(pdfHref!);
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain("school-wide-timetable.pdf");
  const pdfBody = await pdf.body();
  expect(pdfBody.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdfBody.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(0);
  const excel = await page.request.get(excelHref!);
  expect(excel.ok()).toBe(true);
  expect(excel.headers()["content-type"]).toContain("application/vnd.ms-excel");
  expect(await excel.text()).toContain("DisplayRightToLeft");

  await page.goto(publishedHref!);
  await expect(page).toHaveURL(/\/timetable\?version=/);
  await expect(page.getByText(/snapshot فقط‌خواندنی است/)).toBeVisible();
  await page.getByRole("button", { name: "ایجاد نسخهٔ کاری" }).click();
  await expect(page).toHaveURL(/\/timetable\?workspace=/);
  await expect(page.getByRole("button", { name: "ذخیره نسخه" })).toBeVisible();

  const invalidExport = await page.request.get(
    "/api/timetable/export/pdf?workspace=not-a-uuid&view=school",
  );
  expect(invalidExport.status()).toBe(400);
  expect(await invalidExport.json()).toEqual({
    message: "منبع برنامه برای خروجی معتبر نیست.",
  });

  const versionId = new URL(
    publishedHref!,
    "http://127.0.0.1:3000",
  ).searchParams.get("version");
  await page
    .getByLabel("انتخاب مدرسه فعال")
    .selectOption("20000000-0000-4000-8000-000000000002");
  await page.getByRole("button", { name: "اعمال مدرسه انتخاب‌شده" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".sidebar__school")).toContainText("دبیرستان دانا");
  const foreignVersion = await page.request.get(
    `/api/timetable/export/excel?version=${versionId}&view=school`,
  );
  expect(foreignVersion.status()).toBe(400);
  expect(await foreignVersion.json()).toEqual({
    message: "برنامه‌ای برای خروجی پیدا نشد.",
  });
});

test("تغییر حضور، تولید مجدد و حفظ نسخه منتشرشده قبلی سرتاسری کار می‌کند", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/timetable");
  await page.getByText("نسخه‌ها", { exact: true }).click();
  const publishedHref = await page
    .locator(".version-menu__popover a", { hasText: "منتشرشده" })
    .first()
    .getAttribute("href");
  expect(publishedHref).toBeTruthy();

  await page.goto("/teachers");
  const saturdayFirstPeriod = page.getByLabel(/شنبه زنگ/).first();
  const currentStatus = await saturdayFirstPeriod.inputValue();
  await saturdayFirstPeriod.selectOption(
    currentStatus === "PREFERRED" ? "AVAILABLE" : "PREFERRED",
  );
  await page.getByRole("button", { name: "ذخیره جدول حضور" }).click();
  await expect(page.getByText("جدول حضور دبیر ذخیره شد.")).toBeVisible();

  await page.goto("/planning?step=review");
  await expect(
    page.getByText("اطلاعات برای تولید برنامه آماده است"),
  ).toBeVisible();
  await page.getByRole("link", { name: "ادامه به تولید برنامه" }).click();
  await page.getByRole("button", { name: "تولید برنامه" }).click();
  await expect(page.getByText("برنامه معتبر تولید شد")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".candidate-card").first()).toContainText(
    "بدون تداخل",
  );

  await page.goto(publishedHref!);
  await expect(page.getByText(/snapshot فقط‌خواندنی است/)).toBeVisible();
  await expect(page.locator(".candidate-readonly-note")).toContainText(
    "منتشرشده",
  );
});
