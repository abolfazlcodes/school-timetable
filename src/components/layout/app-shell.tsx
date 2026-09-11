import { Header } from "./header";
import { Sidebar } from "./sidebar";
import type { SchoolMembershipView } from "@/modules/auth/repository";
import type { TenantContext } from "@/modules/tenancy/types";

export function AppShell({ children, context, schools }: { children: React.ReactNode; context: TenantContext; schools: SchoolMembershipView[] }) {
  return <div className="app-shell"><Sidebar schoolName={context.schoolName} schoolCode={context.schoolCode} /><div className="app-main"><Header context={context} schools={schools} /><main className="page-container">{children}</main></div></div>;
}
