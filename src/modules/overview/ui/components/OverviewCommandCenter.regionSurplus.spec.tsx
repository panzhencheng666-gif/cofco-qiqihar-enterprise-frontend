import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OverviewDashboard } from "../../domain/overview";
import { OverviewCommandCenter } from "./OverviewCommandCenter";

describe("OverviewCommandCenter region surplus", () => {
  it("places the backend-derived region surplus in the seventh card after ending inventory", () => {
    renderCenter(dashboardWithSurplus("32", "AVAILABLE", 2));

    const cards = within(
      screen.getByRole("region", { name: "总揽关键指标" }),
    ).getAllByRole("article");
    expect(
      cards.map((card) => within(card).getByRole("paragraph").textContent),
    ).toEqual([
      "粮食播种面积",
      "预计总产量",
      "平均成交价",
      "总供给",
      "总需求",
      "期末库存",
      "地区余粮",
    ]);
    expect(within(cards[6]!).getByText("32")).toBeVisible();
    expect(within(cards[6]!).getByText("吨")).toBeVisible();
    expect(within(cards[6]!).getByText("2 条审核来源 · 截止 2026-08-10")).toBeVisible();
  });

  it("shows no reliable data instead of zero for every fail-closed coverage state", () => {
    renderCenter(dashboardWithSurplus(null, "CUTOFF_MISMATCH", 0));

    const card = screen.getByRole("article", { name: /地区余粮/ });
    expect(within(card).getByText("暂无可靠数据")).toBeVisible();
    expect(within(card).queryByText("0")).not.toBeInTheDocument();
    expect(within(card).getByText("审核来源统计截止日不一致")).toBeVisible();
  });

  it("distinguishes missing approved sources from unreliable sources", () => {
    renderCenter(dashboardWithSurplus(null, "NO_APPROVED_SOURCES", 0));

    const card = screen.getByRole("article", { name: /地区余粮/ });
    expect(within(card).getByText("暂无审核数据")).toBeVisible();
    expect(within(card).getByText("暂无审核来源")).toBeVisible();
    expect(within(card).queryByText("暂无可靠数据")).not.toBeInTheDocument();
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

function dashboardWithSurplus(
  value: string | null,
  coverageStatus: "AVAILABLE" | "NO_APPROVED_SOURCES" | "CUTOFF_MISMATCH",
  sourceCount: number,
): OverviewDashboard {
  return {
    scope: {
      countyCount: 0,
      townshipCount: 0,
      villageCount: 0,
      reportingUnitCount: 0,
      approvedRecordCount: sourceCount,
    },
    metrics: [
      {
        code: "REGION_SURPLUS",
        name: "地区余粮",
        unitCode: "吨",
        value,
        sourceCount,
        dataCutoff: "2026-08-10",
        coverageStatus,
        calculationVersion: "REGION_SURPLUS_V1",
        auditSources: [],
      },
    ],
    regionPath: [],
    priceTrend: [],
    productStructure: [],
    regionActivity: [],
    alerts: [],
    cultivatedAreaYoY: [],
    outputYoY: [],
  };
}
