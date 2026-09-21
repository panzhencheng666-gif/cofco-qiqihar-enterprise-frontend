import type { OverviewRegion } from "../../domain/overview";
import {
  flattenCoordinates,
  toMapFeature,
  toMapPointFeature,
} from "./boundaryGeometry";
import type { GeographicBounds } from "./realisticSituationModel";

export function publicMapFocus(region: OverviewRegion): GeographicBounds | undefined {
  const valid = ([lng, lat]: readonly number[]) =>
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng!) <= 180 &&
    Math.abs(lat!) <= 85;
  if (region.level !== "VILLAGE") {
    const coordinates = toMapFeature(region).flatMap((feature) =>
      flattenCoordinates(feature.geometry),
    );
    if (coordinates.length && coordinates.every(valid))
      return {
        minLongitude: Math.min(...coordinates.map((p) => p[0])),
        maxLongitude: Math.max(...coordinates.map((p) => p[0])),
        minLatitude: Math.min(...coordinates.map((p) => p[1])),
        maxLatitude: Math.max(...coordinates.map((p) => p[1])),
      };
  }
  const point = toMapPointFeature(region)[0]?.position;
  if (!point || !valid(point)) return undefined;
  // A camera envelope, not an administrative boundary; never rendered as one.
  const radius =
    region.level === "VILLAGE" ? 0.006 : region.level === "TOWNSHIP" ? 0.025 : 0.12;
  return {
    minLongitude: point[0] - radius,
    maxLongitude: point[0] + radius,
    minLatitude: point[1] - radius,
    maxLatitude: point[1] + radius,
  };
}
