import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeSwitcher } from "./theme-switcher";

describe("پوسته نمایش", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("حالت روشن و تیره را روی سند و حافظه کاربر اعمال می‌کند", async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "تیره" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(localStorage.getItem("school-panel-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "روشن" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(localStorage.getItem("school-panel-theme")).toBe("light");
  });

  it("حالت سیستم را پشتیبانی می‌کند", async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "سیستم" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(localStorage.getItem("school-panel-theme")).toBe("system");
  });
});
