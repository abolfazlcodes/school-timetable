// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("محافظت سریع route", () => {
  it("درخواست بدون cookie را به ورود می‌فرستد", () => {
    const response = proxy(new NextRequest("https://panel.example.test/settings"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://panel.example.test/login?from=%2Fsettings");
  });

  it("صفحه ورود عمومی می‌ماند", () => {
    expect(proxy(new NextRequest("https://panel.example.test/login")).status).toBe(200);
  });

  it("cookie با طول معقول را برای بررسی امن DAL عبور می‌دهد", () => {
    const request = new NextRequest("https://panel.example.test/", { headers: { cookie: `school_panel_session=${"a".repeat(43)}` } });
    expect(proxy(request).status).toBe(200);
  });
});
