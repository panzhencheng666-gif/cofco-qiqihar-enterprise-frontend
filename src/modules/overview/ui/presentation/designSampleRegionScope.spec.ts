import { describe, it, expect } from "vitest";
import {
  designPointsInRegion,
  designPointRegionAggregates,
} from "./designSampleRegionScope";
import type { OverviewDesignSamplePoint } from "../../domain/overviewSamplePoint";
import { samplePointAggregateLabel } from "./samplePointAggregateRing";

const point = (id: string, longitude: number, latitude: number) =>
  ({
    id,
    longitude,
    latitude,
    regionCode: "230223",
    context: { domainCode: "MARKET" },
  }) as OverviewDesignSamplePoint;
const region = {
  code: "230223100001",
  name: "村级范围",
  level: "VILLAGE" as const,
  boundaryGeoJson: JSON.stringify({
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [2, 2],
          [4, 2],
          [4, 4],
          [2, 4],
          [2, 2],
        ],
      ],
      [
        [
          [20, 20],
          [21, 20],
          [21, 21],
          [20, 21],
          [20, 20],
        ],
      ],
    ],
  }),
};
it("includes boundary points and detached polygons, excluding holes and genuinely outside coordinates", () => {
  const points = [
    point("inside", 1, 1),
    point("hole", 3, 3),
    point("edge", 0, 5),
    point("island", 20.5, 20.5),
    point("outside", 11, 5),
  ];
  const before = JSON.stringify(points);
  expect(designPointsInRegion(points, region).map((p) => p.id)).toEqual([
    "inside",
    "edge",
    "island",
  ]);
  expect(JSON.stringify(points)).toBe(before);
});
describe("design map counts", () => {
  it("uses the same membership as the panel and never labels designs as approved observations", () => {
    const points = [point("inside", 1, 1), point("hole", 3, 3)];
    const aggregate = designPointRegionAggregates(points, [region])[0]!;
    expect(aggregate.samplePointCount).toBe(
      designPointsInRegion(points, region).length,
    );
    expect(samplePointAggregateLabel(aggregate)).toContain("设计样本点 1 个");
    expect(samplePointAggregateLabel(aggregate)).not.toContain("已核定");
  });
});
