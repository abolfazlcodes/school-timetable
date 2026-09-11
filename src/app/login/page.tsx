import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { School } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { getOptionalTenantContext } from "@/modules/auth/dal";

export const metadata: Metadata = { title: "ورود" };

export default async function LoginPage() {
  if (await getOptionalTenantContext()) redirect("/");
  return (
    <main className="auth-page">
      <div className="auth-theme"><ThemeSwitcher /></div>
      <section className="auth-card">
        <div className="auth-brand"><span className="brand__mark"><School size={23} /></span><div><strong>مدرسه‌یار</strong><span>سامانه برنامه‌ریزی آموزشی</span></div></div>
        <div className="auth-heading"><h1>ورود به پنل مدرسه</h1><p>برای مدیریت و تنظیم برنامه هفتگی وارد شوید.</p></div>
        <LoginForm />
        <p className="auth-help">در صورت فراموشی اطلاعات ورود، با مدیر سامانه مدرسه تماس بگیرید.</p>
      </section>
    </main>
  );
}
