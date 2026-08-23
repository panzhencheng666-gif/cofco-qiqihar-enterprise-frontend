import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { OverviewSampleNetworkToolbar } from "./OverviewSampleNetworkToolbar";

describe("OverviewSampleNetworkToolbar", () => {
  it("keeps the three map layers in one persistent control", async () => {
    const setMode = vi.fn();
    render(
      <OverviewSampleNetworkToolbar
        model={{
          applicable: true,
          catalog: undefined,
          catalogState: "idle",
          categoryCode: undefined,
          comparison: undefined,
          icons: [],
          issue: undefined,
          mode: "comparison",
          region: { code: "230231100", level: "TOWNSHIP", name: "兴农镇" },
          setCategoryCode: vi.fn(),
          setMode,
          setShowExactDesignLocations: vi.fn(),
          setTypeCode: vi.fn(),
          showExactDesignLocations: false,
          state: "loading",
          typeCode: undefined,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "对照显示" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "设计样本" }));
    expect(setMode).toHaveBeenCalledWith("design");
    expect(screen.getByText("正在同步样本网络")).toBeVisible();
  });

  it("makes the pre-2026 historical boundary explicit and disables annual layers", () => {
    render(
      <OverviewSampleNetworkToolbar
        model={{
          applicable: false,
          catalog: undefined,
          catalogState: "idle",
          categoryCode: undefined,
          comparison: undefined,
          icons: [],
          issue: undefined,
          mode: "comparison",
          region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
          setCategoryCode: vi.fn(),
          setMode: vi.fn(),
          setShowExactDesignLocations: vi.fn(),
          setTypeCode: vi.fn(),
          showExactDesignLocations: false,
          state: "idle",
          typeCode: undefined,
        }}
      />,
    );

    expect(
      screen.getByText("现有样本网络自2026年启用，当前年度仅展示历史业务记录。"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "现有样本" })).toBeDisabled();
  });
});
