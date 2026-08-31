import type {
  OverviewSamplePointIcon,
  OverviewDesignSamplePoint,
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
  actualKindCodes?: readonly string[];
  regionLevel: RegionLevel;
  selectedRegionCode: string;
  summaryAnchorRegionCode?: string;
  showExactDesignLocations?: boolean;
}

export function visibleSampleNetworkMapIcons(
  regionLevel: RegionLevel | undefined,
  selectedSamplePointId: string | undefined,
  icons: readonly OverviewSamplePointIcon[],
): readonly OverviewSamplePointIcon[] {
  if (regionLevel === "TOWNSHIP" || regionLevel === "VILLAGE") return icons;
  return icons.filter(
    (icon) =>
      (icon.layerType ?? "ANNUAL_ACTUAL") !== "ANNUAL_ACTUAL" ||
      icon.samplePointId === selectedSamplePointId,
  );
}

export function sampleNetworkLayerIcons(
  mode: SampleNetworkLayerMode,
  actualIcons: readonly OverviewSamplePointIcon[],
  comparison: SampleNetworkComparison | undefined,
  context: SampleNetworkLayerContext = {
    regionLevel: "TOWNSHIP",
    selectedRegionCode: "",
  },
  designSamplePoints?: readonly OverviewDesignSamplePoint[],
): readonly OverviewSamplePointIcon[] {
  const formalAnnualComparison =
    comparison && ["PUBLISHED", "RETIRED"].includes(comparison.networkStatus)
      ? comparison
      : undefined;
  const relationIndexes = formalAnnualComparison
    ? indexRelationTypes(formalAnnualComparison)
    : undefined;
  // Approved overview icons and annual-network membership are orthogonal facts.
  // The annual network may be draft or product-scoped, while sample identity and
  // its governed business roles remain stable across products.  Never let that
  // separate publication state hide an already approved, precisely located icon.
  const actual = actualIcons;
  if (mode === "actual") return actual;

  const coverage = comparison
    ? context.regionLevel === "PREFECTURE" || context.regionLevel === "COUNTY"
      ? regionalDesignCoverageBadges(comparison, context)
      : designCoverageBadges(comparison, context, relationIndexes?.byVillage)
    : [];
  const exact =
    comparison && context.showExactDesignLocations
      ? approvedExactDesignLocations(comparison)
      : [];
  const design =
    designSamplePoints === undefined
      ? [...coverage, ...exact]
      : designSamplePoints.map(designSamplePointIcon);
  return mode === "design" ? design : [...actual, ...design];
}

function designSamplePointIcon(
  point: OverviewDesignSamplePoint,
): OverviewSamplePointIcon {
  return {
    samplePointId: `design-sample-point:${point.id}`,
    name: point.name,
    regionCode: point.regionCode,
    iconKey: "design-reference",
    layerType: "DESIGN_EXACT_LOCATION",
    types: [
      {
        code: "DESIGN_SAMPLE_POINT",
        name: `${point.domainLabel} · ${point.objectTypeLabel} · ${point.productLabel}`,
        iconKey: "design-reference",
      },
    ],
    longitude: point.longitude,
    latitude: point.latitude,
    dataQualityReason: null,
  };
}

function regionalDesignCoverageBadges(
  comparison: SampleNetworkComparison,
  context: SampleNetworkLayerContext,
): readonly OverviewSamplePointIcon[] {
  const groups = new Map<
    string,
    { count: number; regionCode: string; regionName: string }
  >();
  comparison.designPoints.forEach((point) => {
    const regionCode =
      context.regionLevel === "PREFECTURE"
        ? point.countyRegionCode
        : point.townshipRegionCode;
    const regionName =
      context.regionLevel === "PREFECTURE" ? point.countyName : point.townshipName;
    const current = groups.get(regionCode) ?? { count: 0, regionCode, regionName };
    current.count += 1;
    groups.set(regionCode, current);
  });
  return [...groups.values()].map(({ count, regionCode, regionName }) => ({
    samplePointId: `design-coverage-summary:${regionCode}`,
    name: `${regionName}设计样本`,
    iconKey: "design-reference",
    layerType: "DESIGN_COVERAGE_BADGE",
    anchorRegionCode: regionCode,
    aggregateCount: count,
    relationTypes: [],
    types: [
      {
        code: "DESIGN_COVERAGE",
        name: `${count} 个行政村设计样本`,
        iconKey: "design-reference",
      },
    ],
    longitude: null,
    latitude: null,
    dataQualityReason: null,
  }));
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
        // REVIEWED is a historical source status, not authoritative boundary approval.
        point.coordinateReviewStatus === "AUTHORITY_APPROVED" &&
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
        name: "权威核验精确位置",
        iconKey: "design-reference",
      },
    ],
    longitude: point.designLongitude,
    latitude: point.designLatitude,
    dataQualityReason: null,
  };
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
