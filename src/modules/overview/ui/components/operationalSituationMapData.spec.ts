import { describe, expect, it } from "vitest";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import {
  logisticsFlowGeoJson,
  operationalMarkers,
  railwayRouteGeoJson,
} from "./operationalSituationMapData";

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

  it("connects actual logistics origins and destinations without interpolated waypoints", () => {
    expect(
      logisticsFlowGeoJson([
        {
          eventId: "event-1",
          productCode: "CORN",
          direction: "OUTBOUND",
          originRegionCode: "230200",
          originRegionName: "齐齐哈尔市",
          originLongitude: 123.92,
          originLatitude: 47.35,
          destinationRegionCode: "150700",
          destinationRegionName: "呼伦贝尔市",
          destinationLongitude: 119.77,
          destinationLatitude: 49.21,
          volumeTonnes: 800,
          occurredAt: "2026-09-19T02:00:00Z",
          transportMode: "铁路",
        },
      ]),
    ).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [123.92, 47.35],
              [119.77, 49.21],
            ],
          },
          properties: {
            id: "event-1",
            name: "齐齐哈尔市 → 呼伦贝尔市",
            volumeTonnes: 800,
          },
        },
      ],
    });
  });
});
