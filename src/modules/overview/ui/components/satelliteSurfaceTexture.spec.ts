import { describe, expect, it } from "vitest";

import {
  satelliteExportUrl,
  satelliteTextureResolution,
  satelliteTilePlan,
  tileCoordinate,
} from "./satelliteSurfaceTexture";

describe("satellite relief surface texture", () => {
  it("chooses a bounded tile grid for the four-region overview", () => {
    const plan = satelliteTilePlan(
      {
        minLongitude: 117.15,
        minLatitude: 43.4,
        maxLongitude: 127.8,
        maxLatitude: 53.6,
      },
      8,
      24,
    );

    expect(plan.tileCount).toBeLessThanOrEqual(24);
    expect(plan.zoom).toBeLessThanOrEqual(8);
    expect(plan.maxX).toBeGreaterThanOrEqual(plan.minX);
    expect(plan.maxY).toBeGreaterThanOrEqual(plan.minY);
  });

  it("increases imagery detail for a drilled administrative extent", () => {
    const root = satelliteTilePlan(
      {
        minLongitude: 117.15,
        minLatitude: 43.4,
        maxLongitude: 127.8,
        maxLatitude: 53.6,
      },
      8,
      24,
    );
    const county = satelliteTilePlan(
      {
        minLongitude: 124.8,
        minLatitude: 47.3,
        maxLongitude: 125.8,
        maxLatitude: 48.1,
      },
      11,
      24,
    );

    expect(county.zoom).toBeGreaterThan(root.zoom);
  });

  it("clamps Web Mercator coordinates at the supported latitude limit", () => {
    const north = tileCoordinate(180, 90, 4);
    const south = tileCoordinate(-180, -90, 4);

    expect(north.x).toBe(16);
    expect(north.y).toBeGreaterThanOrEqual(0);
    expect(south.x).toBe(0);
    expect(south.y).toBeLessThanOrEqual(16);
  });

  it("raises one export image resolution instead of multiplying tile requests", () => {
    expect(satelliteTextureResolution(7)).toBe(1024);
    expect(satelliteTextureResolution(10)).toBeGreaterThan(2000);
    expect(
      satelliteExportUrl(
        {
          minLongitude: 117.15,
          minLatitude: 43.4,
          maxLongitude: 127.8,
          maxLatitude: 53.6,
        },
        2048,
      ),
    ).toContain("World_Imagery/MapServer/export");
  });
});
