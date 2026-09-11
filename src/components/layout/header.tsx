"use client";

import { Check, ChevronDown, HelpCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SchoolMembershipView } from "@/modules/auth/repository";
import type { TenantContext } from "@/modules/tenancy/types";
import { logoutAction, switchSchoolAction } from "@/modules/auth/actions";
import { ThemeSwitcher } from "./theme-switcher";

const roleLabels = { ADMIN: "مدیر مدرسه", VICE_PRINCIPAL: "معاون مدرسه" } as const;

export function Header({ context, schools }: { context: TenantContext; schools: SchoolMembershipView[] }) {
  return (
    <header className="topbar">
      <form className="topbar__school-switch" action={switchSchoolAction}>
        <label htmlFor="active-school">مدرسه فعال</label>
        <span>
          <select id="active-school" name="schoolId" defaultValue={context.schoolId} disabled={schools.length < 2} aria-label="انتخاب مدرسه فعال">
            {schools.map((school) => <option value={school.schoolId} key={school.schoolId}>{school.schoolName}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
        {schools.length > 1 ? <button className="school-switch-submit" type="submit" aria-label="اعمال مدرسه انتخاب‌شده" title="اعمال مدرسه"><Check size={14} /></button> : null}
      </form>
      <div className="topbar__actions">
        <ThemeSwitcher />
        <Button variant="ghost" size="icon" aria-label="راهنما"><HelpCircle size={20} /></Button>
        <div className="user-menu-static"><span className="avatar">{context.userName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="user-menu__copy"><strong>{context.userName}</strong><small>{roleLabels[context.role]}</small></span></div>
        <form action={logoutAction}><Button variant="ghost" size="icon" type="submit" aria-label="خروج از سامانه" title="خروج"><LogOut size={18} /></Button></form>
      </div>
    </header>
  );
}
