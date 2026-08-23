import type {
  OverviewSamplePointIcon,
  SampleNetworkComparison,
  SampleNetworkLayerMode,
} from "../../domain/overviewSamplePoint";

export const designReferenceIconPathData =
  "M12 3v4m0 10v4M3 12h4m10 0h4m-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z";

export function sampleNetworkLayerIcons(
  mode: SampleNetworkLayerMode,
  actualIcons: readonly OverviewSamplePointIcon[],
  comparison: SampleNetworkComparison | undefined,
): readonly OverviewSamplePointIcon[] {
  if (mode === "actual") return actualIcons;
  const designIcons = comparison ? designReferenceIcons(comparison) : [];
  return mode === "design" ? designIcons : [...actualIcons, ...designIcons];
}

function designReferenceIcons(
  comparison: SampleNetworkComparison,
): readonly OverviewSamplePointIcon[] {
  const villages = new Map<string, OverviewSamplePointIcon>();
  comparison.points.forEach((point) => {
    if (villages.has(point.villageRegionCode)) return;
    villages.set(point.villageRegionCode, {
      samplePointId: `design:${point.villageRegionCode}`,
      name: `${point.villageName}设计样本点`,
      iconKey: "design-reference",
      layerType: "DESIGN_REFERENCE",
      villageRegionCode: point.villageRegionCode,
      types: [
        {
          code: "DESIGN_REFERENCE",
          name: "设计参照点",
          iconKey: "design-reference",
        },
      ],
      longitude: point.designLongitude,
      latitude: point.designLatitude,
      dataQualityReason: null,
    });
  });
  return [...villages.values()];
}
