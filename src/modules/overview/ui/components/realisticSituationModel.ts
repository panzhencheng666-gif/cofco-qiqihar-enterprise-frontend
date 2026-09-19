import type { StorageFacilityRelation } from "../../domain/operationalFacilities";
import type { OverviewRegion } from "../../domain/overview";

export interface GeographicBounds {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}

export const REALISTIC_ROOT_BOUNDS: GeographicBounds = Object.freeze({
  minLongitude: 115.3,
  minLatitude: 45.7,
  maxLongitude: 131.7,
  maxLatitude: 53.6,
});

export type RealisticSituationFeatureKind =
  | StorageFacilityRelation
  | "RAILWAY"
  | "WEATHER"
  | "INVENTORY"
  | "LOGISTICS";

export interface DepotLayerState {
  OWNED: boolean;
  LEASED: boolean;
  HISTORICAL_LEASED: boolean;
}

export interface RealisticCamera {
  longitude: number;
  latitude: number;
  height: number;
  headingDegrees: number;
  pitchDegrees: number;
}

export function focusDepotCategory(category: StorageFacilityRelation): DepotLayerState {
  return {
    OWNED: category === "OWNED",
    LEASED: category === "LEASED",
    HISTORICAL_LEASED: category === "HISTORICAL_LEASED",
  };
}

export function altitudeDetailLevel(
  heightMetres: number,
): OverviewRegion["level"] {
  if (heightMetres > 850_000) return "PREFECTURE";
  if (heightMetres > 220_000) return "COUNTY";
  if (heightMetres > 55_000) return "TOWNSHIP";
  return "VILLAGE";
}

export function realisticCamera(
  bounds: GeographicBounds,
  level: OverviewRegion["level"] | undefined,
): RealisticCamera {
  const longitudeSpan = Math.max(0.02, bounds.maxLongitude - bounds.minLongitude);
  const latitudeSpan = Math.max(0.02, bounds.maxLatitude - bounds.minLatitude);
  const dominantSpan = Math.max(longitudeSpan, latitudeSpan * 1.35);
  const minimumHeight: Readonly<Record<OverviewRegion["level"], number>> = {
    PREFECTURE: 1_700_000,
    COUNTY: 360_000,
    TOWNSHIP: 110_000,
    VILLAGE: 24_000,
  };
  const targetLevel = level ?? "PREFECTURE";
  return {
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    height: Math.max(minimumHeight[targetLevel], dominantSpan * 104_000),
    headingDegrees: targetLevel === "PREFECTURE" ? 2 : 0,
    pitchDegrees: targetLevel === "PREFECTURE" ? -52 : -48,
  };
}

export function situationFeatureId(kind: RealisticSituationFeatureKind, id: string) {
  return `${kind}:${id}`;
}

export interface SituationViewerLifecycleSnapshot {
  activeViewerCount: number;
  billboardCount: number;
  createdViewerCount: number;
  domMarkerCount: number;
}

export class SituationViewerLifecycle {
  private activeViewerCount = 0;
  private billboardCount = 0;
  private createdViewerCount = 0;
  private domMarkerCount = 0;

  viewerCreated() {
    this.createdViewerCount += 1;
    this.activeViewerCount += 1;
  }

  viewerDestroyed() {
    this.activeViewerCount = Math.max(0, this.activeViewerCount - 1);
  }

  dataSynchronized({
    billboardCount,
    domMarkerCount,
  }: {
    billboardCount: number;
    domMarkerCount: number;
  }) {
    this.billboardCount = billboardCount;
    this.domMarkerCount = domMarkerCount;
  }

  snapshot(): SituationViewerLifecycleSnapshot {
    return {
      activeViewerCount: this.activeViewerCount,
      billboardCount: this.billboardCount,
      createdViewerCount: this.createdViewerCount,
      domMarkerCount: this.domMarkerCount,
    };
  }
}

