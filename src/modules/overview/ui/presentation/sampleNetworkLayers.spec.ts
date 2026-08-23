import { describe, expect, it } from "vitest";

import type { SampleNetworkComparison } from "../../domain/overviewSamplePoint";
import {
  designReferenceIconPathData,
  sampleNetworkLayerIcons,
} from "./sampleNetworkLayers";

const comparison: SampleNetworkComparison = {
  networkYear: 2026,
  networkStatus: "PUBLISHED",
  designPointCount: 1,
  activeSamplePointCount: 1,
  coveredDesignPointCount: 1,
  uncoveredDesignPointCount: 0,
  points: [
    {
      villageRegionCode: "230202997001",
      villageName: "契约测试村",
      townshipRegionCode: "230202997",
      townshipName: "契约测试乡",
      countyRegionCode: "230202",
      countyName: "龙沙区",
      designLongitude: 123.8,
      designLatitude: 47.2,
      samplePointId: "94000000-0000-0000-0000-000000000001",
      samplePointName: "同一跨产品样本点",
      samplePointKindCode: "SURVEY_SITE",
      membershipStatusCode: "ACTIVE",
      actualLongitude: 123.9,
      actualLatitude: 47.3,
      comparisonState: "ACTIVE_MATCH",
    },
  ],
};

const actualIcon = {
  samplePointId: "94000000-0000-0000-0000-000000000001",
  name: "同一跨产品样本点",
  iconKey: "farmer",
  types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
  longitude: 123.9,
  latitude: 47.3,
  dataQualityReason: null,
};

describe("sampleNetworkLayerIcons", () => {
  it("keeps the existing actual icon unchanged in actual mode", () => {
    expect(sampleNetworkLayerIcons("actual", [actualIcon], comparison)).toEqual([
      actualIcon,
    ]);
  });

  it("creates one neutral yearless reference marker per design village", () => {
    const result = sampleNetworkLayerIcons("design", [actualIcon], comparison);

    expect(result).toEqual([
      expect.objectContaining({
        samplePointId: "design:230202997001",
        name: "契约测试村设计样本点",
        iconKey: "design-reference",
        layerType: "DESIGN_REFERENCE",
        longitude: 123.8,
        latitude: 47.2,
      }),
    ]);
    expect(designReferenceIconPathData).toMatch(/^M/);
  });

  it("combines actual and design markers without replacing the nine-type actual icon", () => {
    const result = sampleNetworkLayerIcons("comparison", [actualIcon], comparison);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(actualIcon);
    expect(result[1]?.iconKey).toBe("design-reference");
  });
});
