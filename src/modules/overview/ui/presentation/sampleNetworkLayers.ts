import type {
  OverviewSamplePointIcon,
  SampleNetworkComparison,
  SampleNetworkDesignPoint,
  SampleNetworkLayerMode,
  SampleNetworkRelationType,
} from "../../domain/overviewSamplePoint";

export const designReferenceIconPathData =
  "M12 3v4m0 10v4M3 12h4m10 0h4m-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z";

export const designCoverageBadgePathData = "m12 3 7 5v8l-7 5-7-5V8l7-5Zm-3 9 2 2 4-5";

export const regionalActualBadgePathData =
  "M5 8.5 12 4l7 4.5V19H5V8.5Zm3 3h8m-8 3h8M9 19v-2h6v2";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export interface SampleNetworkLayerContext {
  regionLevel: RegionLevel;
  selectedRegionCode: string;
  showExactDesignLocations?: boolean;
}

export function sampleNetworkLayerIcons(
  mode: SampleNetworkLayerMode,
  actualIcons: readonly OverviewSamplePointIcon[],
  comparison: SampleNetworkComparison | undefined,
  context: SampleNetworkLayerContext = {
    regionLevel: "TOWNSHIP",
    selectedRegionCode: "",
  },
): readonly OverviewSamplePointIcon[] {
  // City and county maps communicate coverage through their existing aggregate
  // rings. Expanding village markers at these levels would recreate the 2,332
  // point wall that the hierarchy is designed to avoid.
  if (context.regionLevel === "PREFECTURE" || context.regionLevel === "COUNTY") {
    return [];
  }

  const regionalActual = comparison ? regionalActualBadges(comparison) : [];
  const actual = [...actualIcons, ...regionalActual];
  if (mode === "actual") return actual;

  const coverage = comparison ? designCoverageBadges(comparison, context) : [];
  const exact =
    comparison && context.showExactDesignLocations
      ? approvedExactDesignLocations(comparison)
      : [];
  const design = [...coverage, ...exact];
  return mode === "design" ? design : [...actual, ...design];
}

function designCoverageBadges(
  comparison: SampleNetworkComparison,
  context: SampleNetworkLayerContext,
): readonly OverviewSamplePointIcon[] {
  return comparison.designPoints.map((point) => ({
    samplePointId: `design-coverage:${point.villageRegionCode}`,
    name: `${point.villageName}设计覆盖`,
    iconKey: "design-reference",
    layerType: "DESIGN_COVERAGE_BADGE",
    anchorRegionCode: point.villageRegionCode,
    villageRegionCode: point.villageRegionCode,
    visualState:
      context.regionLevel !== "VILLAGE"
        ? "default"
        : point.villageRegionCode === context.selectedRegionCode
          ? "selected"
          : "muted",
    relationTypes: relationTypesForVillage(comparison, point.villageRegionCode),
    types: [
      {
        code: "DESIGN_COVERAGE",
        name: "行政村设计覆盖",
        iconKey: "design-reference",
      },
    ],
    // These governed coordinates remain available for detail and provenance,
    // but the projection layer deliberately ignores them for coverage badges
    // and uses the administrative polygon's interior label anchor instead.
    longitude: point.designLongitude,
    latitude: point.designLatitude,
    dataQualityReason: null,
  }));
}

function approvedExactDesignLocations(
  comparison: SampleNetworkComparison,
): readonly OverviewSamplePointIcon[] {
  return comparison.designPoints
    .filter(
      (point) =>
        point.coordinateReviewStatus === "APPROVED" &&
        Number.isFinite(point.designLongitude) &&
        Number.isFinite(point.designLatitude),
    )
    .map((point) => exactDesignLocation(point));
}

function exactDesignLocation(point: SampleNetworkDesignPoint): OverviewSamplePointIcon {
  return {
    samplePointId: `design-exact:${point.villageRegionCode}`,
    name: `${point.villageName}设计样本点精确位置`,
    iconKey: "design-reference",
    layerType: "DESIGN_EXACT_LOCATION",
    villageRegionCode: point.villageRegionCode,
    types: [
      {
        code: "DESIGN_EXACT_LOCATION",
        name: "已审核精确位置",
        iconKey: "design-reference",
      },
    ],
    longitude: point.designLongitude,
    latitude: point.designLatitude,
    dataQualityReason: null,
  };
}

function regionalActualBadges(
  comparison: SampleNetworkComparison,
): readonly OverviewSamplePointIcon[] {
  return comparison.actualPoints
    .filter(
      (point) =>
        point.locatedRegionLevel !== "VILLAGE" &&
        (point.actualLongitude === null || point.actualLatitude === null),
    )
    .map((point) => ({
      samplePointId: `regional-actual:${point.samplePointId}`,
      name: point.samplePointName,
      iconKey: "regional-actual",
      layerType: "REGIONAL_ACTUAL_BADGE" as const,
      anchorRegionCode: point.locatedRegionCode,
      relationTypes: relationTypesForActual(comparison, point.samplePointId),
      types: [
        {
          code: point.samplePointKindCode,
          name: "区域级现有样本",
          iconKey: "regional-actual",
        },
      ],
      longitude: null,
      latitude: null,
      dataQualityReason: point.locationState,
    }));
}

function relationTypesForVillage(
  comparison: SampleNetworkComparison,
  villageRegionCode: string,
): readonly SampleNetworkRelationType[] {
  return uniqueRelationTypes(
    comparison.relations
      .filter(
        ({ designVillageRegionCode }) => designVillageRegionCode === villageRegionCode,
      )
      .map(({ relationType }) => relationType),
  );
}

function relationTypesForActual(
  comparison: SampleNetworkComparison,
  samplePointId: string,
): readonly SampleNetworkRelationType[] {
  return uniqueRelationTypes(
    comparison.relations
      .filter((relation) => relation.samplePointId === samplePointId)
      .map(({ relationType }) => relationType),
  );
}

function uniqueRelationTypes(
  relationTypes: readonly SampleNetworkRelationType[],
): readonly SampleNetworkRelationType[] {
  return [...new Set(relationTypes)];
}
