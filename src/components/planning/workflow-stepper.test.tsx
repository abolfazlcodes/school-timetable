import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowStepper } from "./workflow-stepper";

describe("جریان یکپارچه برنامه‌ریزی", () => {
  it("هر هفت مرحله تکمیل‌شده فاز را در یک stepper نشان می‌دهد", () => {
    render(<WorkflowStepper activeStep="curriculum" />);
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: /دروس و ساعات/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: /بررسی و اصلاح/ })).toHaveAttribute("href", "/planning?step=edit");
    expect(screen.getByRole("link", { name: /انتشار/ })).toHaveAttribute("href", "/planning?step=publish");
  });
});
