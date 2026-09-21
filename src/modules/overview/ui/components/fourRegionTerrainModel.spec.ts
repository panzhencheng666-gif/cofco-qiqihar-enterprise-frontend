import { describe, expect, it } from "vitest";

import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import {
  ALL_ATLAS_SOURCE_IDS,
  atlasLayerVisibilityKey,
  changedAtlasSources,
  fourRegionContextMaskCollection,
  railwayMarkerPresentation,
  settledMarkerImages,
  terrainEnhancementStateAfterInitialIdle,
  terrainEnhancementStateForFailures,
  terrainEnhancementStateForSource,
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

describe("four-region public map presentation policy", () => {
  it.each([
    ["satellite", "DEGRADED_IMAGERY"],
    ["terrain-dem", "DEGRADED_TERRAIN"],
    ["hillshade-dem", "DEGRADED_TERRAIN"],
    ["openmaptiles", "DEGRADED_BASEMAP"],
  ])("attributes %s failures to the correct enhancement", (sourceId, expected) => {
    expect(terrainEnhancementStateForSource(sourceId)).toBe(expected);
  });

  it("ignores map errors that do not belong to a governed remote source", () => {
    expect(terrainEnhancementStateForSource("atlas-markers")).toBeUndefined();
    expect(terrainEnhancementStateForSource(undefined)).toBeUndefined();
  });

  it("does not erase a real degradation when the map next becomes idle", () => {
    expect(terrainEnhancementStateAfterInitialIdle([])).toBe("READY");
    expect(terrainEnhancementStateAfterInitialIdle(["DEGRADED_IMAGERY"])).toBe(
      "DEGRADED_IMAGERY",
    );
    expect(
      terrainEnhancementStateAfterInitialIdle(["DEGRADED_IMAGERY", "DEGRADED_TERRAIN"]),
    ).toBe("DEGRADED_MULTIPLE");
  });

  it("reports multiple simultaneous source failures without claiming one source", () => {
    expect(terrainEnhancementStateForFailures([])).toBeUndefined();
    expect(terrainEnhancementStateForFailures(["DEGRADED_ICONS"])).toBe(
      "DEGRADED_ICONS",
    );
    expect(
      terrainEnhancementStateForFailures(["DEGRADED_BASEMAP", "DEGRADED_IMAGERY"]),
    ).toBe("DEGRADED_MULTIPLE");
    expect(
      terrainEnhancementStateForFailures(["DEGRADED_IMAGERY", "DEGRADED_IMAGERY"]),
    ).toBe("DEGRADED_IMAGERY");
  });

  it("keeps outside imagery limited to a 25 kilometre context ring", () => {
    const qiqihar = feature("230200", "齐齐哈尔市", [
      [123, 46],
      [124, 46],
      [124, 47],
      [123, 46],
    ]);

    const mask = fourRegionContextMaskCollection([qiqihar], 25);
    const outside = mask.features.find(
      (item) => item.properties?.kind === "outside-four-region-context",
    );
    const context = mask.features.find(
      (item) => item.properties?.kind === "four-region-context-ring",
    );
    const coordinates = context ? flattenGeoJsonCoordinates(context.geometry) : [];
    const longitudes = coordinates.map(([longitude]) => longitude);
    const latitudes = coordinates.map(([, latitude]) => latitude);

    expect(outside).toBeDefined();
    expect(context).toBeDefined();
    expect(Math.min(...longitudes)).toBeLessThan(123);
    expect(Math.max(...longitudes)).toBeGreaterThan(124);
    expect(Math.min(...latitudes)).toBeLessThan(46);
    expect(Math.max(...latitudes)).toBeGreaterThan(47);
    expect(Math.min(...longitudes)).toBeGreaterThan(122.5);
    expect(Math.max(...longitudes)).toBeLessThan(124.5);
  });

  it("labels nearby railway facilities without changing local facility names", () => {
    expect(railwayMarkerPresentation("NEARBY", "北安")).toEqual({
      nearby: true,
      name: "邻近 · 北安",
      relation: "NEARBY",
    });
    expect(railwayMarkerPresentation("WITHIN", "齐齐哈尔")).toEqual({
      nearby: false,
      name: "齐齐哈尔",
      relation: "WITHIN",
    });
  });

  it("keeps successfully loaded marker images when another image fails", () => {
    const loaded = { id: "railway", image: { width: 48 } };
    const result = settledMarkerImages([
      { status: "fulfilled", value: loaded },
      { status: "rejected", reason: new Error("bad icon") },
    ]);

    expect(result).toEqual({ hasFailures: true, images: [loaded] });
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

function flattenGeoJsonCoordinates(geometry: {
  coordinates: unknown;
}): [number, number][] {
  const result: [number, number][] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      result.push([value[0], value[1]]);
      return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
  return result;
}
