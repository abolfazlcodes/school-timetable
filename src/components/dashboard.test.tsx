import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "./dashboard";
import type { DashboardData } from "@/modules/dashboard/service";

const data: DashboardData = {
  academicYearTitle: "۱۴۰۵–۱۴۰۶",
  classCount: 18,
  teacherCount: 26,
  weeklyPeriods: 324,
  issueCount: 1,
  issues: [{ code: "MISSING_AVAILABILITY", severity: "WARNING", message: "حضور یک دبیر کامل نشده است.", fixHref: "/planning?step=teachers" }],
  progress: 67,
  planningRows: [
    { label: "ساختار مدرسه و کلاس‌ها", complete: true },
    { label: "دروس و ساعات هفتگی", complete: true },
    { label: "دبیران و حضور", complete: false },
  ],
  statusLabel: "در حال تنظیم",
  statusTone: "warning",
  continueHref: "/planning?step=teachers",
  latestVersion: null,
};

describe("داشبورد فشرده", () => {
  it("فقط اطلاعات عملیاتی لازم را نشان می‌دهد", () => {
    render(<Dashboard data={data} />);
    expect(screen.getByText("سال تحصیلی فعال")).toBeInTheDocument();
    expect(screen.getByText("کلاس‌ها")).toBeInTheDocument();
    expect(screen.getByText("دبیران")).toBeInTheDocument();
    expect(screen.getByText("ساعت هفتگی")).toBeInTheDocument();
    expect(screen.getByText("وضعیت برنامه هفتگی")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ادامه برنامه‌ریزی/ })).toHaveAttribute("href", "/planning?step=teachers");
  });

  it("جزئیات فنی solver یا تحلیل تزئینی ندارد", () => {
    render(<Dashboard data={data} />);
    expect(screen.queryByText(/امتیاز بهینه‌سازی/)).not.toBeInTheDocument();
    expect(screen.queryByText(/تعارض سخت/)).not.toBeInTheDocument();
    expect(screen.queryByText(/پیش‌بررسی برنامه/)).not.toBeInTheDocument();
  });
});
