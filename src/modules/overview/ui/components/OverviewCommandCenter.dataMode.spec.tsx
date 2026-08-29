import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OverviewCommandCenter } from "./OverviewCommandCenter";

describe("OverviewCommandCenter data mode slot", () => {
  it("replaces sample-derived KPI cards with the selected independent data mode", () => {
    render(
      <OverviewCommandCenter
        dataModePanel={<section aria-label="地区数据指标">地区年度权威数据</section>}
        dataStatusText="已同步地区正式数据"
        filters={<div />}
        map={<div />}
        navigation={<div />}
        onCloseDetails={vi.fn()}
        onEnterSelectedRegion={vi.fn()}
        productLabel="玉米"
      />,
    );

    expect(screen.getByLabelText("地区数据指标")).toBeInTheDocument();
    expect(screen.queryByLabelText("总揽关键指标")).not.toBeInTheDocument();
    expect(screen.getByText("已同步地区正式数据")).toBeInTheDocument();
    expect(screen.queryByText("等待审核数据")).not.toBeInTheDocument();
  });

  it("reserves the right side for supply balance without covering the map", () => {
    render(
      <OverviewCommandCenter
        dataModeControls={<nav aria-label="总揽展示内容">展示模式</nav>}
        dataModePanel={<section aria-label="供需平衡指标">供需平衡</section>}
        sideDataPanel
        filters={<div />}
        map={<div />}
        navigation={<div />}
        onCloseDetails={vi.fn()}
        onEnterSelectedRegion={vi.fn()}
        productLabel="玉米"
      />,
    );

    expect(screen.getByRole("main")).toHaveClass("has-side-data-panel");
    expect(screen.getByLabelText("粮食商情总览地图")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "总揽展示内容" }),
    ).toBeInTheDocument();
  });
});
