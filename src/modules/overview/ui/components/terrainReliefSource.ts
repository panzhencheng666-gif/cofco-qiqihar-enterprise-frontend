import type { MapFeature, MapPointFeature } from "./boundaryGeometry";

export function reliefTerrainSourceKey(source: {
  backdrop?: MapFeature;
  features: readonly MapFeature[];
  points: readonly MapPointFeature[];
}): string {
  // Counts are live label metadata, not terrain geometry. Keep every other
  // field in the identity so administrative or geographic changes rebuild.
  const terrainFeature = <T extends MapFeature | MapPointFeature>(feature: T) => ({
    ...feature,
    region: { ...feature.region, approvedRecordCount: undefined },
  });
  return JSON.stringify({
    ...(source.backdrop ? { backdrop: terrainFeature(source.backdrop) } : {}),
    features: source.features.map(terrainFeature),
    points: source.points.map(terrainFeature),
  });
}
