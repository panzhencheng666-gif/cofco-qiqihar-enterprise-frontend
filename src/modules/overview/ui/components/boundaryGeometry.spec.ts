import { describe, expect, it } from "vitest";

import type { OverviewRegion } from "../../domain/overview";
import { toMapFeature, toMapPointFeature } from "./boundaryGeometry";

function region(overrides: Partial<OverviewRegion>): OverviewRegion {
  return {
    approvedRecordCount: 0,
    code: "230200",
    level: "PREFECTURE",
    name: "齐齐哈尔市",
    ...overrides,
  };
}

describe("boundary geometry parsing cache", () => {
  it("parses an immutable region boundary only once", () => {
    const source = region({
      boundaryGeoJson: JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    });

    const first = toMapFeature(source);
    const second = toMapFeature(source);

    expect(second).toBe(first);
    expect(second[0]?.geometry).toBe(first[0]?.geometry);
  });

  it("parses an immutable governed point only once", () => {
    const source = region({
      code: "230223100001",
      level: "VILLAGE",
      locationGeoJson: '{"type":"Point","coordinates":[125.3,47.9]}',
      name: "行政村",
    });

    const first = toMapPointFeature(source);
    const second = toMapPointFeature(source);

    expect(second).toBe(first);
    expect(second).toEqual([{ position: [125.3, 47.9], region: source }]);
  });
});
