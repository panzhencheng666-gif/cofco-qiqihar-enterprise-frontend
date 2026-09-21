import { describe, expect, it } from "vitest";

import {
  FACILITY_ICON_SIZE,
  FOUR_REGION_BASE_STYLE,
  FOUR_REGION_DETAIL_LAYERS,
  FOUR_REGION_REMOTE_SOURCES,
  surfaceModePaint,
} from "./fourRegionTerrainStyle";

describe("four-region satellite and terrain style", () => {
  it("scales every facility icon together without selection-based resizing", () => {
    expect(FACILITY_ICON_SIZE).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      4,
      0.44,
      7,
      0.56,
      10,
      0.69,
      13,
      0.81,
    ]);
    expect(JSON.stringify(FACILITY_ICON_SIZE)).not.toContain("selected");
  });

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
      "hillshade-dem",
      "openmaptiles",
    ]);
    expect(FOUR_REGION_REMOTE_SOURCES.satellite?.type).toBe("raster");
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES.satellite)).toContain(
      "/api/v1/overview/map-imagery/tiles/{z}/{x}/{y}",
    );
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES.satellite)).not.toContain(
      "arcgisonline.com",
    );
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES.satellite)).not.toContain(
      "bounds",
    );
    expect(FOUR_REGION_REMOTE_SOURCES["terrain-dem"]?.type).toBe("raster-dem");
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES["terrain-dem"])).not.toContain(
      "bounds",
    );
    expect(FOUR_REGION_REMOTE_SOURCES["hillshade-dem"]?.type).toBe("raster-dem");
    expect(
      FOUR_REGION_DETAIL_LAYERS.find((layer) => layer.id === "atlas-terrain-light"),
    ).toEqual(expect.objectContaining({ source: "hillshade-dem" }));
    expect(FOUR_REGION_REMOTE_SOURCES.openmaptiles).toEqual(
      expect.objectContaining({ type: "vector" }),
    );
    expect(JSON.stringify(FOUR_REGION_REMOTE_SOURCES.openmaptiles)).not.toContain(
      "bounds",
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
      terrainExaggeration: 2.6,
      hillshadeOpacity: 0.9,
    });
    expect(surfaceModePaint("FUSION")).toMatchObject({
      terrainExaggeration: 2.25,
      hillshadeOpacity: 0.78,
    });
    expect(surfaceModePaint("IMAGERY")).toMatchObject({
      terrainExaggeration: 1.55,
      hillshadeOpacity: 0.38,
    });
    expect(surfaceModePaint("FUSION").satelliteOpacity).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      4,
      0.34,
      8,
      0.54,
      12,
      0.78,
      16,
      0.92,
    ]);
  });
});
