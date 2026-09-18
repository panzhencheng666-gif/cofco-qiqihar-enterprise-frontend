import "maplibre-gl/dist/maplibre-gl.css";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";

import type { MapAnnotation } from "../../application/ports/MapAnnotationRepository";
import type { OverviewRegion } from "../../domain/overview";
import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";
import type { MapFeature } from "./boundaryGeometry";
import {
  administrativeGeoJson,
  annotationGeoJson,
  emptyCollection,
  samplePointGeoJson,
} from "./mapAnnotationPrecisionData";

interface PrecisionMapBounds {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}

const ADMIN_SOURCE = "annotation-admin-regions";
const SAMPLE_SOURCE = "annotation-sample-points";
const ANNOTATION_SOURCE = "annotation-user-shape";
const DEFAULT_VECTOR_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "natural-earth": {
      type: "raster",
      tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 6,
      attribution: "OpenFreeMap / OpenStreetMap contributors",
    },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#47645b" },
    },
    {
      id: "terrain-context",
      type: "raster",
      source: "natural-earth",
      paint: { "raster-opacity": 0.54, "raster-saturation": -0.2 },
    },
    {
      id: "landcover",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood",
          "#285a47",
          "grass",
          "#3f6850",
          "farmland",
          "#6b7046",
          "#385c49",
        ],
        "fill-opacity": 0.48,
      },
    },
    {
      id: "landuse",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      minzoom: 7,
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "agriculture",
          "#7b7745",
          "residential",
          "#315269",
          "industrial",
          "#5a5965",
          "#38594b",
        ],
        "fill-opacity": 0.42,
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#176784", "fill-opacity": 0.94 },
    },
    {
      id: "waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      paint: {
        "line-color": "#39a6c4",
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 13, 2.4],
      },
    },
    {
      id: "roads-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      paint: {
        "line-color": "#061f2d",
        "line-opacity": 0.82,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.2, 14, 8],
      },
    },
    {
      id: "roads",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      paint: {
        "line-color": [
          "match",
          ["get", "class"],
          "motorway",
          "#ffbd59",
          "trunk",
          "#e8aa52",
          "primary",
          "#e7d48b",
          "secondary",
          "#b7cfba",
          "#72989c",
        ],
        "line-opacity": 0.94,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 5],
      },
    },
    {
      id: "buildings",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 12,
      paint: {
        "fill-color": "#b5c9c4",
        "fill-opacity": 0.55,
        "fill-outline-color": "#7ea1a3",
      },
    },
    {
      id: "place-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 4,
      layout: {
        "text-field": ["coalesce", ["get", "name:zh"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 12, 16],
      },
      paint: {
        "text-color": "#eefcff",
        "text-halo-color": "#06283a",
        "text-halo-width": 1.5,
      },
    },
    {
      id: "road-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 9,
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name:zh"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
      },
      paint: {
        "text-color": "#f8f4d8",
        "text-halo-color": "#17333d",
        "text-halo-width": 1.2,
      },
    },
  ],
};

export interface MapAnnotationPrecisionMapHandle {
  reset: () => void;
  unproject: (point: { x: number; y: number }) => {
    longitude: number;
    latitude: number;
  };
  zoomIn: () => void;
  zoomOut: () => void;
}

export const MapAnnotationPrecisionMap = forwardRef<
  MapAnnotationPrecisionMapHandle,
  {
    annotation?: MapAnnotation;
    backdrop?: MapFeature;
    bounds: PrecisionMapBounds;
    features?: readonly MapFeature[];
    onDetailLevelChange?: (level: "REGION" | "GEOGRAPHY" | "SAMPLE") => void;
    onReady?: () => void;
    onRegionDrill?: (region: OverviewRegion) => void;
    onRegionSelect?: (region: OverviewRegion) => void;
    onSamplePointSelect?: (samplePointId: string) => void;
    onUnavailable?: () => void;
    samplePointIcons?: readonly OverviewSamplePointIcon[];
    selectedRegionCode?: string;
    selectedSamplePointId?: string;
    viewAngle: number;
  }
