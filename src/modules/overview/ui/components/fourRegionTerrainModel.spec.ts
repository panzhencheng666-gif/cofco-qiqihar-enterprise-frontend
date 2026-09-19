import { describe, expect, it } from "vitest";

import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import {
  ALL_ATLAS_SOURCE_IDS,
  atlasLayerVisibilityKey,
  changedAtlasSources,
  terrainFocusBounds,
  type AtlasSourceReferences,
} from "./fourRegionTerrainModel";

describe("four-region terrain source synchronization", () => {
  const shared = {};
  const base: AtlasSourceReferences = {
    annotation: shared,
    annotationDraftKey: "",
    backdrop: shared,
    features: shared,
    inventories: shared,
    logisticsFlows: shared,
    markerLayerKey: "1111",
    railwayFacilities: shared,
    railwayRoutes: shared,
    selectedFacilityId: undefined,
    selectedRegionCode: undefined,
    storageFacilities: shared,
    weather: shared,
  };

  it("loads every public-situation source once on first synchronization", () => {
    expect(changedAtlasSources(undefined, base)).toEqual(ALL_ATLAS_SOURCE_IDS);
  });

  it("does not refresh any map source for an unrelated parent render", () => {
    expect(changedAtlasSources(base, { ...base })).toEqual([]);
  });

  it("refreshes only markers when the selected facility changes", () => {
    expect(
      changedAtlasSources(base, { ...base, selectedFacilityId: "owned-1" }),
    ).toEqual(["markers"]);
  });

  it("refreshes only logistics when a new logistics snapshot arrives", () => {
    expect(
      changedAtlasSources(base, { ...base, logisticsFlows: [{ id: "flow-1" }] }),
    ).toEqual(["logistics"]);
  });

  it("keeps an unrelated render from changing the layer visibility key", () => {
    const layers = {
      ADMINISTRATIVE: true,
      HISTORICAL_LEASED: true,
      INVENTORY: true,
      LEASED: true,
      LOGISTICS: true,
      OWNED: true,
      RAILWAY: true,
      RAILWAY_ROUTE: true,
      WEATHER: true,
    };

    expect(atlasLayerVisibilityKey(layers)).toBe(
      atlasLayerVisibilityKey({ ...layers }),
    );
    expect(atlasLayerVisibilityKey({ ...layers, WEATHER: false })).not.toBe(
      atlasLayerVisibilityKey(layers),
    );
  });
});

describe("four-region continuous terrain focus", () => {
  const qiqihar = feature("230200", "齐齐哈尔市", [
    [123, 46],
    [124, 46],
    [124, 47],
    [123, 46],
  ]);
  const heihe = feature("231100", "黑河市", [
    [126, 49],
    [127, 49],
    [127, 50],
    [126, 49],
  ]);

  const fallback = {
    minLongitude: 120,
    minLatitude: 44,
    maxLongitude: 130,
    maxLatitude: 54,
  };

  it("focuses an explicitly selected region without clipping the terrain", () => {
    expect(terrainFocusBounds(undefined, [qiqihar, heihe], "230200", fallback)).toEqual(
      {
        minLongitude: 123,
        minLatitude: 46,
        maxLongitude: 124,
        maxLatitude: 47,
      },
    );
  });

  it("focuses the current administrative backdrop after drilldown", () => {
    expect(terrainFocusBounds(qiqihar, [heihe], undefined, fallback)).toEqual({
      minLongitude: 123,
      minLatitude: 46,
      maxLongitude: 124,
      maxLatitude: 47,
    });
  });

  it("uses the supplied extent when no focused geometry is available", () => {
    expect(terrainFocusBounds(undefined, [], undefined, fallback)).toEqual(fallback);
  });

  it("does not retain a mask source that can darken or cut out the map", () => {
    expect(ALL_ATLAS_SOURCE_IDS).not.toContain("mask");
  });
});

function feature(code: string, name: string, ring: [number, number][]): MapFeature {
  const region: OverviewRegion = {
    approvedRecordCount: null,
    code,
    level: "PREFECTURE",
    name,
    parentCode: "ROOT",
  };
  return {
    region,
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
