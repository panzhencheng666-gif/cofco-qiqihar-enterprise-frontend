import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";

export function sampleNetworkMarkerAccessibilityLabel(
  icon: OverviewSamplePointIcon,
): string {
  if (icon.layerType === "DESIGN_COVERAGE_BADGE") {
    const count =
      icon.aggregateCount === undefined ? "" : `，${icon.aggregateCount} 个设计样本`;
    return `${icon.name}${count}，行政村展示分区覆盖徽标，不代表精确经纬度`;
  }
  if (icon.layerType === "DESIGN_EXACT_LOCATION") {
    return `${icon.name}，已审核设计样本点精确位置`;
  }
  if (icon.layerType === "REGIONAL_ACTUAL_BADGE") {
    return `${icon.name}，仅确认到${regionalActualLevelLabel(icon.representedRegionLevel)}，不显示伪造图钉`;
  }
  return `${icon.name}，${icon.types.map((type) => type.name).join("、")}，点击查看样本点详情`;
}

function regionalActualLevelLabel(
  level: OverviewSamplePointIcon["representedRegionLevel"],
): string {
  if (level === "PREFECTURE") return "地级市";
  if (level === "COUNTY") return "区县";
  if (level === "TOWNSHIP") return "乡镇";
  return "行政区域";
}