>(function MapAnnotationPrecisionMap(
  {
    annotation,
    backdrop,
    bounds,
    features = [],
    onDetailLevelChange,
    onReady,
    onRegionDrill,
    onRegionSelect,
    onSamplePointSelect,
    onUnavailable,
    samplePointIcons = [],
    selectedRegionCode,
    selectedSamplePointId,
    viewAngle,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const fittedZoomRef = useRef(0);
  const mapBounds = useMemo(
    () => ({
      maxLatitude: bounds.maxLatitude,
      maxLongitude: bounds.maxLongitude,
      minLatitude: bounds.minLatitude,
      minLongitude: bounds.minLongitude,
    }),
    [bounds.maxLatitude, bounds.maxLongitude, bounds.minLatitude, bounds.minLongitude],
  );
  const viewAngleRef = useRef(viewAngle);
  viewAngleRef.current = viewAngle;
  const callbacksRef = useRef({
    onDetailLevelChange,
    onReady,
    onRegionDrill,
    onRegionSelect,
    onSamplePointSelect,
    onUnavailable,
  });
  callbacksRef.current = {
    onDetailLevelChange,
    onReady,
    onRegionDrill,
    onRegionSelect,
    onSamplePointSelect,
    onUnavailable,
  };
  const regionByCode = useMemo(
    () =>
      new Map(
        [...(backdrop ? [backdrop] : []), ...features].map(({ region }) => [
          region.code,
          region,
        ]),
      ),
    [backdrop, features],
  );
  const regionByCodeRef = useRef(regionByCode);
  regionByCodeRef.current = regionByCode;
  const dataRef = useRef({
    annotation,
    backdrop,
    features,
    samplePointIcons,
    selectedRegionCode,
    selectedSamplePointId,
  });
  dataRef.current = {
    annotation,
    backdrop,
    features,
    samplePointIcons,
    selectedRegionCode,
    selectedSamplePointId,
  };

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        const map = mapRef.current;
        if (!map) return;
        fitMap(map, mapBounds, 60);
      },
      unproject: ({ x, y }) => {
        const coordinate = mapRef.current?.unproject([x, y]);
        return {
          longitude: coordinate?.lng ?? mapBounds.minLongitude,
          latitude: coordinate?.lat ?? mapBounds.minLatitude,
        };
      },
      zoomIn: () => mapRef.current?.zoomIn({ duration: 180 }),
      zoomOut: () => mapRef.current?.zoomOut({ duration: 180 }),
    }),
    [mapBounds],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let ready = false;
    let unavailable = false;
    const reportUnavailable = () => {
      if (unavailable) return;
      unavailable = true;
      callbacksRef.current.onUnavailable?.();
    };
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        attributionControl: { compact: true },
        bearing: 0,
        center: [
          (mapBounds.minLongitude + mapBounds.maxLongitude) / 2,
          (mapBounds.minLatitude + mapBounds.maxLatitude) / 2,
        ],
        container,
        doubleClickZoom: false,
        dragRotate: false,
        fadeDuration: 0,
        maxPitch: 60,
        pitch: 30,
        renderWorldCopies: false,
        style:
          import.meta.env.VITE_OVERVIEW_VECTOR_STYLE_URL?.trim() ||
          DEFAULT_VECTOR_STYLE,
      });
    } catch {
      reportUnavailable();
      return;
    }
    map.keyboard.disableRotation();
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    const reportDetailLevel = () => {
      const delta = map.getZoom() - fittedZoomRef.current;
      callbacksRef.current.onDetailLevelChange?.(
        delta >= 2 ? "SAMPLE" : delta >= 0.8 ? "GEOGRAPHY" : "REGION",
      );
    };
    map.on("style.load", () => {
      if (unavailable) return;
      const initialData = dataRef.current;
      ready = true;
      addBusinessLayers(map);
      fitMap(map, mapBounds, viewAngleRef.current);
      fittedZoomRef.current = map.getZoom();
      map.setMinZoom(fittedZoomRef.current);
      updateSource(
        map,
        ADMIN_SOURCE,
        administrativeGeoJson(
          initialData.backdrop,
          initialData.features,
          initialData.selectedRegionCode,
        ),
      );
      updateSource(
        map,
        SAMPLE_SOURCE,
        samplePointGeoJson(
          initialData.samplePointIcons,
          initialData.selectedSamplePointId,
        ),
      );
      updateSource(map, ANNOTATION_SOURCE, annotationGeoJson(initialData.annotation));
      updateSampleVisibility(map, fittedZoomRef.current);
      reportDetailLevel();
      callbacksRef.current.onReady?.();
    });
    map.on("zoom", reportDetailLevel);
    map.on("click", "annotation-admin-fill", (event) => {
      const code = featureCode(event);
      const region = code ? regionByCodeRef.current.get(code) : undefined;
      if (region) callbacksRef.current.onRegionSelect?.(region);
    });
    map.on("dblclick", "annotation-admin-fill", (event) => {
      event.preventDefault();
      const code = featureCode(event);
      const region = code ? regionByCodeRef.current.get(code) : undefined;
      if (region && region.level !== "VILLAGE")
        callbacksRef.current.onRegionDrill?.(region);
    });
    map.on("click", "annotation-sample-points", (event) => {
      const id = featureStringProperty(event, "samplePointId");
      if (typeof id === "string") callbacksRef.current.onSamplePointSelect?.(id);
    });
    for (const layer of ["annotation-admin-fill", "annotation-sample-points"]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
    map.on("error", (event) => {
      const sourceId = (event as { sourceId?: unknown }).sourceId;
      if (!ready || sourceId === "openmaptiles" || sourceId === "natural-earth")
        reportUnavailable();
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [mapBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    map.easeTo({ duration: 180, pitch: 90 - clamp(viewAngle, 30, 90) });
  }, [viewAngle]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    updateSource(
      map,
      ADMIN_SOURCE,
      administrativeGeoJson(backdrop, features, selectedRegionCode),
    );
  }, [backdrop, features, selectedRegionCode]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    updateSource(
      map,
      SAMPLE_SOURCE,
      samplePointGeoJson(samplePointIcons, selectedSamplePointId),
    );
  }, [samplePointIcons, selectedSamplePointId]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    updateSource(map, ANNOTATION_SOURCE, annotationGeoJson(annotation));
  }, [annotation]);

  return (
    <div
      aria-label="高精度地理底图"
      className="overview-map-precision-map"
      data-map-provider="OpenFreeMap / OpenStreetMap"
      ref={containerRef}
    />
  );
});

