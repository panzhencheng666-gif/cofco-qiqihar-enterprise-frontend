import { flattenCoordinates, type MapFeature } from "./boundaryGeometry";

export const ALL_ATLAS_SOURCE_IDS = [
  "regions",
  "railRoutes",
  "logistics",
  "inventory",
  "markers",
  "annotation",
] as const;

export type AtlasSourceId = (typeof ALL_ATLAS_SOURCE_IDS)[number];

export interface AtlasLayerVisibility {
  ADMINISTRATIVE: boolean;
  HISTORICAL_LEASED: boolean;
  INVENTORY: boolean;
  LEASED: boolean;
  LOGISTICS: boolean;
  OWNED: boolean;
  RAILWAY: boolean;
  RAILWAY_ROUTE: boolean;
  WEATHER: boolean;
}

export function atlasLayerVisibilityKey(layers: AtlasLayerVisibility) {
  return [
    layers.ADMINISTRATIVE,
    layers.HISTORICAL_LEASED,
    layers.INVENTORY,
    layers.LEASED,
    layers.LOGISTICS,
    layers.OWNED,
    layers.RAILWAY,
    layers.RAILWAY_ROUTE,
    layers.WEATHER,
  ].join(":");
}

export interface AtlasSourceReferences {
  annotation: unknown;
  annotationDraftKey: string;
  backdrop: unknown;
  features: unknown;
  inventories: unknown;
  logisticsFlows: unknown;
  markerLayerKey: string;
  railwayFacilities: unknown;
  railwayRoutes: unknown;
  selectedFacilityId: string | undefined;
  selectedRegionCode: string | undefined;
  storageFacilities: unknown;
  weather: unknown;
}

export function changedAtlasSources(
  previous: AtlasSourceReferences | undefined,
  next: AtlasSourceReferences,
): AtlasSourceId[] {
  if (!previous) return [...ALL_ATLAS_SOURCE_IDS];
  const changed: AtlasSourceId[] = [];
  if (
    previous.backdrop !== next.backdrop ||
    previous.features !== next.features ||
    previous.selectedRegionCode !== next.selectedRegionCode
  )
    changed.push("regions");
  if (previous.railwayRoutes !== next.railwayRoutes) changed.push("railRoutes");
  if (previous.logisticsFlows !== next.logisticsFlows) changed.push("logistics");
  if (previous.inventories !== next.inventories) changed.push("inventory");
  if (
    previous.storageFacilities !== next.storageFacilities ||
    previous.railwayFacilities !== next.railwayFacilities ||
    previous.weather !== next.weather ||
    previous.selectedFacilityId !== next.selectedFacilityId ||
    previous.markerLayerKey !== next.markerLayerKey
  )
    changed.push("markers");
  if (
    previous.annotation !== next.annotation ||
    previous.annotationDraftKey !== next.annotationDraftKey
  )
    changed.push("annotation");
  return changed;
}

export function terrainFocusBounds(
  backdrop: MapFeature | undefined,
  features: readonly MapFeature[],
  selectedRegionCode: string | undefined,
  fallback: MapSurfaceBounds,
): MapSurfaceBounds {
  const selected = selectedRegionCode
    ? [backdrop, ...features].find(
        (feature) => feature?.region.code === selectedRegionCode,
      )
    : undefined;
  const focus = selected ?? backdrop;
  if (!focus) return fallback;
  const coordinates = flattenCoordinates(focus.geometry);
  if (!coordinates.length) return fallback;
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return {
    minLongitude: Math.min(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLongitude: Math.max(...longitudes),
    maxLatitude: Math.max(...latitudes),
  };
}

export interface MapSurfaceBounds {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}
