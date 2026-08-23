import { describe, expect, it } from "vitest";

import type { SampleNetworkComparison } from "../../domain/overviewSamplePoint";
import {
  designReferenceIconPathData,
  sampleNetworkLayerIcons,
} from "./sampleNetworkLayers";

const comparison: SampleNetworkComparison = {
  networkYear: 2026,
  networkStatus: "PUBLISHED",
  designPointCount: 2,
  designCoordinateCount: 2,
  activeSamplePointCount: 3,
  approvedSubmissionSamplePointCount: 1,
  pendingVerificationDesignPointCount: 1,
  multipleActualPerDesignPointCount: 0,
  anomalyCount: 0,
  exactCoveredDesignPointCount: 1,
  representedDesignPointCount: 0,
  regionalAssociationDesignPointCount: 2,
  unrelatedDesignPointCount: 1,
  actualLevelCounts: { prefecture: 0, county: 2, township: 0, village: 1 },
  designPoints: [
    {
      villageRegionCode: "230202997001",
      villageName: "契约测试村",
      townshipRegionCode: "230202997",
      townshipName: "契约测试乡",
      countyRegionCode: "230202",
      countyName: "龙沙区",
      designLongitude: 123.8,
      designLatitude: 47.2,
      coordinateReviewStatus: "REVIEWED",
    },
    {
      villageRegionCode: "230202997002",
      villageName: "兄弟测试村",
      townshipRegionCode: "230202997",
      townshipName: "契约测试乡",
      countyRegionCode: "230202",
      countyName: "龙沙区",
      designLongitude: 123.7,
      designLatitude: 47.1,
      coordinateReviewStatus: "PENDING_REVIEW",
    },
  ],
  actualPoints: [
    {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      samplePointName: "同一跨产品样本点",
      samplePointKindCode: "FARMER",
      membershipStatusCode: "ACTIVE",
      locatedRegionCode: "230202997001",
      locatedRegionName: "契约测试村",
      locatedRegionLevel: "VILLAGE",
      actualLongitude: 123.9,
      actualLatitude: 47.3,
      locationState: "VALID",
    },
    {
      samplePointId: "94000000-0000-0000-0000-000000000002",
      samplePointName: "区县级样本",
      samplePointKindCode: "TRADER",
      membershipStatusCode: "ACTIVE",
      locatedRegionCode: "230202",
      locatedRegionName: "龙沙区",
      locatedRegionLevel: "COUNTY",
      actualLongitude: null,
      actualLatitude: null,
      locationState: "MISSING_COORDINATE",
    },
    {
      samplePointId: "94000000-0000-0000-0000-000000000003",
      samplePointName: "区县级样本二",
      samplePointKindCode: "FEED_MILL",
      membershipStatusCode: "ACTIVE",
      locatedRegionCode: "230202",
      locatedRegionName: "龙沙区",
      locatedRegionLevel: "COUNTY",
      actualLongitude: null,
      actualLatitude: null,
      locationState: "MISSING_COORDINATE",
    },
  ],
  relations: [
    {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      designVillageRegionCode: "230202997001",
      relationType: "EXACT_VILLAGE",
      evidenceReference: null,
      reviewStatus: "APPROVED",
      createdBy: "system",
      createdAt: "2026-08-23T01:00:00Z",
      reviewedBy: null,
      reviewedAt: null,
    },
    {
      samplePointId: "94000000-0000-0000-0000-000000000002",
      designVillageRegionCode: "230202997001",
      relationType: "REGIONAL_ASSOCIATION",
      evidenceReference: null,
      reviewStatus: "COMPUTED",
      createdBy: "system",
      createdAt: "2026-08-23T01:00:00Z",
      reviewedBy: null,
      reviewedAt: null,
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
  it("keeps the existing nine-type actual icon unchanged", () => {
    expect(
      sampleNetworkLayerIcons("actual", [actualIcon], comparison, {
        regionLevel: "TOWNSHIP",
        selectedRegionCode: "230202997",
      }),
    ).toContainEqual(actualIcon);
  });

  it("does not render draft annual members or monthly icons as formal current points", () => {
    expect(
      sampleNetworkLayerIcons(
        "actual",
        [actualIcon],
        { ...comparison, networkStatus: "DRAFT" },
        {
          regionLevel: "TOWNSHIP",
          selectedRegionCode: "230202997",
        },
      ),
    ).toEqual([]);
  });

  it("filters approved monthly business icons through the published annual member list", () => {
    const nonMemberIcon = {
      ...actualIcon,
      samplePointId: "94000000-0000-0000-0000-000000000099",
      name: "不在年度网络中的月度样本",
    };

    const result = sampleNetworkLayerIcons(
      "actual",
      [actualIcon, nonMemberIcon],
      comparison,
      {
        regionLevel: "TOWNSHIP",
        selectedRegionCode: "230202997",
      },
    );

    expect(result).toContainEqual(actualIcon);
    expect(result).not.toContainEqual(nonMemberIcon);
  });

  it("keeps a published annual member visible even before it has a monthly business icon", () => {
    const result = sampleNetworkLayerIcons("actual", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
    });

    expect(result).toContainEqual(
      expect.objectContaining({
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "同一跨产品样本点",
        layerType: "ANNUAL_ACTUAL",
        longitude: 123.9,
        latitude: 47.3,
      }),
    );
  });

  it("does not turn an invalid governed coordinate into a precise annual icon", () => {
    const invalid = {
      ...comparison,
      actualPoints: [
        {
          ...comparison.actualPoints[0]!,
          actualLongitude: 123.9,
          actualLatitude: 47.3,
          locationState: "OUTSIDE_REGION",
        },
      ],
    } satisfies SampleNetworkComparison;

    expect(
      sampleNetworkLayerIcons("actual", [], invalid, {
        regionLevel: "TOWNSHIP",
        selectedRegionCode: "230202997",
      }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          samplePointId: invalid.actualPoints[0]!.samplePointId,
          layerType: "ANNUAL_ACTUAL",
        }),
      ]),
    );
  });

  it("creates one design coverage badge for every township village without using the design coordinate as its anchor", () => {
    const result = sampleNetworkLayerIcons("design", [actualIcon], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          samplePointId: "design-coverage:230202997001",
          anchorRegionCode: "230202997001",
          iconKey: "design-reference",
          layerType: "DESIGN_COVERAGE_BADGE",
        }),
        expect.objectContaining({
          samplePointId: "design-coverage:230202997002",
          anchorRegionCode: "230202997002",
          iconKey: "design-reference",
          layerType: "DESIGN_COVERAGE_BADGE",
        }),
      ]),
    );
    expect(designReferenceIconPathData).toMatch(/^M/);
  });

  it("keeps sibling badges visible but muted after a village is selected", () => {
    const result = sampleNetworkLayerIcons("design", [], comparison, {
      regionLevel: "VILLAGE",
      selectedRegionCode: "230202997001",
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorRegionCode: "230202997001",
          visualState: "selected",
        }),
        expect.objectContaining({
          anchorRegionCode: "230202997002",
          visualState: "muted",
        }),
      ]),
    );
  });

  it("does not promote a historical REVIEWED coordinate to an exact design location", () => {
    const hidden = sampleNetworkLayerIcons("design", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      showExactDesignLocations: false,
    });
    const visible = sampleNetworkLayerIcons("design", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      showExactDesignLocations: true,
    });

    expect(hidden).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layerType: "DESIGN_EXACT_LOCATION" }),
      ]),
    );
    expect(
      visible.filter((icon) => icon.layerType === "DESIGN_EXACT_LOCATION"),
    ).toHaveLength(0);
  });

  it("creates an exact design location only after explicit authority approval", () => {
    const authorityApproved = {
      ...comparison,
      designPoints: comparison.designPoints.map((point, index) =>
        index === 0
          ? { ...point, coordinateReviewStatus: "AUTHORITY_APPROVED" }
          : point,
      ),
    } satisfies SampleNetworkComparison;

    const visible = sampleNetworkLayerIcons("design", [], authorityApproved, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      showExactDesignLocations: true,
    });

    expect(visible).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layerType: "DESIGN_EXACT_LOCATION",
          longitude: 123.8,
          latitude: 47.2,
        }),
      ]),
    );
    expect(
      visible.filter((icon) => icon.layerType === "DESIGN_EXACT_LOCATION"),
    ).toHaveLength(1);
  });

  it("uses a regional badge rather than a fabricated pin for an actual point without coordinates", () => {
    const result = sampleNetworkLayerIcons("actual", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      summaryAnchorRegionCode: "230202997",
    });

    expect(result).toContainEqual(
      expect.objectContaining({
        samplePointId: "regional-actual:COUNTY:230202",
        anchorRegionCode: "230202997",
        representedRegionCode: "230202",
        representedRegionLevel: "COUNTY",
        layerType: "REGIONAL_ACTUAL_BADGE",
        longitude: null,
        latitude: null,
        aggregateCount: 2,
      }),
    );
    expect(
      result.filter((icon) => icon.layerType === "REGIONAL_ACTUAL_BADGE"),
    ).toHaveLength(1);
  });

  it("excludes candidate, paused, and removed actual points from regional layers", () => {
    const mixedStatusComparison: SampleNetworkComparison = {
      ...comparison,
      actualPoints: [
        ...comparison.actualPoints,
        ...(["CANDIDATE", "PAUSED", "REMOVED"] as const).map(
          (membershipStatusCode, index) => ({
            samplePointId: `95000000-0000-0000-0000-00000000000${index}`,
            samplePointName: `${membershipStatusCode}区县级样本`,
            samplePointKindCode: "TRADER",
            membershipStatusCode,
            locatedRegionCode: "230202",
            locatedRegionName: "龙沙区",
            locatedRegionLevel: "COUNTY" as const,
            actualLongitude: null,
            actualLatitude: null,
            locationState: "MISSING_COORDINATE",
          }),
        ),
      ],
    };

    const result = sampleNetworkLayerIcons("actual", [], mixedStatusComparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      summaryAnchorRegionCode: "230202997",
    });

    expect(result).toContainEqual(
      expect.objectContaining({
        samplePointId: "regional-actual:COUNTY:230202",
        aggregateCount: 2,
      }),
    );
    expect(
      result.filter(({ samplePointId }) => samplePointId.startsWith("95000000-")),
    ).toEqual([]);
  });

  it("keeps high-level descendants aggregated while retaining native-level actual points", () => {
    expect(
      sampleNetworkLayerIcons("actual", [actualIcon], comparison, {
        regionLevel: "COUNTY",
        selectedRegionCode: "230202",
        actualKindCodes: ["FARMER"],
      }),
    ).toEqual([]);
    expect(
      sampleNetworkLayerIcons("actual", [], comparison, {
        regionLevel: "COUNTY",
        selectedRegionCode: "230202",
        actualKindCodes: ["TRADER"],
      }),
    ).toContainEqual(
      expect.objectContaining({
        aggregateCount: 1,
        representedRegionLevel: "COUNTY",
        samplePointId: "regional-actual:COUNTY:230202",
      }),
    );
    expect(
      sampleNetworkLayerIcons("design", [actualIcon], comparison, {
        regionLevel: "COUNTY",
        selectedRegionCode: "230202",
      }),
    ).toEqual([]);
  });

  it("applies a concrete kind filter to every annual actual source", () => {
    const result = sampleNetworkLayerIcons("actual", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      actualKindCodes: ["FARMER"],
    });

    expect(result).toEqual([
      expect.objectContaining({
        samplePointId: "94000000-0000-0000-0000-000000000001",
      }),
    ]);
  });
});
