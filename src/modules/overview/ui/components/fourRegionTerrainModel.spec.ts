import { describe, expect, it } from "vitest";

import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import {
  ALL_ATLAS_SOURCE_IDS,
  atlasLayerVisibilityKey,
  changedAtlasSources,
  createTerrainSurfaceMask,
  terrainFootprint,
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

describe("four-region terrain surface mask", () => {
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

  it("cuts only governed region shapes out of the blank surrounding world", () => {
    const mask = createTerrainSurfaceMask([qiqihar, heihe], {
      minLongitude: 120,
      minLatitude: 44,
      maxLongitude: 130,
      maxLatitude: 54,
    });

    expect(mask.features[0]?.geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [120, 44],
          [130, 44],
          [130, 54],
          [120, 54],
          [120, 44],
        ],
        qiqihar.geometry.coordinates[0],
        heihe.geometry.coordinates[0],
      ],
    });
  });

  it("uses the selected parent as the sole terrain footprint after drilldown", () => {
    expect(terrainFootprint(undefined, [qiqihar, heihe])).toEqual([qiqihar, heihe]);
    expect(terrainFootprint(qiqihar, [heihe])).toEqual([qiqihar]);
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
