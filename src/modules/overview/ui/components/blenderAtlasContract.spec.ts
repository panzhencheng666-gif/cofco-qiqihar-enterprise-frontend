import { describe, expect, it } from "vitest";

import {
  blenderRegionVisualState,
  parseBlenderAtlasManifest,
} from "./blenderAtlasContract";

const validManifest = {
  asset: "/overview-monitoring/overview/blender/four-region-atlas.glb",
  bounds: [120.482377, 46.220942, 129.519842, 53.5608154],
  generatedAt: "2026-09-01T14:45:33.965804Z",
  origin: [125.0011095, 49.8908787],
  projection: "EPSG:3857_LOCAL_METRES",
  regions: [
    { code: "230200", name: "齐齐哈尔市", objectName: "region_230200" },
    { code: "231100", name: "黑河市", objectName: "region_231100" },
    { code: "150700", name: "呼伦贝尔市", objectName: "region_150700" },
    { code: "232700", name: "大兴安岭地区", objectName: "region_232700" },
  ],
  sourceName: "authoritative boundary source",
  sourceRevision: "2026-09-01",
  version: 1,
};

describe("Blender atlas manifest", () => {
  it("accepts only the governed four-region manifest", () => {
    expect(
      parseBlenderAtlasManifest(validManifest).regions.map(({ code }) => code),
    ).toEqual(["230200", "231100", "150700", "232700"]);
    expect(() => parseBlenderAtlasManifest({ ...validManifest, regions: [] })).toThrow(
      "four governed regions",
    );
  });

  it("rejects unsafe asset paths and projection drift", () => {
    expect(() =>
      parseBlenderAtlasManifest({
        ...validManifest,
        asset: "https://example.com/map.glb",
      }),
    ).toThrow("same-origin overview asset");
    expect(() =>
      parseBlenderAtlasManifest({ ...validManifest, projection: "EPSG:4326" }),
    ).toThrow("EPSG:3857_LOCAL_METRES");
  });

  it("rejects duplicate, missing, or unexpected region identity", () => {
    expect(() =>
      parseBlenderAtlasManifest({
        ...validManifest,
        regions: validManifest.regions.map((region) => ({
          ...region,
          code: "230200",
        })),
      }),
    ).toThrow("four governed regions");
  });
});

describe("Blender atlas visual state", () => {
  it("raises a selected visible region with restrained emphasis", () => {
    expect(blenderRegionVisualState("230200", "230200", undefined, true)).toEqual({
      emissiveIntensity: 0.65,
      opacity: 1,
      raisedMeters: 900,
      visible: true,
    });
  });

  it("uses a smaller hover treatment and dims unselected context", () => {
    expect(blenderRegionVisualState("231100", "230200", "231100", true)).toEqual({
      emissiveIntensity: 0.32,
      opacity: 0.72,
      raisedMeters: 320,
      visible: true,
    });
    expect(blenderRegionVisualState("232700", "230200", undefined, false)).toEqual({
      emissiveIntensity: 0.08,
      opacity: 0,
      raisedMeters: 0,
      visible: false,
    });
  });
});
