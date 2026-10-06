import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurriculumWorkspaceData } from "@/modules/curriculum/repository";
import { CurriculumWorkspace } from "./curriculum-workspace";

vi.mock("@/modules/curriculum/actions", () => ({
  addSubjectAction: vi.fn(),
  saveCurriculumItemAction: vi.fn(),
  setSubjectStatusAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const data: CurriculumWorkspaceData = {
  activeAcademicYear: {
    id: "30000000-0000-4000-8000-000000000001",
    title: "۱۴۰۵–۱۴۰۶",
  },
  grades: [
    { id: "31000000-0000-4000-8000-000000000001", name: "پایه دوازدهم" },
  ],
  majors: [
    { id: "32000000-0000-4000-8000-000000000001", name: "علوم تجربی" },
  ],
  subjects: [
    {
      id: "33000000-0000-4000-8000-000000000001",
      name: "عربی",
      code: null,
      isActive: true,
    },
  ],
  items: [
    {
      id: "34000000-0000-4000-8000-000000000001",
      gradeId: "31000000-0000-4000-8000-000000000001",
      gradeName: "پایه دوازدهم",
      majorId: "32000000-0000-4000-8000-000000000001",
      majorName: "علوم تجربی",
      subjectId: "33000000-0000-4000-8000-000000000001",
      subjectName: "عربی",
      weeklyHours: 2,
      sessionCount: 2,
      sessionPattern: [1, 1],
      classCount: 1,
      totalWorkload: 2,
      isActive: true,
    },
  ],
  requirements: [],
};

describe("ویرایش الگوی جلسات برنامه درسی", () => {
  it("هر ردیف را با پیش‌فرض فعلی باز می‌کند و امکان تغییر پیوسته یا خردشده می‌دهد", () => {
    render(<CurriculumWorkspace data={data} />);

    expect(screen.getByRole("table")).toHaveTextContent("۱ + ۱");
    expect(screen.getByRole("table")).toHaveTextContent("۲ جلسه تک‌ساعته");

    fireEvent.click(
      screen.getByRole("button", {
        name: "ویرایش الگوی عربی پایه دوازدهم علوم تجربی",
      }),
    );

    expect(screen.getByRole("heading", { name: "ویرایش الگوی عربی" })).toBeInTheDocument();
    expect(screen.getByLabelText("ساعت هر کلاس در هفته")).toHaveValue("2");
    expect(screen.getByLabelText("الگوی دقیق جلسات")).toHaveValue("1+1");

    const contiguous = screen.getByText("یک جلسه پیوسته").closest("button");
    expect(contiguous).not.toBeNull();
    fireEvent.click(contiguous!);
    expect(screen.getByLabelText("الگوی دقیق جلسات")).toHaveValue("2");
    expect(contiguous).toHaveAttribute("aria-pressed", "true");
  });

  it("ردیف‌های طولانی را ابتدا بر اساس پایه و سپس رشته تفکیک می‌کند", () => {
    const scienceMajor = data.majors[0];
    const humanitiesMajor = {
      id: "32000000-0000-4000-8000-000000000002",
      name: "ادبیات و علوم انسانی",
    };
    const tenthGrade = {
      id: "31000000-0000-4000-8000-000000000010",
      name: "پایه دهم",
    };
    const eleventhGrade = {
      id: "31000000-0000-4000-8000-000000000011",
      name: "پایه یازدهم",
    };
    const groupedData: CurriculumWorkspaceData = {
      ...data,
      grades: [tenthGrade, eleventhGrade, data.grades[0]],
      majors: [scienceMajor, humanitiesMajor],
      items: [
        {
          ...data.items[0],
          id: "34000000-0000-4000-8000-000000000010",
          gradeId: tenthGrade.id,
          gradeName: tenthGrade.name,
          subjectName: "زیست‌شناسی",
        },
        {
          ...data.items[0],
          id: "34000000-0000-4000-8000-000000000011",
          gradeId: tenthGrade.id,
          gradeName: tenthGrade.name,
          majorId: humanitiesMajor.id,
          majorName: humanitiesMajor.name,
          subjectName: "اقتصاد",
        },
        {
          ...data.items[0],
          id: "34000000-0000-4000-8000-000000000012",
          gradeId: eleventhGrade.id,
          gradeName: eleventhGrade.name,
          subjectName: "فیزیک",
        },
        data.items[0],
      ],
    };

    render(<CurriculumWorkspace data={groupedData} />);

    const table = screen.getByRole("table");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /^دهم/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(table).toHaveTextContent("زیست‌شناسی");
    expect(table).toHaveTextContent("اقتصاد");
    expect(table).not.toHaveTextContent("فیزیک");

    fireEvent.click(
      screen.getByRole("button", { name: /^علوم تجربی/ }),
    );
    expect(table).toHaveTextContent("زیست‌شناسی");
    expect(table).not.toHaveTextContent("اقتصاد");

    fireEvent.click(screen.getByRole("tab", { name: /^دوازدهم/ }));
    expect(table).toHaveTextContent("عربی");
    expect(table).not.toHaveTextContent("زیست‌شناسی");
    expect(
      screen.getByRole("button", { name: /^همه/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
