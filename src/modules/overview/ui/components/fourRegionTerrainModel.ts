import type { FeatureCollection } from "geojson";

import type { MapFeature, Position } from "./boundaryGeometry";

export const ALL_ATLAS_SOURCE_IDS = [
  "mask",
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
  if (previous.backdrop !== next.backdrop || previous.features !== next.features)
    changed.push("mask");
  if (
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

export function terrainFootprint(
  backdrop: MapFeature | undefined,
  features: readonly MapFeature[],
): readonly MapFeature[] {
  return backdrop ? [backdrop] : features;
}

export interface MapSurfaceBounds {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}

export function createTerrainSurfaceMask(
  features: readonly MapFeature[],
  bounds: MapSurfaceBounds,
): FeatureCollection {
  const surfaceBoundary: [number, number][] = [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
    [bounds.minLongitude, bounds.maxLatitude],
    [bounds.minLongitude, bounds.minLatitude],
  ];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { purpose: "hide-everything-outside-governed-regions" },
        geometry: {
          type: "Polygon",
          coordinates: [surfaceBoundary, ...features.flatMap(exteriorRings)],
        },
      },
    ],
  };
}

function exteriorRings(feature: MapFeature): [number, number][][] {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as Position[][]]
      : (feature.geometry.coordinates as Position[][][]);
  return polygons.flatMap((polygon) => {
    const exterior = polygon[0];
    return exterior && exterior.length >= 4
      ? [
          exterior.map(
            ([longitude, latitude]) => [longitude, latitude] as [number, number],
          ),
        ]
      : [];
  });
}
