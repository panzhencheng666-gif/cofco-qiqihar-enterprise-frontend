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
          comparison: undefined,
          icons: [],
          issue: undefined,
          mode: "comparison",
          region: { code: "230231100", level: "TOWNSHIP", name: "兴农镇" },
          setMode,
          setShowExactDesignLocations: vi.fn(),
          showExactDesignLocations: false,
          state: "loading",
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
});
