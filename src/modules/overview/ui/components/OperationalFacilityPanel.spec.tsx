import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import { OperationalFacilityPanel } from "./OperationalFacilityPanel";

const catalogue: OperationalFacilityCatalogue = {
  regionCode: null,
  productCode: "SOYBEAN",
  asOf: "2026-09-18",
  storageCategories: [
    { code: "OWNED", label: "自有库点", count: 1 },
    { code: "LEASED", label: "租赁库点", count: 0 },
    { code: "HISTORICAL_LEASED", label: "历史租赁库点", count: 0 },
  ],
  storageFacilities: [
    {
      code: "KESHAN_DEPOT",
      name: "中粮贸易（克山）粮食储运有限公司",
      workUnitCode: "KESHAN_DEPOT",
      relationType: "OWNED",
      relationLabel: "自有库点",
      regionCode: "230229",
      regionName: "克山县",
      address: "春风大街36号",
      longitude: 125.8476007,
      latitude: 48.0252548,
      coordinatePrecision: "STREET",
      coordinatePrecisionLabel: "公开地址街道级近似位置",
      operationalStatus: "ACTIVE",
      capacityTonnes: null,
      capacityAsOf: null,
      prices: [
        {
          productCode: "SOYBEAN",
          productName: "大豆",
          qualityRequirement: "蛋白≥39.5%",
          value: 3900,
          unit: "元/吨",
          effectiveOn: "2025-12-05",
          expiresOn: null,
          sourceName: "Mysteel",
          sourceUrl: "https://example.test/price",
          sourceClassification: "PUBLIC_WEB",
          current: false,
        },
      ],
      evidence: [
        {
          kind: "ADDRESS",
          title: "企业公开地址",
          sourceName: "公告",
          sourceUrl: "https://example.test/address",
          sourceClassification: "PUBLIC_DOCUMENT",
          sourceAsOf: "2024-11-23",
          note: "公开地址证据",
        },
      ],
    },
  ],
  railwayFacilities: [
    {
      sourceId: "node/1",
      name: "泰来",
      kind: "STATION",
      longitude: 123.4,
      latitude: 46.4,
      operator: "",
      reference: "",
      status: "",
      service: "",
      locationRelation: "WITHIN",
      distanceKm: 0,
      nearbyLines: "平齐铁路",
      sourceUrl: "https://www.openstreetmap.org/node/1",
    },
  ],
  railwayLines: [
    {
      name: "平齐铁路",
      mappedTrackKm: 12.3,
      usage: "main",
      electrification: "",
      gauge: "1435",
      operator: "",
      sourceUrl: "https://www.openstreetmap.org/way/1",
    },
  ],
  railwayRoutes: [],
  sources: [
    {
      code: "STORAGE",
      label: "关联库点",
      status: "STALE",
      sourceAsOf: "2025-12-05",
      sourceUrl: null,
      notice: "空值表示尚未核定。",
    },
    {
      code: "RAILWAY",
      label: "铁路站点",
      status: "READY",
      sourceAsOf: "2026-09-18T00:00:00Z",
      sourceUrl: "https://www.openstreetmap.org/copyright",
      notice: "地理参考不等于铁路货运营业资质。",
    },
  ],
};

describe("OperationalFacilityPanel", () => {
  it("shows governed storage details without inventing capacity or current price", () => {
    render(
      <OperationalFacilityPanel
        catalogue={catalogue}
        mode="STORAGE_FACILITIES"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("尚未核定")).toBeVisible();
    expect(screen.getByText("历史公开价")).toBeVisible();
    expect(screen.getByText("公开地址街道级近似位置")).toBeVisible();
    expect(screen.getByRole("link", { name: "Mysteel" })).toHaveAttribute(
      "href",
      "https://example.test/price",
    );
  });

  it("uses the railway-specific detail layout and selection callback", async () => {
    const onSelect = vi.fn();
    render(
      <OperationalFacilityPanel
        catalogue={catalogue}
        mode="RAILWAY_FACILITIES"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("article", { name: "泰来铁路站点详情" })).toBeVisible();
    expect(screen.getByText("地理参考不等于铁路货运营业资质。")).toBeVisible();
    expect(screen.getAllByText("平齐铁路")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /泰来/ }));
    expect(onSelect).toHaveBeenCalledWith("node/1");
  });
});
