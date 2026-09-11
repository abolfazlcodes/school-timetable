"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronLeft, CircleGauge, ClipboardCheck, Menu, School, Settings2, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const navigationItems = [
  { href: "/", label: "داشبورد", icon: CircleGauge, available: true },
  { href: "/planning", label: "برنامه‌ریزی", icon: ClipboardCheck, available: true },
  { href: "/teachers", label: "دبیران", icon: UsersRound, available: true },
  { href: "/timetable", label: "برنامه هفتگی", icon: CalendarDays, available: true },
  { href: "/settings", label: "تنظیمات", icon: Settings2, available: true },
] as const;

export function Sidebar({ schoolName, schoolCode }: { schoolName: string; schoolCode: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="mobile-menu" variant="secondary" size="icon" onClick={() => setOpen(true)} aria-label="باز کردن منو"><Menu /></Button>
      {open ? <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="بستن منو" /> : null}
      <aside className={cn("sidebar", open && "is-open")} aria-label="منوی اصلی">
        <div className="brand">
          <span className="brand__mark"><School size={23} aria-hidden="true" /></span>
          <div><strong>مدرسه‌یار</strong><span>سامانه برنامه‌ریزی آموزشی</span></div>
          <Button className="sidebar__close" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="بستن منو"><X size={20} /></Button>
        </div>
        <nav className="sidebar__nav">
          <p>مدیریت برنامه</p>
          {navigationItems.map(({ href, label, icon: Icon, available }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} prefetch={available} className={cn("nav-item", active && "is-active", !available && "is-disabled")} onClick={(event) => { if (!available) event.preventDefault(); else setOpen(false); }} aria-current={active ? "page" : undefined} aria-disabled={!available || undefined} tabIndex={available ? undefined : -1}><Icon size={19} aria-hidden="true" /><span>{label}</span>{active ? <ChevronLeft className="nav-item__chevron" size={15} /> : null}</Link>;
          })}
        </nav>
        <div className="sidebar__school">
          <span className="avatar avatar--school">{schoolName.slice(0, 1)}</span>
          <div><strong>{schoolName}</strong><span>{schoolCode ? `کد مدرسه ${schoolCode}` : "کد مدرسه ثبت نشده"}</span></div>
        </div>
      </aside>
    </>
  );
}
