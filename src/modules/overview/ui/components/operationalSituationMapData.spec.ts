import { describe, expect, it } from "vitest";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import { operationalMarkers, railwayRouteGeoJson } from "./operationalSituationMapData";

const facilities = {
  storageFacilities: [],
  railwayFacilities: [],
  railwayRoutes: [
    {
      id: "230200:滨洲铁路",
      name: "滨洲铁路",
      geometryGeoJson: '{"type":"LineString","coordinates":[[123,47],[120,49]]}',
      usage: "main",
      operator: "",
      sourceUrl: "https://www.openstreetmap.org/way/1",
    },
  ],
} as unknown as OperationalFacilityCatalogue;

const situation = {
  weather: [
    {
      rootRegionCode: "230200",
      regionName: "齐齐哈尔市",
      longitude: 123.92,
      latitude: 47.35,
      risk: "常规",
    },
  ],
  publicEvents: [],
} as unknown as OperationalSituationCatalogue;

describe("operational situation map data", () => {
  it("keeps weather in administrative details instead of creating map markers", () => {
    expect(operationalMarkers(facilities, situation)).toEqual([]);
  });

  it("creates source-labelled railway route features from backend geometry", () => {
    expect(railwayRouteGeoJson(facilities.railwayRoutes)).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [123, 47],
              [120, 49],
            ],
          },
          properties: {
            id: "230200:滨洲铁路",
            name: "滨洲铁路",
            sourceUrl: "https://www.openstreetmap.org/way/1",
          },
        },
      ],
    });
  });
});
