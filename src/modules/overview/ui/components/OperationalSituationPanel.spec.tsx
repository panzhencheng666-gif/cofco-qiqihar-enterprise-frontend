import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import { OperationalSituationPanel } from "./OperationalSituationPanel";

const selectedRegion: OverviewRegion = {
  code: "230200",
  name: "齐齐哈尔市",
  level: "PREFECTURE",
  approvedRecordCount: 1,
};

const facilities: OperationalFacilityCatalogue = {
  regionCode: null,
  productCode: "CORN",
  asOf: "2026-09-19T04:00:00Z",
  storageCategories: [],
  storageFacilities: [],
  railwayFacilities: [
    {
      sourceId: "rail-1",
      name: "齐齐哈尔站",
      kind: "station",
      longitude: 123.9,
      latitude: 47.35,
      operator: "中国铁路哈尔滨局集团有限公司",
      reference: "公开铁路节点",
      status: "active",
      service: "freight",
      locationRelation: "WITHIN",
      distanceKm: 0,
      nearbyLines: "滨洲铁路",
      sourceUrl: "https://www.openstreetmap.org/",
    },
  ],
  railwayLines: [],
  railwayRoutes: [],
  sources: [],
};

const situation: OperationalSituationCatalogue = {
  generatedAt: "2026-09-19T04:01:00Z",
  weather: [
    {
      rootRegionCode: "230200",
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      longitude: 123.92,
      latitude: 47.35,
      observedAt: "2026-09-19T04:00:00Z",
      meanTemperatureC: 18.4,
      precipitationMm: 1.2,
      soilMoisturePercent: 31,
      weatherCode: 63,
      windSpeedKph: 14,
      windDirectionDegrees: 210,
      cloudCoverPercent: 86,
      observationPrecision: "PREFECTURE",
      risk: "持续降雨需关注",
      assessment: "降水可能影响田间作业。",
      sourceName: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      fetchedAt: "2026-09-19T04:00:30Z",
    },
  ],
  publicEvents: [
    {
      eventId: "event-1",
      title: "不应默认铺开的全球事件",
      description: "很长的外部事件正文",
      categoryCode: "storms",
      categoryLabel: "Severe Storms",
      longitude: 0,
      latitude: 0,
      observedAt: "2026-09-19T04:00:00Z",
      magnitudeValue: null,
      magnitudeUnit: null,
      eventUrl: "https://example.com/event",
      evidenceUrl: null,
      fetchedAt: "2026-09-19T04:00:30Z",
    },
  ],
  policyEvents: [],
  logisticsFlows: [],
  inventories: [
    {
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      productCode: "CORN",
      longitude: 123.92,
      latitude: 47.35,
      inventoryTonnes: 1200,
      sourceCount: 2,
      observedAt: "2026-09-19T04:00:00Z",
    },
  ],
  sources: [
    {
      code: "WEATHER",
      label: "实时天气",
      status: "READY",
      lastAttemptAt: "2026-09-19T04:00:30Z",
      lastSuccessAt: "2026-09-19T04:00:30Z",
      sourceUrl: "https://open-meteo.com/",
      notice: "缓存命中",
    },
  ],
};

const directoryFacilities: OperationalFacilityCatalogue = {
  ...facilities,
  storageCategories: [
    { code: "OWNED", label: "自有库点", count: 1 },
    { code: "LEASED", label: "租赁库点", count: 1 },
    { code: "HISTORICAL_LEASED", label: "历史租赁库点", count: 0 },
  ],
  storageFacilities: [
    {
      code: "owned-1",
      name: "齐齐哈尔自有库",
      workUnitCode: "owned-1",
      relationType: "OWNED",
      relationLabel: "自有库点",
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      address: "建华区",
      longitude: 123.9,
      latitude: 47.35,
      coordinatePrecision: "EXACT",
      coordinatePrecisionLabel: "精确坐标",
      operationalStatus: "ACTIVE",
      capacityTonnes: 1000,
      capacityAsOf: "2026-09-01",
      version: 1,
      prices: [],
      evidence: [],
    },
    {
      code: "leased-1",
      name: "齐齐哈尔租赁库",
      workUnitCode: "leased-1",
      relationType: "LEASED",
      relationLabel: "租赁库点",
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      address: "龙沙区",
      longitude: 123.95,
      latitude: 47.3,
      coordinatePrecision: "STREET",
      coordinatePrecisionLabel: "街道级坐标",
      operationalStatus: "ACTIVE",
      capacityTonnes: null,
      capacityAsOf: null,
      version: 1,
      prices: [],
      evidence: [],
    },
  ],
  railwayFacilities: [
    facilities.railwayFacilities[0]!,
    {
      ...facilities.railwayFacilities[0]!,
      sourceId: "rail-2",
      name: "昂昂溪站",
    },
    {
      ...facilities.railwayFacilities[0]!,
      sourceId: "rail-nearby",
      name: "邻近站",
      locationRelation: "NEARBY",
      distanceKm: 12,
    },
  ],
};

describe("OperationalSituationPanel", () => {
  it("renders one selected-region inspector instead of a dashboard wall", () => {
    render(
      <OperationalSituationPanel
        facilities={facilities}
        productLabel="玉米"
        selectedRegion={selectedRegion}
        situation={situation}
      />,
    );

    expect(screen.getByRole("heading", { name: "齐齐哈尔市" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "齐齐哈尔市实时天气动态场景" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("PUBLIC OPERATIONAL PICTURE")).not.toBeInTheDocument();
    expect(screen.queryByText("NASA EONET 开放事件")).not.toBeInTheDocument();
    expect(screen.queryByText("不应默认铺开的全球事件")).not.toBeInTheDocument();
  });

  it("switches to concise logistics monitoring without leaving the inspector", () => {
    render(
      <OperationalSituationPanel
        facilities={facilities}
        selectedRegion={selectedRegion}
        situation={situation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "物流" }));
    expect(screen.getByText("期末库存")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("暂无审核通过的跨区物流记录")).toBeInTheDocument();
  });

  it("shows every region-scoped depot and railway station with exact counts", () => {
    const onFacilitySelect = vi.fn();
    render(
      <OperationalSituationPanel
        facilities={directoryFacilities}
        onFacilitySelect={onFacilitySelect}
        selectedRegion={selectedRegion}
        situation={{ ...situation, weather: [] }}
      />,
    );

    expect(screen.getByRole("button", { name: "库点 2" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /库点记录$/ })).toHaveLength(2);
    expect(screen.getByLabelText("自有库点 1")).toBeVisible();
    expect(screen.getByLabelText("租赁库点 1")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "铁路 2" }));
    expect(screen.getByLabelText("境内站点 2")).toBeVisible();
    expect(screen.getByLabelText("邻近站点 1")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /铁路站点记录$/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "邻近站铁路站点记录" }));
    expect(onFacilitySelect).toHaveBeenCalledWith("rail-nearby");
  });
});