function addBusinessLayers(map: MapLibreMap) {
  map.addSource(ADMIN_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "annotation-admin-fill",
    type: "fill",
    source: ADMIN_SOURCE,
    paint: {
      "fill-color": ["case", ["==", ["get", "selected"], true], "#ffc84a", "#36c9de"],
      "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.2, 0.07],
    },
  });
  map.addLayer({
    id: "annotation-admin-line",
    type: "line",
    source: ADMIN_SOURCE,
    paint: {
      "line-color": ["case", ["==", ["get", "selected"], true], "#ffd564", "#d9fbff"],
      "line-opacity": 0.92,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 10, 3],
    },
  });
  map.addLayer({
    id: "annotation-admin-label",
    type: "symbol",
    source: ADMIN_SOURCE,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 13, 10, 17],
    },
    paint: {
      "text-color": "#f4fdff",
      "text-halo-color": "#06283a",
      "text-halo-width": 2,
    },
  });
  map.addSource(SAMPLE_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "annotation-sample-points",
    type: "circle",
    source: SAMPLE_SOURCE,
    paint: {
      "circle-color": [
        "match",
        ["get", "role"],
        "PRODUCTION",
        "#62d982",
        "MARKET",
        "#ffca56",
        "LOGISTICS",
        "#67c7ff",
        "#ffffff",
      ],
      "circle-opacity": 0.96,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 12, 8],
      "circle-stroke-color": [
        "case",
        ["==", ["get", "selected"], true],
        "#ff5f56",
        "#092b3d",
      ],
      "circle-stroke-width": ["case", ["==", ["get", "selected"], true], 3, 1.5],
    },
  });
  map.addLayer({
    id: "annotation-sample-labels",
    type: "symbol",
    source: SAMPLE_SOURCE,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-offset": [0, 1.15],
      "text-size": 12,
    },
    paint: {
      "text-color": "#f5fdff",
      "text-halo-color": "#06283a",
      "text-halo-width": 1.5,
    },
  });
  map.addSource(ANNOTATION_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "annotation-user-fill",
    type: "fill",
    source: ANNOTATION_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#ffd564", "fill-opacity": 0.22 },
  });
  map.addLayer({
    id: "annotation-user-line",
    type: "line",
    source: ANNOTATION_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#ffd564", "line-width": 3 },
  });
  map.addLayer({
    id: "annotation-user-point",
    type: "circle",
    source: ANNOTATION_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": "#ffd564",
      "circle-radius": 7,
      "circle-stroke-color": "rgba(255,213,100,0.28)",
      "circle-stroke-width": 7,
    },
  });
}

function updateSampleVisibility(map: MapLibreMap, fittedZoom: number) {
  map.setLayerZoomRange("annotation-sample-points", fittedZoom + 0.75, 24);
  map.setLayerZoomRange("annotation-sample-labels", fittedZoom + 1.6, 24);
}

function fitMap(map: MapLibreMap, bounds: PrecisionMapBounds, padding: number) {
  map.setMaxBounds(null);
  map.fitBounds(toMapBounds(bounds), { bearing: 0, duration: 0, padding, pitch: 30 });
  map.setMaxBounds(toMapBounds(bounds));
}

function toMapBounds(bounds: PrecisionMapBounds): [[number, number], [number, number]] {
  return [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ];
}

function updateSource(
  map: MapLibreMap,
  id: string,
  data: Parameters<GeoJSONSource["setData"]>[0],
) {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) void source.setData(data);
}

function featureCode(event: MapLayerMouseEvent) {
  return featureStringProperty(event, "regionCode");
}

function featureStringProperty(event: MapLayerMouseEvent, key: string) {
  const properties: unknown = event.features?.[0]?.properties;
  if (!properties || typeof properties !== "object") return undefined;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
