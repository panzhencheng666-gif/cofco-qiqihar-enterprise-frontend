import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OverviewDataModePanel, OverviewDataModeTabs } from "./OverviewDataModePanel";

describe("OverviewDataModePanel", () => {
  it("keeps sample points as the default mode and exposes independent regional and supply modes", async () => {
    const onModeChange = vi.fn();
    render(<OverviewDataModeTabs mode="SAMPLE_POINTS" onModeChange={onModeChange} />);

    expect(screen.getByRole("button", { name: "样本点" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "地区数据" }));
    expect(onModeChange).toHaveBeenCalledWith("REGIONAL_DATA");
  });

  it("renders regional metrics without embedding the mode navigation", () => {
    render(
      <OverviewDataModePanel
        mode="REGIONAL_DATA"
        productLabel="玉米"
        regionalSummary={{
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          administrativeLevel: "PREFECTURE",
          year: 2026,
          productCode: "CORN",
          plantedAreaMu: "1500000.0000",
          yieldPerMuKg: "650.0000",
          totalOutputKg: "975000000.0000",
          areaChangeWanMu: "10.0000",
          areaChangeRatePercent: "7.1429",
          currentDataAvailable: true,
          comparisonAvailable: true,
          areaChangeRateAvailable: true,
          comparisonMessage: "已按2025年对比",
        }}
      />,
    );

    expect(screen.getByText("播种面积")).toBeInTheDocument();
    expect(screen.getByText("单产")).toBeInTheDocument();
    expect(screen.getByText("总产")).toBeInTheDocument();
    expect(screen.getByText("结构调整增减")).toBeInTheDocument();
    expect(screen.getByText("增减比率")).toBeInTheDocument();
    expect(screen.getByText("2026年 · 玉米")).toBeInTheDocument();
    expect(screen.queryByText(/CORN/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "总揽展示内容" }),
    ).not.toBeInTheDocument();
  });

  it("shows automatic crop structure and formula forecasts in the regional sidebar", () => {
    render(
      <OverviewDataModePanel
        mode="REGIONAL_DATA"
        agricultureProfile={{
          regionCode: "231100",
          regionName: "黑河市",
          administrativeLevel: "PREFECTURE",
          year: 2026,
          automatic: true,
          generatedAt: "2026-09-14T10:00:00Z",
          sourceSummary: "地区年度正式数据优先，缺项由统计模型自动补齐",
          calculationMethod: "结构系数估算；复合增长公式预测",
          crops: [
            {
              productCode: "CORN",
              productName: "玉米",
              dataKind: "OBSERVED",
              plantedAreaMu: "1000000",
              yieldPerMuKg: "600",
              totalOutputKg: "600000000",
              structurePercent: "40",
              basis: "采用地区年度正式数据自动汇总",
              forecasts: [
                {
                  year: 2027,
                  plantedAreaMu: "1012000",
                  yieldPerMuKg: "604.8",
                  totalOutputKg: "612057600",
                },
              ],
            },
            {
              productCode: "SOYBEAN",
              productName: "大豆",
              dataKind: "MODEL_ESTIMATE",
              plantedAreaMu: "1375000",
              yieldPerMuKg: "155",
              totalOutputKg: "213125000",
              structurePercent: "55",
              basis: "依据公开行政区边界面积和结构系数推算",
              forecasts: [],
            },
            {
              productCode: "RICE",
              productName: "水稻",
              dataKind: "MODEL_ESTIMATE",
              plantedAreaMu: "125000",
              yieldPerMuKg: "520",
              totalOutputKg: "65000000",
              structurePercent: "5",
              basis: "依据公开行政区边界面积和结构系数推算",
              forecasts: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "黑河市农业概况" })).toBeVisible();
    expect(screen.getByText("系统自动生成 · 无需人工填报")).toBeVisible();
    expect(screen.getByText("种植结构")).toBeVisible();
    expect(screen.getByText("未来三年推算")).toBeVisible();
    expect(screen.getByText("统计值")).toBeVisible();
    expect(screen.getAllByText("模型推算")).toHaveLength(2);
    expect(screen.getByText("2027年")).toBeVisible();
  });

  it("renders an unfilled manual balance field without rejecting the backend contract", () => {
    render(
      <OverviewDataModePanel
        mode="SUPPLY_BALANCE"
        productLabel="玉米"
        supplyBalance={{
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          administrativeLevel: "PREFECTURE",
          surveyYear: 2026,
          productCode: "CORN",
          regionalProductionAvailable: false,
          version: 0,
          updatedAt: null,
          rows: [
            {
              code: "OPENING_INVENTORY",
              label: "期初库存",
              kind: "MANUAL",
              unit: "万吨",
              requirement: "按本地区本年度实际口径填报",
              value: null,
              display: null,
              note: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("齐齐哈尔市供需平衡")).toBeVisible();
    expect(screen.getByRole("cell", { name: "待填报" })).toBeVisible();
  });

  it("presents key supply indicators and preserves the complete formal table", () => {
    render(
      <OverviewDataModePanel
        mode="SUPPLY_BALANCE"
        productLabel="玉米"
        supplyBalance={{
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          administrativeLevel: "PREFECTURE",
          surveyYear: 2026,
          productCode: "CORN",
          regionalProductionAvailable: true,
          version: 3,
          updatedAt: "2026-08-28T09:00:00+08:00",
          rows: [
            balanceRow("OUTPUT", "产量", "AUTO", "124.07", "系统读取地区总产"),
            balanceRow(
              "OPENING_INVENTORY",
              "期初库存",
              "MANUAL",
              null,
              "按正式口径填报",
            ),
            balanceRow("TOTAL_SUPPLY", "总供给", "DERIVED", "150.00", "系统自动计算"),
            balanceRow("TOTAL_DEMAND", "总需求", "DERIVED", null, "系统自动计算"),
            balanceRow(
              "CLOSING_INVENTORY",
              "期末库存",
              "DERIVED",
              null,
              "系统自动计算",
            ),
            balanceRow(
              "DEMAND_SUPPLY_RATIO",
              "需求供给比",
              "RATIO",
              null,
              "系统自动计算",
            ),
          ],
        }}
      />,
    );

    const metrics = screen.getByRole("list", { name: "供需平衡核心指标" });
    expect(within(metrics).getByText("产量")).toBeVisible();
    expect(within(metrics).getByText("总供给")).toBeVisible();
    expect(within(metrics).getByText("总需求")).toBeVisible();
    expect(within(metrics).getByText("期末库存")).toBeVisible();
    expect(within(metrics).getByText("需求供给比")).toBeVisible();
    expect(within(metrics).getAllByText("计算条件未完整")).toHaveLength(2);
    expect(within(metrics).getByText("不可计算")).toBeVisible();

    const table = screen.getByRole("table", { name: "供需平衡完整明细" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(
      within(table).queryByRole("columnheader", { name: "口径" }),
    ).not.toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(
      within(table).getByRole("row", {
        name: /期初库存 按正式口径填报 待填报 万吨/,
      }),
    ).toBeVisible();
    expect(within(table).getByRole("cell", { name: "待填报" })).toBeVisible();
    expect(within(table).getAllByRole("cell", { name: "计算条件未完整" })).toHaveLength(
      2,
    );
    expect(within(table).getByRole("cell", { name: "不可计算" })).toBeVisible();
  });
});

function balanceRow(
  code: string,
  label: string,
  kind: "AUTO" | "MANUAL" | "DERIVED" | "RATIO",
  display: string | null,
  requirement: string,
) {
  return {
    code,
    label,
    kind,
    unit: kind === "RATIO" ? "%" : "万吨",
    requirement,
    value: display,
    display,
    note: null,
  } as const;
}
