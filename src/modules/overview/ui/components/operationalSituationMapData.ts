import type {
  OperationalFacilityCatalogue,
  RailwayRoute,
} from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";

export type OperationalLayerCode = "STORAGE" | "RAILWAY" | "PUBLIC_EVENT";

export interface OperationalMarker {
  id: string;
  kind: OperationalLayerCode;
  name: string;
  longitude: number;
  latitude: number;
}

export function operationalMarkers(
  facilities: OperationalFacilityCatalogue,
  situation: OperationalSituationCatalogue,
): readonly OperationalMarker[] {
  return [
    ...facilities.storageFacilities.flatMap((facility) =>
      facility.longitude === null || facility.latitude === null
        ? []
        : [
            {
              id: facility.code,
              kind: "STORAGE" as const,
              name: facility.name,
              longitude: facility.longitude,
              latitude: facility.latitude,
            },
          ],
    ),
    ...facilities.railwayFacilities.map((facility) => ({
      id: facility.sourceId,
      kind: "RAILWAY" as const,
      name: facility.name,
      longitude: facility.longitude,
      latitude: facility.latitude,
    })),
    ...situation.publicEvents.map((event) => ({
      id: event.eventId,
      kind: "PUBLIC_EVENT" as const,
      name: event.title,
      longitude: event.longitude,
      latitude: event.latitude,
    })),
  ];
}

export function railwayRouteGeoJson(routes: readonly RailwayRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.flatMap((route) => {
      try {
        const geometry = JSON.parse(route.geometryGeoJson) as {
          type?: unknown;
          coordinates?: unknown;
        };
        if (
          (geometry.type !== "LineString" && geometry.type !== "MultiLineString") ||
          !Array.isArray(geometry.coordinates)
        )
          return [];
        return [
          {
            type: "Feature" as const,
            geometry: geometry as {
              type: "LineString" | "MultiLineString";
              coordinates: unknown[];
            },
            properties: {
              id: route.id,
              name: route.name,
              sourceUrl: route.sourceUrl,
            },
          },
        ];
      } catch {
        return [];
      }
    }),
  };
}
