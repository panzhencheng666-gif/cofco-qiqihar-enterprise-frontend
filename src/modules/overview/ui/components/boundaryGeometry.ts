import type { OverviewRegion } from "../../domain/overview";

export interface OverviewMapCommand {
  id: number;
  type: "ZOOM_IN" | "ZOOM_OUT" | "RESET" | "ROTATE";
}

export interface OverviewMapSelectionPoint {
  height: number;
  width: number;
  x: number;
  y: number;
}

export type Position = readonly [number, number];

export type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: Position[][] | Position[][][];
};

export interface MapFeature {
  region: OverviewRegion;
  geometry: Geometry;
}

export interface MapPointFeature {
  position: Position;
  region: OverviewRegion;
}

const mapFeatureCache = new WeakMap<OverviewRegion, MapFeature[]>();
const mapPointFeatureCache = new WeakMap<OverviewRegion, MapPointFeature[]>();

export function toMapFeature(region: OverviewRegion): MapFeature[] {
  const cached = mapFeatureCache.get(region);
  if (cached) return cached;
  if (!region.boundaryGeoJson) {
    mapFeatureCache.set(region, []);
    return [];
  }
  try {
    const geometry = JSON.parse(region.boundaryGeoJson) as Geometry;
    const features = ["Polygon", "MultiPolygon"].includes(geometry.type)
      ? [{ region, geometry }]
      : [];
    mapFeatureCache.set(region, features);
    return features;
  } catch {
    mapFeatureCache.set(region, []);
    return [];
  }
}

export function toMapPointFeature(region: OverviewRegion): MapPointFeature[] {
  const cached = mapPointFeatureCache.get(region);
  if (cached) return cached;
  if (!region.locationGeoJson) {
    mapPointFeatureCache.set(region, []);
    return [];
  }
  try {
    const geometry = JSON.parse(region.locationGeoJson) as {
      type?: string;
      coordinates?: unknown;
    };
    if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) {
      mapPointFeatureCache.set(region, []);
      return [];
    }
    const longitude: unknown = geometry.coordinates[0];
    const latitude: unknown = geometry.coordinates[1];
    const points: MapPointFeature[] =
      typeof longitude === "number" && typeof latitude === "number"
        ? [{ position: [longitude, latitude], region }]
        : [];
    mapPointFeatureCache.set(region, points);
    return points;
  } catch {
    mapPointFeatureCache.set(region, []);
    return [];
  }
}

export function flattenCoordinates(geometry: Geometry): Position[] {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : (geometry.coordinates as Position[][][]);
  return polygons.flat(2);
}
