import { describe, expect, it } from "vitest";

import type { SampleNetworkComparison } from "../../domain/overviewSamplePoint";
import {
  designReferenceIconPathData,
  sampleNetworkLayerIcons,
  visibleSampleNetworkMapIcons,
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

  it("keeps approved business icons visible while the separate annual network is draft", () => {
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
    ).toContainEqual(actualIcon);
  });

  it("keeps the fixed design baseline visible while the annual network is still a draft", () => {
    expect(
      sampleNetworkLayerIcons(
        "design",
        [actualIcon],
        { ...comparison, networkStatus: "DRAFT" },
        {
          regionLevel: "TOWNSHIP",
          selectedRegionCode: "230202997",
        },
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          samplePointId: "design-coverage:230202997001",
          layerType: "DESIGN_COVERAGE_BADGE",
        }),
        expect.objectContaining({
          samplePointId: "design-coverage:230202997002",
          layerType: "DESIGN_COVERAGE_BADGE",
        }),
      ]),
    );
  });

  it("does not let product-scoped annual membership hide approved stable identities", () => {
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
    expect(result).toContainEqual(nonMemberIcon);
  });

  it("does not fabricate a business-role icon from annual membership alone", () => {
    const result = sampleNetworkLayerIcons("actual", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
    });

    expect(result).toEqual([]);
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

  it("keeps coordinate-less annual identities off the map instead of fabricating a badge", () => {
    const result = sampleNetworkLayerIcons("actual", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      summaryAnchorRegionCode: "230202997",
    });

    expect(result).toEqual([]);
  });

  it("never promotes annual status rows into business-role map symbols", () => {
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

    expect(result).toEqual([]);
  });

  it("keeps high-level actual points visible and aggregates the fixed design baseline", () => {
    expect(
      sampleNetworkLayerIcons("actual", [actualIcon], comparison, {
        regionLevel: "COUNTY",
        selectedRegionCode: "230202",
        actualKindCodes: ["FARMER"],
      }),
    ).toContainEqual(actualIcon);
    expect(
      sampleNetworkLayerIcons("actual", [], comparison, {
        regionLevel: "COUNTY",
        selectedRegionCode: "230202",
        actualKindCodes: ["TRADER"],
      }),
    ).toEqual([]);
    expect(
      sampleNetworkLayerIcons("design", [actualIcon], comparison, {
        regionLevel: "COUNTY",
        selectedRegionCode: "230202",
      }),
    ).toContainEqual(
      expect.objectContaining({
        aggregateCount: 2,
        anchorRegionCode: "230202997",
        layerType: "DESIGN_COVERAGE_BADGE",
        name: "契约测试乡设计样本",
      }),
    );
  });

  it("uses regional summaries through county level and reveals only the list-selected exact sample", () => {
    const anotherIcon = {
      ...actualIcon,
      samplePointId: "94000000-0000-0000-0000-000000000099",
      name: "另一个正式样本",
    };
    const designBadge = {
      ...actualIcon,
      samplePointId: "design-coverage-summary:230202",
      layerType: "DESIGN_COVERAGE_BADGE" as const,
    };

    expect(
      visibleSampleNetworkMapIcons("PREFECTURE", undefined, [
        actualIcon,
        anotherIcon,
        designBadge,
      ]),
    ).toEqual([designBadge]);
    expect(
      visibleSampleNetworkMapIcons("PREFECTURE", actualIcon.samplePointId, [
        actualIcon,
        anotherIcon,
        designBadge,
      ]),
    ).toEqual([actualIcon, designBadge]);
    expect(
      visibleSampleNetworkMapIcons("COUNTY", undefined, [actualIcon, anotherIcon]),
    ).toEqual([]);
    expect(
      visibleSampleNetworkMapIcons("COUNTY", actualIcon.samplePointId, [
        actualIcon,
        anotherIcon,
      ]),
    ).toEqual([actualIcon]);
    expect(
      visibleSampleNetworkMapIcons("TOWNSHIP", undefined, [actualIcon, anotherIcon]),
    ).toEqual([actualIcon, anotherIcon]);
  });

  it("does not reconstruct a filtered business icon from annual object kinds", () => {
    const result = sampleNetworkLayerIcons("actual", [], comparison, {
      regionLevel: "TOWNSHIP",
      selectedRegionCode: "230202997",
      actualKindCodes: ["FARMER"],
    });

    expect(result).toEqual([]);
  });
});
