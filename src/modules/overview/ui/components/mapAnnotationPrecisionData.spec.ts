import { describe, expect, it } from "vitest";

import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";
import { samplePointGeoJson } from "./mapAnnotationPrecisionData";

function icon(
  samplePointId: string,
  overrides: Partial<OverviewSamplePointIcon>,
): OverviewSamplePointIcon {
  return {
    samplePointId,
    name: samplePointId,
    iconKey: "survey",
    types: [],
    longitude: 123.4,
    latitude: 47.8,
    dataQualityReason: null,
    ...overrides,
  };
}

describe("samplePointGeoJson", () => {
  it("renders only governed actual sample points with reported coordinates", () => {
    const result = samplePointGeoJson(
      [
        icon("annual", {
          layerType: "ANNUAL_ACTUAL",
          locationMode: "REPORTED_COORDINATE",
        }),
        icon("historical", {
          layerType: "HISTORICAL_ACTUAL",
          locationMode: "REPORTED_COORDINATE",
        }),
        icon("schematic", {
          layerType: "ANNUAL_ACTUAL",
          locationMode: "REGION_SCHEMATIC",
        }),
        icon("design", {
          layerType: "DESIGN_EXACT_LOCATION",
          locationMode: "REPORTED_COORDINATE",
        }),
        icon("badge", {
          layerType: "REGIONAL_ACTUAL_BADGE",
          locationMode: "REPORTED_COORDINATE",
        }),
        icon("missing", {
          layerType: "ANNUAL_ACTUAL",
          locationMode: "REPORTED_COORDINATE",
          longitude: null,
        }),
      ],
      "annual",
    );

    expect(result.features.map(({ properties }) => properties.samplePointId)).toEqual([
      "annual",
      "historical",
    ]);
    expect(result.features[0]?.properties.selected).toBe(true);
  });
});
