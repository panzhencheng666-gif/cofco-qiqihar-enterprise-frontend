import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { RegionalAgricultureProfilePanel } from "./RegionalAgricultureProfilePanel";
import type { RegionalAgricultureProfile } from "../../domain/overviewRegionalData";

it("shows business wording and separates each step of a village estimate", () => {
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
  const { container } = render(<RegionalAgricultureProfilePanel profile={profile} />);
  expect(container.textContent).not.toMatch(
    /HTTP 500|generationtime_ms|耕作系数|避免把网页正文堆进页面/,
  );
  fireEvent.click(screen.getByRole("button", { name: /^面积/ }));
  const detail = screen.getByRole("dialog", { name: "稻谷面积计算与来源说明" });
  expect(within(detail).getByText("选择依据：龙江镇同作物资料。")).toBeVisible();
  expect(within(detail).getByText("面积分配：1000亩×0.1=100亩。")).toBeVisible();
  expect(within(detail).getByText("适用假设：同级密度接近。")).toBeVisible();
});
