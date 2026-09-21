import { buffer } from "@turf/buffer";
import { difference } from "@turf/difference";
import { union } from "@turf/union";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";

import type { RailwayFacility } from "../../domain/operationalFacilities";
import { flattenCoordinates, type MapFeature } from "./boundaryGeometry";

export type TerrainEnhancementState =
  | "LOADING"
  | "READY"
  | "DEGRADED_IMAGERY"
  | "DEGRADED_TERRAIN"
  | "DEGRADED_BASEMAP"
  | "DEGRADED_ICONS"
  | "DEGRADED_MULTIPLE"
  | "DEGRADED_RENDERER";

export type TerrainEnhancementFailure = Exclude<
  TerrainEnhancementState,
  "LOADING" | "READY" | "DEGRADED_MULTIPLE" | "DEGRADED_RENDERER"
>;

export function terrainEnhancementStateForSource(
  sourceId: string | undefined,
): TerrainEnhancementFailure | undefined {
  if (sourceId === "satellite") return "DEGRADED_IMAGERY";
  if (sourceId === "terrain-dem" || sourceId === "hillshade-dem")
    return "DEGRADED_TERRAIN";
  if (sourceId === "openmaptiles") return "DEGRADED_BASEMAP";
  return undefined;
}

export function terrainEnhancementStateForFailures(
  failures: Iterable<TerrainEnhancementFailure>,
): TerrainEnhancementState | undefined {
  const unique = new Set(failures);
  if (unique.size === 0) return undefined;
  if (unique.size === 1) return unique.values().next().value;
  return "DEGRADED_MULTIPLE";
}

export function terrainEnhancementStateAfterInitialIdle(
  failures: Iterable<TerrainEnhancementFailure>,
): TerrainEnhancementState {
  return terrainEnhancementStateForFailures(failures) ?? "READY";
}

export function railwayMarkerPresentation(
  relation: RailwayFacility["locationRelation"],
  name: string,
): {
  nearby: boolean;
  name: string;
  relation: RailwayFacility["locationRelation"];
} {
  const nearby = relation === "NEARBY";
  return {
    nearby,
    name: nearby ? `邻近 · ${name}` : name,
    relation,
  };
}

export function settledMarkerImages<T>(results: readonly PromiseSettledResult<T>[]): {
  hasFailures: boolean;
  images: T[];
} {
  return {
    hasFailures: results.some((result) => result.status === "rejected"),
    images: results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  };
}

export function fourRegionContextMaskCollection(
  rootFeatures: readonly MapFeature[],
  contextKilometres = 25,
): FeatureCollection<Polygon | MultiPolygon> {
  const polygons = rootFeatures.map((feature): Feature<Polygon | MultiPolygon> => ({
    type: "Feature",
    properties: {},
    geometry: feature.geometry as unknown as Polygon | MultiPolygon,
  }));
  const merged =
    polygons.length > 1
      ? union({ type: "FeatureCollection", features: polygons })
      : polygons[0];
  const expanded = merged
    ? buffer(merged, contextKilometres, { units: "kilometers", steps: 16 })
    : undefined;
  const context =
    expanded && merged
      ? difference({ type: "FeatureCollection", features: [expanded, merged] })
      : null;
  const rings = !expanded
    ? []
    : expanded.geometry.type === "Polygon"
      ? [expanded.geometry.coordinates[0]!]
      : expanded.geometry.coordinates.map((polygon) => polygon[0]!);
  const world: Position[] = [
    [-179.9, -84.9],
    [179.9, -84.9],
    [179.9, 84.9],
    [-179.9, 84.9],
    [-179.9, -84.9],
  ];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "outside-four-region-context" },
        geometry: {
          type: "Polygon",
          coordinates: [world, ...rings.map(clockwiseRing)],
        },
      },
      ...(context
        ? [
            {
              ...context,
              properties: { kind: "four-region-context-ring" },
            },
          ]
        : []),
    ],
  };
}

function clockwiseRing(ring: Position[]) {
  return signedRingArea(ring) > 0 ? [...ring].reverse() : ring;
}

function signedRingArea(ring: readonly Position[]) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    if (!current || !next) continue;
    area += current[0]! * next[1]! - next[0]! * current[1]!;
  }
  return area / 2;
}

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
