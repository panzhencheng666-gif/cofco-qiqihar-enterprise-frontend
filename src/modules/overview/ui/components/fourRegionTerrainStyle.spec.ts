import { describe, expect, it } from "vitest";

import {
  FOUR_REGION_BASE_STYLE,
  FOUR_REGION_DETAIL_LAYERS,
  FOUR_REGION_REMOTE_SOURCES,
  surfaceModePaint,
} from "./fourRegionTerrainStyle";

describe("four-region satellite and terrain style", () => {
  it("renders a local shell before any remote provider responds", () => {
    expect(FOUR_REGION_BASE_STYLE.sources).toEqual({});
    expect(FOUR_REGION_BASE_STYLE.layers).toEqual([
      expect.objectContaining({ id: "atlas-empty-world", type: "background" }),
    ]);
  });

  it("keeps imagery, terrain and vector detail as independent enhancements", () => {
    expect(Object.keys(FOUR_REGION_REMOTE_SOURCES)).toEqual([
      "satellite",
      "terrain-dem",
      "openmaptiles",
    ]);
    expect(FOUR_REGION_REMOTE_SOURCES.satellite?.type).toBe("raster");
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES.satellite)).toContain("bounds");
    expect(FOUR_REGION_REMOTE_SOURCES["terrain-dem"]?.type).toBe("raster-dem");
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES["terrain-dem"])).toContain(
      "bounds",
    );
    expect(FOUR_REGION_REMOTE_SOURCES.openmaptiles).toEqual(
      expect.objectContaining({ type: "vector", bounds: ROOT_BOUNDS }),
    );
  });

  it("adds continuous zoom detail without non-Chinese fallback labels", () => {
    const ids = FOUR_REGION_DETAIL_LAYERS.map((layer) => layer.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "atlas-satellite",
        "atlas-terrain-light",
        "atlas-water",
        "atlas-roads",
        "atlas-buildings",
        "atlas-place-labels",
        "atlas-road-labels",
      ]),
    );
    const labels = FOUR_REGION_DETAIL_LAYERS.filter((layer) =>
      layer.id.endsWith("labels"),
    );
    expect(JSON.stringify(labels)).toContain("name:zh");
    expect(JSON.stringify(labels)).not.toContain('["get","name"]');
  });

  it("changes material weight without replacing the scene", () => {
    expect(surfaceModePaint("SANDBOX")).toMatchObject({
      satelliteOpacity: 0.38,
      hillshadeOpacity: 0.82,
    });
    expect(surfaceModePaint("FUSION")).toMatchObject({
      satelliteOpacity: 0.76,
      hillshadeOpacity: 0.58,
    });
    expect(surfaceModePaint("IMAGERY")).toMatchObject({
      satelliteOpacity: 0.96,
      hillshadeOpacity: 0.32,
    });
  });
});

const ROOT_BOUNDS = [115.3, 45.7, 131.7, 53.6];
