import { describe, expect, it } from "vitest";
import { reliefTerrainSourceKey } from "./terrainReliefSource";
import type { MapFeature } from "./boundaryGeometry";

const feature: MapFeature = {
  region: {
    code: "230200",
    name: "齐齐哈尔市",
    level: "PREFECTURE",
    approvedRecordCount: 329,
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 47],
      ],
    ],
  },
};
describe("relief terrain source identity", () => {
  it("does not rebuild terrain when only sample statistics visibility changes", () => {
    const updated = {
      ...feature,
      region: { ...feature.region, approvedRecordCount: null },
    };
    expect(reliefTerrainSourceKey({ features: [updated], points: [] })).toBe(
      reliefTerrainSourceKey({ features: [feature], points: [] }),
    );
  });
  it("still rebuilds when geometry or administrative identity changes", () => {
    const original = reliefTerrainSourceKey({ features: [feature], points: [] });
    expect(
      reliefTerrainSourceKey({
        features: [{ ...feature, region: { ...feature.region, name: "新名称" } }],
        points: [],
      }),
    ).not.toBe(original);
    expect(
      reliefTerrainSourceKey({
        features: [
          {
            ...feature,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [122, 47],
                  [124, 47],
                  [124, 48],
                  [122, 47],
                ],
              ],
            },
          },
        ],
        points: [],
      }),
    ).not.toBe(original);
  });
});
