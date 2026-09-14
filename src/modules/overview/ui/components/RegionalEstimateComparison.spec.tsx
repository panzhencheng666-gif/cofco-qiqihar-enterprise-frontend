import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegionalEstimateComparison } from "./RegionalEstimateComparison";
import type { RegionalEstimateBatch } from "../../domain/regionalEstimates";
const batch: RegionalEstimateBatch = {
  rootRegionCode: "230200",
  year: 2026,
  calculatedAt: "2026-09-14T00:30:00Z",
  attemptedAt: "2026-09-14T00:30:00Z",
  sourceCheckedAt: "2026-09-14T00:29:00Z",
  calculationStatus: "RECALCULATED_UNCHANGED",
  sourceStatus: "PARTIAL",
  modelVersion: "current-estimate-v1",
  comparisons: [
    {
      label: "稻谷产量",
      category: "CROP_GRAIN",
      unit: "万吨",
      publicYear: 2025,
      publicValue: "284.5",
      sourceName: "统计公报",
      sourceUrl: "https://example.org/report",
      estimateYear: 2026,
      current: {
        value: "292",
        model: "线性趋势",
        selection: "逐年留出回测误差较低",
        formula: "历史拟合参数计算得到292万吨",
        inputs: [
          {
            year: 2025,
            value: "284.5",
            unit: "万吨",
            source: "统计公报",
            url: "https://example.org/report",
          },
        ],
        candidates: [
          { model: "线性趋势", meanAbsoluteError: "1.2", validationYears: 2 },
        ],
      },
      difference: null,
      differencePercent: null,
      historicalCheck: null,
      historicalDifference: null,
      conclusion: "不同年度不能当成误差比较",
    },
  ],
};
describe("regional current estimates", () => {
  it("separates published period, current estimate and unchanged calculation from failed sources", () => {
    render(<RegionalEstimateComparison batch={batch} />);
    expect(screen.getByText("已重新计算，结果无变化")).toBeInTheDocument();
    expect(screen.getByText("部分来源未完成核验")).toBeInTheDocument();
    expect(screen.getByText("公开值 · 2025年")).toBeInTheDocument();
    expect(screen.getByText("当前估算 · 2026年")).toBeInTheDocument();
    expect(screen.getByText("年度不同，不计算差额")).toBeInTheDocument();
    fireEvent.click(screen.getByText("查看稻谷产量的估算逻辑与对比"));
    expect(screen.getByText("逐年留出回测误差较低")).toBeVisible();
    expect(screen.getByRole("link", { name: "2025年 · 统计公报" })).toHaveAttribute(
      "href",
      "https://example.org/report",
    );
  });
});
