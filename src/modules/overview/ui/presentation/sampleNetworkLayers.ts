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
  summaryAnchorRegionCode?: string;
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

  const relationIndexes = comparison ? indexRelationTypes(comparison) : undefined;
  const regionalActual = comparison
    ? regionalActualBadges(comparison, context, relationIndexes?.byActual)
    : [];
  const actual = [...actualIcons, ...regionalActual];
  if (mode === "actual") return actual;

  const coverage = comparison
    ? designCoverageBadges(comparison, context, relationIndexes?.byVillage)
    : [];
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
  relationTypesByVillage: ReadonlyMap<
    string,
    readonly SampleNetworkRelationType[]
  > = new Map(),
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
    relationTypes: relationTypesByVillage.get(point.villageRegionCode) ?? [],
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
  context: SampleNetworkLayerContext,
  relationTypesByActual: ReadonlyMap<
    string,
    readonly SampleNetworkRelationType[]
  > = new Map(),
): readonly OverviewSamplePointIcon[] {
  const groups = new Map<
    string,
    {
      count: number;
      kindCodes: Set<string>;
      level: "PREFECTURE" | "COUNTY" | "TOWNSHIP";
      regionCode: string;
      regionName: string;
      relationTypes: Set<SampleNetworkRelationType>;
    }
  >();

  comparison.actualPoints.forEach((point) => {
    if (
      point.locatedRegionLevel === "VILLAGE" ||
      (point.actualLongitude !== null && point.actualLatitude !== null)
    ) {
      return;
    }
    const key = `${point.locatedRegionLevel}:${point.locatedRegionCode}`;
    const existing = groups.get(key) ?? {
      count: 0,
      kindCodes: new Set<string>(),
      level: point.locatedRegionLevel,
      regionCode: point.locatedRegionCode,
      regionName: point.locatedRegionName,
      relationTypes: new Set<SampleNetworkRelationType>(),
    };
    existing.count += 1;
    existing.kindCodes.add(point.samplePointKindCode);
    (relationTypesByActual.get(point.samplePointId) ?? []).forEach((relationType) =>
      existing.relationTypes.add(relationType),
    );
    groups.set(key, existing);
  });

  return [...groups.values()].map((group) => ({
    samplePointId: `regional-actual:${group.level}:${group.regionCode}`,
    name: `${group.regionName}区域级现有样本（${group.count}个）`,
    iconKey: "regional-actual",
    layerType: "REGIONAL_ACTUAL_BADGE" as const,
    // A parent-level actual point has no village coordinate. Anchor its summary
    // to the current township backdrop, never to an arbitrary child polygon.
    anchorRegionCode: context.summaryAnchorRegionCode ?? group.regionCode,
    representedRegionCode: group.regionCode,
    representedRegionName: group.regionName,
    representedRegionLevel: group.level,
    aggregateCount: group.count,
    relationTypes: [...group.relationTypes],
    types: [...group.kindCodes].map((code) => ({
      code,
      name: "区域级现有样本",
      iconKey: "regional-actual",
    })),
    longitude: null,
    latitude: null,
    dataQualityReason: "MISSING_COORDINATE",
  }));
}

function indexRelationTypes(comparison: SampleNetworkComparison): {
  byActual: ReadonlyMap<string, readonly SampleNetworkRelationType[]>;
  byVillage: ReadonlyMap<string, readonly SampleNetworkRelationType[]>;
} {
  const actualSets = new Map<string, Set<SampleNetworkRelationType>>();
  const villageSets = new Map<string, Set<SampleNetworkRelationType>>();
  comparison.relations.forEach(
    ({ designVillageRegionCode, relationType, samplePointId }) => {
      const actual = actualSets.get(samplePointId) ?? new Set();
      actual.add(relationType);
      actualSets.set(samplePointId, actual);
      const village = villageSets.get(designVillageRegionCode) ?? new Set();
      village.add(relationType);
      villageSets.set(designVillageRegionCode, village);
    },
  );
  return {
    byActual: new Map(
      [...actualSets].map(([key, values]) => [key, [...values]] as const),
    ),
    byVillage: new Map(
      [...villageSets].map(([key, values]) => [key, [...values]] as const),
    ),
  };
}
