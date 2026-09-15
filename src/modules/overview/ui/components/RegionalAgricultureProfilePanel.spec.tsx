import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { RegionalAgricultureProfilePanel } from "./RegionalAgricultureProfilePanel";
import type { RegionalAgricultureProfile } from "../../domain/overviewRegionalData";

const profile: RegionalAgricultureProfile = {
  regionCode: "230221100001",
  regionName: "龙东村",
  administrativeLevel: "VILLAGE",
  year: 2026,
  automatic: true,
  generatedAt: "2026-09-15T00:30:00Z",
  sourceSummary: "统计资料",
  calculationMethod: "逐级分配",
  regionFacts: {
    areaSquareKilometres: 1,
    directChildCount: 0,
    countyCount: 0,
    townshipCount: 0,
    villageCount: 0,
  },
  sources: [
    {
      id: "search",
      type: "AGRICULTURE",
      name: "公开资料检索",
      url: "https://example.org",
      sourceClass: "PUBLIC_SEARCH",
      reliabilityWeight: "0.5",
      publishedOn: null,
      fetchedAt: null,
      status: "SEARCH_PARTIAL",
      evidence: "搜索引擎HTTP 500 generationtime_ms",
    },
  ],
  crops: [
    {
      productCode: "RICE",
      productName: "稻谷",
      dataKind: "MODEL_ESTIMATE",
      plantedAreaMu: "100",
      yieldPerMuKg: "500",
      totalOutputKg: "50000",
      structurePercent: "100",
      basis:
        "选择依据：龙江镇同作物资料。\n面积分配：1000亩×0.1=100亩。\n适用假设：同级密度接近。",
      forecasts: [],
    },
  ],
};
it("shows business wording and separates each step of a village estimate", () => {
  const { container } = render(<RegionalAgricultureProfilePanel profile={profile} />);
  expect(container.textContent).not.toMatch(
    /HTTP 500|generationtime_ms|耕作系数|避免把网页正文堆进页面/,
  );
  expect(screen.getByRole("tab", { name: "地区概况" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.queryByRole("button", { name: /^面积/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "种植预测" }));
  fireEvent.click(screen.getByRole("button", { name: "宽屏阅读" }));
  expect(screen.getByRole("button", { name: "恢复分栏" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^面积/ }));
  const detail = screen.getByRole("dialog", { name: "稻谷面积计算与来源说明" });
  expect(within(detail).getByText("选择依据：龙江镇同作物资料。")).toBeVisible();
  expect(within(detail).getByText("面积分配：1000亩×0.1=100亩。")).toBeVisible();
  expect(within(detail).getByText("适用假设：同级密度接近。")).toBeVisible();
});

it.each([
  ["230221", "COUNTY"],
  ["231182100", "TOWNSHIP"],
  ["150721100001", "VILLAGE"],
  ["232721", "COUNTY"],
])(
  "keeps local estimates separate from city batches for %s",
  (regionCode, administrativeLevel) => {
    render(
      <RegionalAgricultureProfilePanel
        profile={{
          ...profile,
          regionCode,
          administrativeLevel,
          estimateBatch: {
            rootRegionCode: regionCode.slice(0, 4) + "00",
            year: 2026,
            calculatedAt: "",
            attemptedAt: "",
            sourceCheckedAt: "",
            calculationStatus: "",
            sourceStatus: "",
            modelVersion: "",
            comparisons: [
              {
                label: "稻谷产量",
                category: "CROP_GRAIN",
                unit: "万吨",
                publicYear: 2025,
                publicValue: "312",
                sourceName: "地市统计公报",
                sourceUrl: "https://example.org",
                estimateYear: 2026,
                current: null,
                difference: null,
                differencePercent: null,
                historicalCheck: null,
                historicalDifference: null,
                conclusion: "",
              },
            ],
          },
          indicators: [
            {
              category: "LOGISTICS",
              label: "上级参考·铁路货运量",
              value: "900",
              unit: "万吨",
              dataYear: 2025,
              dataKind: "CONTEXT",
              method: "地市参考",
              sourceName: "公报",
              sourceUrl: "https://example.org",
            },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "估算对比" }));
    const table = screen.getByRole("table", { name: "本地区指标对照表" });
    expect(within(table).getByText("0.005 万吨")).toBeVisible();
    expect(within(table).getByText("未取得同地区公开值")).toBeVisible();
    expect(table.textContent).not.toMatch(/312|900|上级参考/);
    fireEvent.click(screen.getByRole("tab", { name: "天气政策" }));
    expect(screen.getByText(/尚未取得龙东村的独立气象观测/)).toBeVisible();
    expect(screen.getByText(/政策适用范围以原文为准/)).toBeVisible();
  },
);
