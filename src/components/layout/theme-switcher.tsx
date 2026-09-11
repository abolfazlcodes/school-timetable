"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "روشن", icon: Sun },
  { value: "dark", label: "تیره", icon: Moon },
  { value: "system", label: "سیستم", icon: Laptop },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switcher" aria-label="انتخاب پوسته">
      {themes.map(({ value, label, icon: Icon }) => (
        <button key={value} className={theme === value ? "is-active" : undefined} onClick={() => setTheme(value)} aria-pressed={theme === value} title={label}>
          <Icon size={16} aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}
