import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenerateControl } from "./generate-control";

vi.mock("@/modules/scheduling/actions", () => ({ generateTimetableAction: vi.fn() }));

describe("کنترل تولید برنامه", () => {
  it("پس از موفقیت به اجرای ساخته‌شده می‌رود", async () => {
    const navigate = vi.fn();
    render(<GenerateControl navigate={navigate} action={async () => ({ status: "success", runId: "run-1" })} />);
    fireEvent.click(screen.getByRole("button", { name: "تولید برنامه" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/planning?step=generate&run=run-1"));
  });

  it("خطای سرور را داخل همان صفحه نشان می‌دهد و دکمه را آزاد می‌کند", async () => {
    render(<GenerateControl action={async () => ({ status: "error", code: "SOLVER_UNAVAILABLE", message: "موتور روی سرور اجرا نشد.", reference: "ABC12345" })} />);
    fireEvent.click(screen.getByRole("button", { name: "تولید برنامه" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("موتور روی سرور اجرا نشد");
    expect(screen.getByRole("alert")).toHaveTextContent("ABC12345");
    await waitFor(() => expect(screen.getByRole("button", { name: "تولید برنامه" })).toBeEnabled());
  });

  it("قطع پاسخ Server Action را بدون شکستن صفحه قابل تلاش مجدد می‌کند", async () => {
    render(<GenerateControl action={async () => { throw new Error("network"); }} />);
    fireEvent.click(screen.getByRole("button", { name: "تولید برنامه" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("پاسخی از سرور دریافت نشد");
    expect(screen.getByRole("button", { name: "بارگذاری نسخه جدید" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تولید برنامه" })).toBeDisabled();
  });

  it("درخواست بدون پاسخ را برای همیشه در حالت انتظار نگه نمی‌دارد", async () => {
    render(<GenerateControl timeoutMs={10} action={() => new Promise<never>(() => undefined)} />);
    fireEvent.click(screen.getByRole("button", { name: "تولید برنامه" }));
    expect(screen.getByRole("button", { name: "در حال ساخت برنامه معتبر…" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("پاسخی از سرور دریافت نشد");
    expect(screen.getByRole("button", { name: "تولید برنامه" })).toBeDisabled();
  });
});
