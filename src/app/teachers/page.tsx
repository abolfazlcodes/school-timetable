import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TeacherWorkspace } from "@/components/teachers/teacher-workspace";
import { getDatabase } from "@/db/client";
import { getShellIdentity } from "@/modules/auth/dal";
import { createTeacherRepository } from "@/modules/teachers/repository";

export const metadata: Metadata = { title: "دبیران" };

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ teacher?: string }> }) {
  const { context, schools } = await getShellIdentity();
  const params = await searchParams;
  const data = await createTeacherRepository(getDatabase()).getWorkspace(context, params.teacher);
  return <AppShell context={context} schools={schools}><Breadcrumbs items={[{ label: "داشبورد", href: "/" }, { label: "دبیران" }]} /><section className="page-heading page-heading--compact"><div><h1>دبیران</h1><p>مشخصات، درس‌ها، موظفی و حضور در یک فضای کاری</p></div></section><TeacherWorkspace data={data} /></AppShell>;
}
