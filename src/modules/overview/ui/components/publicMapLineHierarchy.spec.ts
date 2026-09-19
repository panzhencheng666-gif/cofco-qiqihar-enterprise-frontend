import { expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { FOUR_REGION_DETAIL_LAYERS, FOUR_REGION_REMOTE_SOURCES } from "./fourRegionTerrainStyle";
import * as style from "./fourRegionTerrainStyle";

it("dims context boundaries after drilling while reserving emphasis for selection", () => {
  expect(style).toHaveProperty("publicBoundaryHierarchy");
  const hierarchy = (style as unknown as {publicBoundaryHierarchy: (drilled: boolean, selected: boolean) => {rootOpacity: unknown; activeOpacity: unknown; rootLabels: string}}).publicBoundaryHierarchy;
  expect(hierarchy(true, true)).toEqual({rootOpacity: 0.16, activeOpacity: ["case", ["==", ["get", "selected"], true], 1, 0.42], rootLabels: "none"});
  expect(hierarchy(false, false)).toEqual({rootOpacity: 0.8, activeOpacity: 0.76, rootLabels: "visible"});
});

it("keeps the public road network muted and minor roads out of regional views", () => {
  const roads = FOUR_REGION_DETAIL_LAYERS.find(layer => layer.id === "atlas-roads");
  expect(roads?.type).toBe("line");
  if (roads?.type !== "line") return;
  expect(roads.paint?.["line-color"]).toBe("#9daea9");
  expect(roads.paint?.["line-opacity"]).toBeLessThanOrEqual(0.4);
  expect(roads.filter).toEqual(["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]]);
  expect(FOUR_REGION_DETAIL_LAYERS.find(layer => layer.id === "atlas-minor-roads")?.minzoom).toBe(12);
  expect(FOUR_REGION_DETAIL_LAYERS.some(layer => layer.id === "atlas-roads-casing")).toBe(false);
});

it("shows only small settlement labels from the basemap at detailed zooms", () => {
  const places = FOUR_REGION_DETAIL_LAYERS.find(layer => layer.id === "atlas-place-labels");
  expect(places?.type).toBe("symbol");
  if (places?.type !== "symbol") return;
  expect(places?.minzoom).toBe(12);
  expect(places?.filter).toEqual(["in", ["get", "class"], ["literal", ["hamlet", "isolated_dwelling", "neighbourhood"]]]);
  expect(FOUR_REGION_DETAIL_LAYERS.find(layer => layer.id === "atlas-road-labels")?.minzoom).toBe(13);
});

it("keeps all actual public detail layers valid for MapLibre", () => {
  expect(validateStyleMin({version: 8, glyphs: "https://example.com/{fontstack}/{range}.pbf", sources: FOUR_REGION_REMOTE_SOURCES, layers: FOUR_REGION_DETAIL_LAYERS}).map(error => error.message)).toEqual([]);
});
