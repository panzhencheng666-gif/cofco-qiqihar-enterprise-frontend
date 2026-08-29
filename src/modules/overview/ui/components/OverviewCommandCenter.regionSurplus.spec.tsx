import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OverviewDashboard } from "../../domain/overview";
import { OverviewCommandCenter } from "./OverviewCommandCenter";

describe("OverviewCommandCenter", () => {
  it("shows an explicit synchronization state before a newly selected scope resolves", () => {
    render(
      <OverviewCommandCenter
        dashboardLoading
        filters={<div />}
        map={<div />}
        navigation={<div />}
        onCloseDetails={vi.fn()}
        onEnterSelectedRegion={vi.fn()}
        productLabel="玉米"
      />,
    );

    expect(screen.getAllByText("正在同步审核数据")).toHaveLength(5);
    expect(screen.getAllByText("正在同步")).toHaveLength(5);
    expect(screen.queryByText("等待审核数据")).not.toBeInTheDocument();
  });

  it("keeps navigation and sample-network controls in one non-overlapping tool row", () => {
    const { container } = render(
      <OverviewCommandCenter
        dataModeControls={<nav aria-label="总揽展示内容">展示模式</nav>}
        filters={<div />}
        map={<div />}
        navigation={<nav aria-label="行政区导航">返回业务目录</nav>}
        onCloseDetails={vi.fn()}
        onEnterSelectedRegion={vi.fn()}
        productLabel="玉米"
        sampleNetworkControls={<section aria-label="样本网络图层">对照显示</section>}
      />,
    );

    const toolRow = container.querySelector(".overview-command-tools");
    expect(toolRow).not.toBeNull();
    expect(
      within(toolRow as HTMLElement).getByRole("navigation", {
        name: "行政区导航",
      }),
    ).toBeVisible();
    expect(within(toolRow as HTMLElement).getByRole("region")).toBeVisible();
    expect(
      within(toolRow as HTMLElement).getByRole("navigation", {
        name: "总揽展示内容",
      }),
    ).toBeVisible();
  });

  it("labels all three stable sample roles", () => {
    renderCenter(dashboardWithoutSupplyMetrics());

    const legend = screen.getByRole("complementary");
    expect(within(legend).getByText("产情类样本点")).toBeVisible();
    expect(within(legend).getByText("市场类样本点")).toBeVisible();
    expect(within(legend).getByText("物流类样本点")).toBeVisible();
  });

  it("keeps regional supply balance out of the sample-point monitoring metrics", () => {
    renderCenter(dashboardWithoutSupplyMetrics());

    const cards = within(
      screen.getByRole("region", { name: "总揽关键指标" }),
    ).getAllByRole("article");
    expect(
      cards.map((card) => within(card).getByRole("paragraph").textContent),
    ).toEqual(["粮食播种面积", "预计总产量", "平均收购价", "平均销售价"]);
    expect(screen.queryByRole("article", { name: "总供给" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "总需求" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "地区余粮" })).not.toBeInTheDocument();
  });
});

function renderCenter(dashboard: OverviewDashboard) {
  render(
    <OverviewCommandCenter
      dashboard={dashboard}
      filters={<div />}
      map={<div />}
      navigation={<div />}
      onCloseDetails={vi.fn()}
      onEnterSelectedRegion={vi.fn()}
      productLabel="玉米"
    />,
  );
}

function dashboardWithoutSupplyMetrics(): OverviewDashboard {
  return {
    scope: {
      prefectureCount: 0,
      countyCount: 0,
      townshipCount: 0,
      villageCount: 0,
      reportingUnitCount: 0,
      approvedRecordCount: 0,
    },
    metrics: [],
    regionPath: [],
    priceTrend: [],
    productStructure: [],
    regionActivity: [],
    alerts: [],
    cultivatedAreaYoY: [],
    outputYoY: [],
    businessTables: [],
  };
}
