import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";

type Placement = {
  icon: OverviewSamplePointIcon;
  point: { x: number; y: number };
};

/** Cluster screen-space collisions without changing any stored/display coordinate. */
export function clusterDesignMapMarkers<T extends Placement>(
  placements: readonly T[],
  separation = 60,
): T[] {
  const result = placements.filter((p) => p.icon.layerType !== "DESIGN_EXACT_LOCATION");
  const groups: { anchor: T; members: T[] }[] = [];
  const designs = placements
    .filter((p) => p.icon.layerType === "DESIGN_EXACT_LOCATION")
    .sort((a, b) => a.icon.samplePointId.localeCompare(b.icon.samplePointId));
  for (const placement of designs) {
    const group = groups.find(
      ({ anchor }) =>
        Math.hypot(
          anchor.point.x - placement.point.x,
          anchor.point.y - placement.point.y,
        ) < separation,
    );
    if (group) group.members.push(placement);
    else groups.push({ anchor: placement, members: [placement] });
  }
  for (const { anchor, members } of groups) {
    if (members.length === 1) result.push(anchor);
    else
      result.push({
        ...anchor,
        icon: {
          ...anchor.icon,
          aggregateCount: members.reduce(
            (sum, member) => sum + (member.icon.aggregateCount ?? 1),
            0,
          ),
          name: `附近设计样本 ${members.length} 个：${members
            .slice(0, 5)
            .map((m) => m.icon.name)
            .join("、")}${members.length > 5 ? "等" : ""}；放大地图或查看右侧列表`,
        },
      });
  }
  return result;
}
