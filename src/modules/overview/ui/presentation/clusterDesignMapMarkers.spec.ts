import { expect, it } from "vitest";
import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";
import { clusterDesignMapMarkers } from "./clusterDesignMapMarkers";
const marker = (id: string, x: number) => ({
  icon: {
    samplePointId: id,
    name: id,
    layerType: "DESIGN_EXACT_LOCATION",
    types: [],
    iconKey: "design-reference",
    longitude: 120,
    latitude: 40,
    dataQualityReason: null,
  } as OverviewSamplePointIcon,
  point: { x, y: 20 },
});
it("clusters overlapping designs, preserving anchor positions and total counts", () => {
  const original = [marker("a", 0), marker("b", 10), marker("c", 20), marker("d", 65)];
  const snapshot = JSON.stringify(original);
  const result = clusterDesignMapMarkers(original);
  expect(result).toHaveLength(2);
  expect(result[0]?.icon.aggregateCount).toBe(3);
  expect(result[0]?.point).toEqual(original[0]?.point);
  expect(result.reduce((sum, p) => sum + (p.icon.aggregateCount ?? 1), 0)).toBe(4);
  expect(JSON.stringify(original)).toBe(snapshot);
  expect(
    clusterDesignMapMarkers(
      original.map((p) => ({ ...p, point: { x: p.point.x * 10, y: 20 } })),
    ),
  ).toHaveLength(4);
});
it("leaves actual and historical markers unchanged", () => {
  const actual = {
    ...marker("actual", 0),
    icon: { ...marker("actual", 0).icon, layerType: "ANNUAL_ACTUAL" as const },
  };
  expect(clusterDesignMapMarkers([actual, marker("design", 0)])[0]).toBe(actual);
});
