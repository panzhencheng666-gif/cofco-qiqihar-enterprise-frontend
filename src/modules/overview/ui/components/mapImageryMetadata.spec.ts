import { describe, expect, it } from "vitest";

import {
  imageryLabel,
  imageryWarning,
  satelliteTileUrl,
  type MapImageryMetadata,
} from "./mapImageryMetadata";

const currentMetadata: MapImageryMetadata = {
  provider: "Copernicus Sentinel-2 L2A",
  attribution: "Copernicus Sentinel data",
  updateCadence: "WEEKLY",
  imageryPeriod: "2026-W38",
  acquisitionFrom: "2026-09-18",
  acquisitionTo: "2026-09-20",
  commercialConfigured: false,
  automaticWeeklyPeriod: true,
  syncedAt: "2026-09-21T19:10:00Z",
  spatialResolutionMeters: 10,
  cloudCoveragePercent: 8.4,
  status: "CURRENT",
  sourceProductIds: ["S2B_20260920_QIQIHAR"],
  truthStatement: "Latest available governed weekly observation; not live video.",
};

describe("weekly map imagery presentation", () => {
  it("describes the observation date and resolution truthfully", () => {
    expect(imageryLabel(currentMetadata)).toBe(
      "Copernicus Sentinel-2 L2A · 10米 · 采集 2026年09月18日至2026年09月20日 · 每周一同步",
    );
  });

  it("warns when the previous successful release is retained", () => {
    expect(imageryWarning({ ...currentMetadata, status: "STALE" })).toContain(
      "沿用上一成功版本",
    );
    expect(imageryWarning({ ...currentMetadata, status: "FALLBACK" })).toContain(
      "历史影像",
    );
    expect(imageryWarning(currentMetadata)).toBeUndefined();
  });

  it("changes only the cache-key query when a governed version is available", () => {
    expect(satelliteTileUrl("2026-W38")).toBe(
      "/api/v1/overview/map-imagery/tiles/{z}/{x}/{y}?version=2026-W38",
    );
    expect(satelliteTileUrl("bad/version")).toBe(
      "/api/v1/overview/map-imagery/tiles/{z}/{x}/{y}",
    );
  });

  it("shows monthly observation cadence and accepts monthly release versions", () => {
    expect(imageryLabel({ ...currentMetadata, updateCadence: "MONTHLY" })).toContain(
      "每月更新",
    );
    expect(imageryLabel({ ...currentMetadata, updateCadence: "MONTHLY" })).toContain(
      "近期影像覆盖齐齐哈尔，其他区域沿用历史底图",
    );
    expect(imageryLabel({ ...currentMetadata, updateCadence: "MONTHLY" })).toContain(
      "放大后为历史底图，清晰度随地区变化",
    );
    expect(satelliteTileUrl("2026-09")).toBe(
      "/api/v1/overview/map-imagery/tiles/{z}/{x}/{y}?version=2026-09",
    );
    expect(
      imageryWarning({ ...currentMetadata, updateCadence: "MONTHLY", status: "STALE" }),
    ).toContain("本月");
  });
});
