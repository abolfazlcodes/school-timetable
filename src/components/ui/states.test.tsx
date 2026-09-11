import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./states";

describe("وضعیت‌های عمومی رابط", () => {
  it("empty state فارسی را نمایش می‌دهد", () => {
    render(<EmptyState title="هنوز کلاسی ندارید" description="نخستین کلاس را ایجاد کنید." />);
    expect(screen.getByRole("heading", { name: "هنوز کلاسی ندارید" })).toBeInTheDocument();
  });

  it("error state برای فناوری کمکی alert است", () => {
    render(<ErrorState title="خطا" description="بارگذاری انجام نشد." />);
    expect(screen.getByRole("alert")).toHaveTextContent("بارگذاری انجام نشد");
  });

  it("loading state وضعیت busy دارد", () => {
    render(<LoadingState rows={2} />);
    expect(screen.getByLabelText("در حال بارگذاری")).toHaveAttribute("aria-busy", "true");
  });
});
