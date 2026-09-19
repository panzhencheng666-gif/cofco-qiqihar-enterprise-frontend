import type {
  OperationalFacilityCatalogue,
  RailwayRoute,
} from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";

export type OperationalLayerCode = "STORAGE" | "RAILWAY" | "INVENTORY" | "PUBLIC_EVENT";

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
    ...(situation.inventories ?? []).map((inventory) => ({
      id: `inventory:${inventory.regionCode}:${inventory.productCode}`,
      kind: "INVENTORY" as const,
      name: `${inventory.regionName}库存 ${inventory.inventoryTonnes.toLocaleString("zh-CN")} 吨`,
      longitude: inventory.longitude,
      latitude: inventory.latitude,
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

export function logisticsFlowGeoJson(
  flows: OperationalSituationCatalogue["logisticsFlows"],
) {
  return {
    type: "FeatureCollection" as const,
    features: (flows ?? []).map((flow) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [flow.originLongitude, flow.originLatitude],
          [flow.destinationLongitude, flow.destinationLatitude],
        ],
      },
      properties: {
        id: flow.eventId,
        name: `${flow.originRegionName} → ${flow.destinationRegionName}`,
        volumeTonnes: flow.volumeTonnes,
      },
    })),
  };
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
