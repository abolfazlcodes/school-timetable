import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "مدرسه‌یار | برنامه‌ریزی آموزشی", template: "%s | مدرسه‌یار" },
  description: "سامانه مدیریت و تولید برنامه هفتگی مدرسه",
};

const themeScript = `(()=>{try{const t=localStorage.getItem('school-panel-theme')||'system';const r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch{}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider></body>
    </html>
  );
}
