import type { OverviewRegion } from "../../domain/overview";
import type {
  OverviewDesignSamplePoint,
  OverviewSamplePointAggregate,
} from "../../domain/overviewSamplePoint";
import { toMapFeature, type Position } from "../components/boundaryGeometry";

type Region = Pick<OverviewRegion, "code" | "name" | "level" | "boundaryGeoJson">;

/** Read-only geographic membership; never changes the saved region or coordinates. */
export function designPointsInRegion(
  points: readonly OverviewDesignSamplePoint[],
  region?: Region,
) {
  if (!region) return points;
  if (!region.boundaryGeoJson) {
    return points.filter(
      (point) =>
        point.regionCode === region.code ||
        point.regionCode.startsWith(
          region.level === "PREFECTURE" ? region.code.slice(0, 4) : region.code,
        ),
    );
  }
  const features = toMapFeature({ ...region, approvedRecordCount: null });
  const polygons = features.flatMap(({ geometry }) =>
    geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : (geometry.coordinates as Position[][][]),
  );
  return points.filter((point) =>
    polygons.some((rings) => {
      const position: Position = [
        point.displayLongitude ?? point.longitude,
        point.displayLatitude ?? point.latitude,
      ];
      const outer = rings[0];
      return (
        outer &&
        ringState(position, outer) !== "outside" &&
        !rings.slice(1).some((hole) => ringState(position, hole) === "inside")
      );
    }),
  );
}

function ringState(
  [x, y]: Position,
  ring: readonly Position[],
): "inside" | "outside" | "boundary" {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i];
    if (!a || !b) continue;
    const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
    const epsilon = Number.EPSILON * 32 * Math.max(1, Math.abs(x), Math.abs(y));
    if (
      Math.abs(cross) <= epsilon &&
      x >= Math.min(a[0], b[0]) &&
      x <= Math.max(a[0], b[0]) &&
      y >= Math.min(a[1], b[1]) &&
      y <= Math.max(a[1], b[1])
    )
      return "boundary";
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside ? "inside" : "outside";
}

export function designPointRegionAggregates(
  points: readonly OverviewDesignSamplePoint[],
  regions: readonly Region[],
): readonly OverviewSamplePointAggregate[] {
  return regions.map((region) => {
    const selected = designPointsInRegion(points, region);
    return {
      sampleKind: "DESIGN",
      regionCode: region.code,
      regionName: region.name,
      regionLevel: region.level,
      scopeKind: "CHILD_REGION",
      anchorRegionCode: region.code,
      samplePointCount: selected.length,
      productionCount: selected.filter(
        (point) => point.context.domainCode === "PRODUCTION",
      ).length,
      marketCount: selected.filter((point) => point.context.domainCode === "MARKET")
        .length,
      logisticsCount: selected.filter(
        (point) => point.context.domainCode === "LOGISTICS",
      ).length,
      validCoordinateCount: selected.length,
      dataQualityIssueCount: 0,
      correctionSourceCount: 0,
      unresolvedSourceCount: 0,
    };
  });
}
