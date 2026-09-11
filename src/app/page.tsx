import { AppShell } from "@/components/layout/app-shell";
import { Dashboard } from "@/components/dashboard";
import { getShellIdentity } from "@/modules/auth/dal";
import { getDatabase } from "@/db/client";
import { getDashboardData } from "@/modules/dashboard/service";
import { createScheduleVersionRepository } from "@/modules/schedule-versions/repository";
import { createSchedulingRepository } from "@/modules/scheduling/repository";
import { createTimetableRepository } from "@/modules/timetable/repository";

export default async function HomePage() {
  const { context, schools } = await getShellIdentity();
  const db = getDatabase();
  const data = await getDashboardData(context, createSchedulingRepository(db), createTimetableRepository(db), createScheduleVersionRepository(db));
  return <AppShell context={context} schools={schools}><Dashboard data={data} /></AppShell>;
}
