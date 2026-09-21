import { expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import {
  FOUR_REGION_DETAIL_LAYERS,
  FOUR_REGION_REMOTE_SOURCES,
} from "./fourRegionTerrainStyle";
import * as style from "./fourRegionTerrainStyle";

it("hides administrative outlines at every hierarchy including selection", () => {
  expect(style).toHaveProperty("publicBoundaryHierarchy");
  const hierarchy = (
    style as unknown as {
      publicBoundaryHierarchy: (drilled: boolean) => {
        rootOpacity: unknown;
        activeOpacity: unknown;
        rootLabels: string;
      };
    }
  ).publicBoundaryHierarchy;
  expect(hierarchy(true)).toEqual({
    rootOpacity: 0,
    activeOpacity: 0,
    rootLabels: "none",
  });
  expect(hierarchy(false)).toEqual({
    rootOpacity: 0,
    activeOpacity: 0,
    rootLabels: "visible",
  });
});

it("restores natural road colors and progressive minor road detail", () => {
  const roads = FOUR_REGION_DETAIL_LAYERS.find((layer) => layer.id === "atlas-roads");
  expect(roads?.type).toBe("line");
  if (roads?.type !== "line") return;
  expect(roads.paint?.["line-color"]).toContain("#f3c45f");
  expect(roads.paint?.["line-opacity"]).toBe(0.9);
  expect(roads.filter).toEqual([
    "in",
    ["get", "class"],
    ["literal", ["motorway", "trunk", "primary", "secondary"]],
  ]);
  expect(
    FOUR_REGION_DETAIL_LAYERS.find((layer) => layer.id === "atlas-minor-roads")
      ?.minzoom,
  ).toBe(12);
  expect(
    FOUR_REGION_DETAIL_LAYERS.some((layer) => layer.id === "atlas-roads-casing"),
  ).toBe(false);
});

it("restores real basemap settlement names for search detail", () => {
  const places = FOUR_REGION_DETAIL_LAYERS.find(
    (layer) => layer.id === "atlas-place-labels",
  );
  expect(places?.type).toBe("symbol");
  if (places?.type !== "symbol") return;
  expect(places?.minzoom).toBe(7);
  expect(places?.filter).toEqual([
    "in",
    ["get", "class"],
    [
      "literal",
      ["city", "town", "village", "hamlet", "isolated_dwelling", "neighbourhood"],
    ],
  ]);
  expect(
    FOUR_REGION_DETAIL_LAYERS.find((layer) => layer.id === "atlas-road-labels")
      ?.minzoom,
  ).toBe(13);
});

it("keeps all actual public detail layers valid for MapLibre", () => {
  expect(
    validateStyleMin({
      version: 8,
      glyphs: "https://example.com/{fontstack}/{range}.pbf",
      sources: FOUR_REGION_REMOTE_SOURCES,
      layers: FOUR_REGION_DETAIL_LAYERS,
    }).map((error) => error.message),
  ).toEqual([]);
});
