import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
