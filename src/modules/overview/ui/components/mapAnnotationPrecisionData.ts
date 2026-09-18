import type { MapAnnotation } from "../../application/ports/MapAnnotationRepository";
import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";
import type { MapFeature } from "./boundaryGeometry";

export function administrativeGeoJson(
  backdrop: MapFeature | undefined,
  features: readonly MapFeature[],
  selectedRegionCode?: string,
  weatherRiskByRoot: ReadonlyMap<string, string> = new Map(),
) {
  return {
    type: "FeatureCollection" as const,
    features: [...(backdrop ? [backdrop] : []), ...features].map(
      ({ geometry, region }) => ({
        type: "Feature" as const,
        geometry,
        properties: {
          name: region.name,
          regionCode: region.code,
          selected: region.code === selectedRegionCode,
          weatherRiskLevel: weatherRiskLevel(region.code, weatherRiskByRoot),
        },
      }),
    ),
  };
}

function weatherRiskLevel(
  regionCode: string,
  weatherRiskByRoot: ReadonlyMap<string, string>,
) {
  const risk = [...weatherRiskByRoot].find(([rootCode]) =>
    regionCode.startsWith(rootCode.slice(0, 4)),
  )?.[1];
  if (!risk) return 0;
  return risk.includes("未触发") ? 1 : 2;
}

export function samplePointGeoJson(
  icons: readonly OverviewSamplePointIcon[],
  selectedSamplePointId?: string,
) {
  return {
    type: "FeatureCollection" as const,
    features: icons.flatMap((icon) => {
      const actualLayer =
        icon.layerType === undefined ||
        icon.layerType === "ANNUAL_ACTUAL" ||
        icon.layerType === "HISTORICAL_ACTUAL";
      if (
        !actualLayer ||
        icon.locationMode !== "REPORTED_COORDINATE" ||
        icon.longitude === null ||
        icon.latitude === null
      )
        return [];
      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [icon.longitude, icon.latitude],
          },
          properties: {
            name: icon.name,
            role: icon.roles?.[0]?.code ?? "",
            samplePointId: icon.samplePointId,
            selected: icon.samplePointId === selectedSamplePointId,
          },
        },
      ];
    }),
  };
}

export function annotationGeoJson(annotation?: MapAnnotation) {
  if (!annotation) return emptyCollection();
  const geometry =
    annotation.type === "POINT"
      ? {
          type: "Point" as const,
          coordinates: [annotation.minLongitude, annotation.minLatitude],
        }
      : {
          type: "Polygon" as const,
          coordinates: [
            [
              [annotation.minLongitude, annotation.minLatitude],
              [annotation.maxLongitude, annotation.minLatitude],
              [annotation.maxLongitude, annotation.maxLatitude],
              [annotation.minLongitude, annotation.maxLatitude],
              [annotation.minLongitude, annotation.minLatitude],
            ],
          ],
        };
  return {
    type: "FeatureCollection" as const,
    features: [{ type: "Feature" as const, geometry, properties: {} }],
  };
}

export function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}
