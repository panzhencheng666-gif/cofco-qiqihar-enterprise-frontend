import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OverviewDashboard } from "../../domain/overview";
import { OverviewCommandCenter } from "./OverviewCommandCenter";

describe("OverviewCommandCenter region surplus", () => {
  it("labels the aggregate ring with production and market only", () => {
    renderCenter(dashboardWithSurplus("32", "AVAILABLE", 2));

    const legend = screen.getByRole("complementary");
    expect(within(legend).getByText("生产类样本点")).toBeVisible();
    expect(within(legend).getByText("市场类样本点")).toBeVisible();
    expect(within(legend).queryByText(/物流/)).not.toBeInTheDocument();
  });

  it("places the backend-derived region surplus after the six non-duplicated business metrics", () => {
    renderCenter(dashboardWithSurplus("32", "AVAILABLE", 2));

    const cards = within(
      screen.getByRole("region", { name: "总揽关键指标" }),
    ).getAllByRole("article");
    expect(
      cards.map((card) => within(card).getByRole("paragraph").textContent),
    ).toEqual([
      "粮食播种面积",
      "预计总产量",
      "平均收购价",
      "平均销售价",
      "总供给",
      "总需求",
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

  it("shows a partial public-field value with its missing business domain disclosed", () => {
    renderCenter(dashboardWithSurplus("82297", "PARTIAL", 235));

    const card = screen.getByRole("article", { name: /地区余粮/ });
    expect(within(card).getByText("82,297")).toBeVisible();
    expect(
      within(card).getByText("235 条产情审核来源 · 市场暂无审核来源 · 截止 2026-08-10"),
    ).toBeVisible();
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
  coverageStatus: "AVAILABLE" | "PARTIAL" | "NO_APPROVED_SOURCES" | "CUTOFF_MISMATCH",
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
        auditSources:
          coverageStatus === "PARTIAL"
            ? [
                {
                  adopted: true,
                  adoptionReason: "LATEST_VISIBLE_APPROVED_SOURCE",
                  approvedAt: "2026-08-10T10:00:00+08:00",
                  cargoOwnerKey: "VISIBLE|公开产情样本点|13800000003",
                  dataCutoff: "2026-08-10",
                  ownershipType: "PRODUCTION_SURPLUS",
                  regionCode: "230208",
                  sourceDomain: "PRODUCTION",
                  sourceRecordId: "production-1",
                  sourceVersion: 2,
                  subjectKey: "VISIBLE|公开产情样本点|13800000003",
                  valueTonnes: 82297,
                },
              ]
            : [],
        calculationVersion: "REGION_SURPLUS_V1",
        code: "REGION_SURPLUS",
        coverageScope: "region=230200;product=CORN;year=2026;descendants=included",
        coverageStatus,
        dataCutoff: "2026-08-10",
        formula: "SUM(adopted approved inventory)",
        name: "地区余粮",
        sourcePath: "/api/v1/overview/dashboard",
        sourceRelation: "production.production_record + market.market_record",
        unitCode: "吨",
        value,
        sourceCount,
      },
    ],
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
