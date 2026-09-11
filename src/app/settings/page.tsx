import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SchoolSettingsForm } from "@/components/settings/school-settings-form";
import { getDatabase } from "@/db/client";
import { getShellIdentity } from "@/modules/auth/dal";
import { createSchoolRepository } from "@/modules/schools/repository";

export const metadata: Metadata = { title: "تنظیمات مدرسه" };

export default async function SettingsPage() {
  const { context, schools } = await getShellIdentity();
  const profile = await createSchoolRepository(getDatabase()).getProfile(context);
  if (!profile) notFound();
  return (
    <AppShell context={context} schools={schools}>
      <Breadcrumbs items={[{ label: "داشبورد", href: "/" }, { label: "تنظیمات" }]} />
      <section className="page-heading page-heading--compact"><div><h1>تنظیمات مدرسه</h1><p>مشخصات پایه مدرسه فعال</p></div></section>
      <section className="panel settings-panel"><div className="panel__header"><div><h2>مشخصات مدرسه</h2><p>این اطلاعات در عنوان برنامه‌ها و خروجی‌ها استفاده خواهد شد.</p></div></div><SchoolSettingsForm profile={profile} canEdit={context.role === "ADMIN"} /></section>
    </AppShell>
  );
}
