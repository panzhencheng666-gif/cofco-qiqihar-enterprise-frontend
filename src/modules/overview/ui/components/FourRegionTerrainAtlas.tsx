import "maplibre-gl/dist/maplibre-gl.css";
import "./realistic-operational-situation.css";

import { useEffect, useRef } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry as GeoJsonGeometry,
  MultiPolygon as GeoJsonMultiPolygon,
  Point as GeoJsonPoint,
  Polygon as GeoJsonPolygon,
  Position as GeoJsonPosition,
} from "geojson";
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type SymbolLayerSpecification,
} from "maplibre-gl";

import type { MapAnnotation } from "../../application/ports/MapAnnotationRepository";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import {
  atlasLayerVisibilityKey,
  changedAtlasSources,
  terrainFocusBounds,
  type AtlasSourceReferences,
} from "./fourRegionTerrainModel";
import {
  FOUR_REGION_BASE_STYLE,
  FOUR_REGION_DETAIL_LAYERS,
  FOUR_REGION_REMOTE_SOURCES,
  surfaceModePaint,
  type TerrainSurfaceMode,
} from "./fourRegionTerrainStyle";
import {
  loadSvgMarkerImage,
  realisticSituationIcon,
  realisticWeatherIcon,
} from "./realisticSituationIcons";
import {
  SituationViewerLifecycle,
  type DepotLayerState,
  type GeographicBounds,
} from "./realisticSituationModel";

export interface RealisticSceneLayers extends DepotLayerState {
  ADMINISTRATIVE: boolean;
  INVENTORY: boolean;
  LOGISTICS: boolean;
  RAILWAY: boolean;
  RAILWAY_ROUTE: boolean;
  WEATHER: boolean;
}

export interface RealisticSceneCommand {
  id: number;
  tiltDegrees?: number;
  type: "ZOOM_IN" | "ZOOM_OUT" | "RESET" | "SET_TILT";
}

export type TerrainEnhancementState = "LOADING" | "READY" | "DEGRADED";

export interface FourRegionTerrainAtlasProps {
  annotation?: MapAnnotation;
  annotationActive?: boolean;
  annotationDraft?: readonly [number, number];
  backdrop?: MapFeature;
  bounds: GeographicBounds;
  command?: RealisticSceneCommand;
  facilities: OperationalFacilityCatalogue;
  features: readonly MapFeature[];
  layers: RealisticSceneLayers;
  onFacilitySelect: (id: string) => void;
  onEnhancementState?: (state: TerrainEnhancementState) => void;
  onAnnotationPosition?: (longitude: number, latitude: number) => void;
  onReady?: () => void;
  onRegionDrill: (region: OverviewRegion) => void;
  onRegionSelect: (region: OverviewRegion) => void;
  selectedFacilityId?: string;
  selectedRegionCode?: string;
  situation: OperationalSituationCatalogue;
  surfaceMode?: TerrainSurfaceMode;
}

interface AtlasRuntime {
  cancelEnhancementTimeout?: () => void;
  destroyed: boolean;
  lastBoundsKey: string;
  lastLayerVisibilityKey: string;
  lastSurfaceMode?: TerrainSurfaceMode;
  lifecycle: SituationViewerLifecycle;
  map: MapLibreMap;
  props: FourRegionTerrainAtlasProps;
  ready: boolean;
  sourceReferences?: AtlasSourceReferences;
  syncRevision: number;
}

const DEPOT_KINDS = ["OWNED", "LEASED", "HISTORICAL_LEASED"] as const;

export default function FourRegionTerrainAtlas(props: FourRegionTerrainAtlasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<AtlasRuntime | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
    const runtime = runtimeRef.current;
    if (runtime) runtime.props = props;
    if (runtime?.ready) synchronizeChangedSources(runtime, props);
  }, [props]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const initialBounds = terrainFocusBounds(
      propsRef.current.backdrop,
      propsRef.current.features,
      propsRef.current.selectedRegionCode,
      propsRef.current.bounds,
    );
    const map = new MapLibreMap({
      attributionControl: { compact: true },
      bearing: -8,
      center: centerOf(initialBounds),
      container: host,
      dragRotate: false,
      fadeDuration: 0,
      localIdeographFontFamily: "sans-serif",
      maxPitch: 72,
      minPitch: 12,
      pitch: 48,
      renderWorldCopies: false,
      style: FOUR_REGION_BASE_STYLE,
    });
    map.doubleClickZoom.disable();
    map.keyboard.disableRotation();
    map.touchZoomRotate.disableRotation();
    const lifecycle = new SituationViewerLifecycle();
    lifecycle.viewerCreated();
    const runtime: AtlasRuntime = {
      destroyed: false,
      lastBoundsKey: "",
      lastLayerVisibilityKey: "",
      lifecycle,
      map,
      props: propsRef.current,
      ready: false,
      syncRevision: 0,
    };
    runtimeRef.current = runtime;

    map.on("load", () => {
      host.dataset.sceneState = "local-ready";
      installAtlasLayers(map);
      runtime.ready = true;
      synchronizeChangedSources(runtime, propsRef.current);
      propsRef.current.onReady?.();
      runtime.cancelEnhancementTimeout = installTerrainEnhancements(
        map,
        host,
        (state) => propsRef.current.onEnhancementState?.(state),
      );
      applySurfaceMode(map, propsRef.current.surfaceMode ?? "FUSION");
    });
    map.on("error", () => {
      runtime.cancelEnhancementTimeout?.();
      setEnhancementState(host, "DEGRADED", (state) =>
        propsRef.current.onEnhancementState?.(state),
      );
      host.setAttribute(
        "aria-description",
        "在线影像、地形、地名或图标增强暂不可用，四区域边界与业务图层仍可操作。",
      );
    });
    map.on("click", "atlas-regions-fill", (event) =>
      selectRegion(runtime, event, false),
    );
    map.on("dblclick", "atlas-regions-fill", (event) =>
      selectRegion(runtime, event, true),
    );
    map.on("click", "atlas-operational-markers", (event) =>
      selectOperationalMarker(runtime, event),
    );
    map.on("click", "atlas-railway-markers", (event) =>
      selectOperationalMarker(runtime, event),
    );
    map.on("click", "atlas-weather-markers", (event) =>
      selectWeatherMarker(runtime, event),
    );
    map.on("click", (event) => selectAnnotationPosition(runtime, event));
    map.on("zoom", () => {
      host.dataset.detailLevel = detailLevel(map.getZoom());
    });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => map.resize());
    resizeObserver?.observe(host);
    return () => {
      resizeObserver?.disconnect();
      runtime.cancelEnhancementTimeout?.();
      runtime.destroyed = true;
      lifecycle.viewerDestroyed();
      runtimeRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime?.ready || !props.command) return;
    applyCommand(
      runtime.map,
      props.command,
      terrainFocusBounds(
        props.backdrop,
        props.features,
        props.selectedRegionCode,
        props.bounds,
      ),
    );
  }, [
    props.backdrop,
    props.bounds,
    props.command,
    props.features,
    props.selectedRegionCode,
  ]);

  return (
    <div
      aria-label="齐齐哈尔、黑河、呼伦贝尔、大兴安岭连续三维地形融合图"
      className="four-region-terrain-atlas"
      data-detail-level="PREFECTURE"
      data-dom-markers="0"
      data-annotation-active={String(Boolean(props.annotationActive))}
      ref={hostRef}
      role="img"
    />
  );
}

function installTerrainEnhancements(
  map: MapLibreMap,
  host: HTMLDivElement,
  onState: (state: TerrainEnhancementState) => void,
) {
  setEnhancementState(host, "LOADING", onState);
  const timeoutId = window.setTimeout(() => {
    if (host.dataset.enhancementState === "loading")
      setEnhancementState(host, "DEGRADED", onState);
  }, 5_000);
  const cancelTimeout = () => window.clearTimeout(timeoutId);
  let degraded = false;
  Object.entries(FOUR_REGION_REMOTE_SOURCES).forEach(([id, source]) => {
    try {
      if (!map.getSource(id)) map.addSource(id, source);
    } catch {
      degraded = true;
    }
  });
  FOUR_REGION_DETAIL_LAYERS.forEach((layer) => {
    try {
      if (!map.getLayer(layer.id)) map.addLayer(layer, "atlas-regions-fill");
    } catch {
      degraded = true;
    }
  });
  if (degraded) {
    cancelTimeout();
    setEnhancementState(host, "DEGRADED", onState);
  }
  map.once("idle", () => {
    cancelTimeout();
    if (host.dataset.enhancementState !== "degraded")
      setEnhancementState(host, "READY", onState);
  });
  return cancelTimeout;
}

function setEnhancementState(
  host: HTMLDivElement,
  state: TerrainEnhancementState,
  onState: (state: TerrainEnhancementState) => void,
) {
  host.dataset.enhancementState = state.toLowerCase();
  onState(state);
}

function installAtlasLayers(map: MapLibreMap) {
  map.addSource("atlas-regions", { type: "geojson", data: emptyCollection() });
  map.addSource("atlas-rail-routes", { type: "geojson", data: emptyCollection() });
  map.addSource("atlas-logistics", { type: "geojson", data: emptyCollection() });
  map.addSource("atlas-inventory", { type: "geojson", data: emptyCollection() });
  map.addSource("atlas-markers", { type: "geojson", data: emptyCollection() });
  map.addSource("atlas-annotation", { type: "geojson", data: emptyCollection() });

  map.addLayer({
    id: "atlas-regions-fill",
    type: "fill",
    source: "atlas-regions",
    paint: {
      "fill-color": ["case", ["==", ["get", "selected"], true], "#f0cc73", "#f5f1df"],
      "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.07, 0.012],
    },
  });
  map.addLayer({
    id: "atlas-regions-outline",
    type: "line",
    source: "atlas-regions",
    paint: {
      "line-blur": 0.05,
      "line-color": ["case", ["==", ["get", "selected"], true], "#ffe49b", "#f7f3e6"],
      "line-opacity": ["case", ["==", ["get", "selected"], true], 0.86, 0.58],
      "line-width": ["case", ["==", ["get", "selected"], true], 2, 0.9],
    },
  });
  map.addLayer({
    id: "atlas-region-labels",
    type: "symbol",
    source: "atlas-regions",
    layout: {
      "symbol-placement": "point",
      "text-allow-overlap": false,
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["case", ["==", ["get", "selected"], true], 17, 14],
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#17211d",
      "text-halo-width": 2,
    },
  });
  map.addLayer({
    id: "atlas-rail-routes",
    type: "line",
    source: "atlas-rail-routes",
    paint: {
      "line-color": "#f4f5ef",
      "line-dasharray": [2, 2],
      "line-opacity": 0.8,
      "line-width": 1.8,
    },
  });
  map.addLayer({
    id: "atlas-logistics",
    type: "line",
    source: "atlas-logistics",
    paint: {
      "line-color": "#f0ad35",
      "line-dasharray": [1.5, 1.4],
      "line-opacity": 0.98,
      "line-width": 3.2,
    },
  });
  map.addLayer({
    id: "atlas-inventory",
    type: "circle",
    source: "atlas-inventory",
    paint: {
      "circle-color": "#4da477",
      "circle-radius": 6,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "atlas-operational-markers",
    type: "symbol",
    source: "atlas-markers",
    filter: ["match", ["get", "kind"], [...DEPOT_KINDS], true, false],
    layout: markerLayout(0.72),
  });
  map.addLayer({
    id: "atlas-railway-markers",
    type: "symbol",
    source: "atlas-markers",
    filter: ["==", ["get", "kind"], "RAILWAY"],
    minzoom: 5.6,
    layout: markerLayout(0.68),
  });
  map.addLayer({
    id: "atlas-weather-markers",
    type: "symbol",
    source: "atlas-markers",
    filter: ["==", ["get", "kind"], "WEATHER"],
    layout: markerLayout(0.82),
  });
  map.addLayer({
    id: "atlas-annotation-fill",
    type: "fill",
    source: "atlas-annotation",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#f1c64c", "fill-opacity": 0.2 },
  });
  map.addLayer({
    id: "atlas-annotation-line",
    type: "line",
    source: "atlas-annotation",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#fff0a3", "line-width": 3 },
  });
  map.addLayer({
    id: "atlas-annotation-point",
    type: "circle",
    source: "atlas-annotation",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": "#f1c64c",
      "circle-radius": 8,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}

function markerLayout(
  iconSize: number,
): NonNullable<SymbolLayerSpecification["layout"]> {
  return {
    "icon-allow-overlap": false,
    "icon-anchor": "bottom" as const,
    "icon-image": ["get", "iconId"] as ["get", string],
    "icon-size": ["case", ["==", ["get", "selected"], true], iconSize * 1.28, iconSize],
  };
}

function synchronizeChangedSources(
  runtime: AtlasRuntime,
  props: FourRegionTerrainAtlasProps,
) {
  runtime.props = props;
  const references = sourceReferences(props);
  const changed = new Set(changedAtlasSources(runtime.sourceReferences, references));
  runtime.sourceReferences = references;
  const surfaceMode = props.surfaceMode ?? "FUSION";
  if (runtime.lastSurfaceMode !== surfaceMode) {
    applySurfaceMode(runtime.map, surfaceMode);
    runtime.lastSurfaceMode = surfaceMode;
  }

  if (changed.has("regions"))
    setSource(runtime.map, "atlas-regions", regionCollection(props));
  if (changed.has("railRoutes"))
    setSource(runtime.map, "atlas-rail-routes", railwayCollection(props));
  if (changed.has("logistics"))
    setSource(runtime.map, "atlas-logistics", logisticsCollection(props));
  if (changed.has("inventory"))
    setSource(runtime.map, "atlas-inventory", inventoryCollection(props));
  if (changed.has("annotation"))
    setSource(runtime.map, "atlas-annotation", annotationCollection(props));
  const layerVisibilityKey = atlasLayerVisibilityKey(props.layers);
  if (runtime.lastLayerVisibilityKey !== layerVisibilityKey) {
    setLayerVisibility(runtime.map, "atlas-regions-fill", props.layers.ADMINISTRATIVE);
    setLayerVisibility(
      runtime.map,
      "atlas-regions-outline",
      props.layers.ADMINISTRATIVE,
    );
    setLayerVisibility(runtime.map, "atlas-region-labels", props.layers.ADMINISTRATIVE);
    setLayerVisibility(runtime.map, "atlas-rail-routes", props.layers.RAILWAY_ROUTE);
    setLayerVisibility(runtime.map, "atlas-logistics", props.layers.LOGISTICS);
    setLayerVisibility(runtime.map, "atlas-inventory", props.layers.INVENTORY);
    setLayerVisibility(
      runtime.map,
      "atlas-operational-markers",
      depotLayerVisible(props),
    );
    setLayerVisibility(runtime.map, "atlas-railway-markers", props.layers.RAILWAY);
    setLayerVisibility(runtime.map, "atlas-weather-markers", props.layers.WEATHER);
    runtime.lastLayerVisibilityKey = layerVisibilityKey;
  }
  if (changed.has("markers")) {
    const markerData = markerCollection(props);
    const revision = ++runtime.syncRevision;
    void ensureMarkerImages(runtime, props).then((failedImages) => {
      if (runtime.destroyed || revision !== runtime.syncRevision) return;
      setSource(runtime.map, "atlas-markers", markerData);
      const host = runtime.map.getContainer();
      host.dataset.markerState = failedImages ? "degraded" : "ready";
      if (failedImages) {
        host.dataset.enhancementState = "degraded";
        runtime.props.onEnhancementState?.("DEGRADED");
      }
      runtime.map.triggerRepaint();
      runtime.lifecycle.dataSynchronized({
        billboardCount: markerData.features.length,
        domMarkerCount: 0,
      });
      updateLifecycleDataset(runtime);
    });
  }

  const focusBounds = terrainFocusBounds(
    props.backdrop,
    props.features,
    props.selectedRegionCode,
    props.bounds,
  );
  const boundsKey = boundsKeyOf(focusBounds);
  if (boundsKey !== runtime.lastBoundsKey) {
    fitAtlas(runtime.map, focusBounds, runtime.lastBoundsKey ? 420 : 0);
    runtime.lastBoundsKey = boundsKey;
  }
  const host = runtime.map.getContainer();
  host.dataset.annotationActive = String(Boolean(props.annotationActive));
  updateLifecycleDataset(runtime);
}

function applySurfaceMode(map: MapLibreMap, mode: TerrainSurfaceMode) {
  const paint = surfaceModePaint(mode);
  if (map.getLayer("atlas-satellite")) {
    map.setPaintProperty("atlas-satellite", "raster-opacity", paint.satelliteOpacity);
    map.setPaintProperty(
      "atlas-satellite",
      "raster-saturation",
      paint.satelliteSaturation,
    );
    map.setPaintProperty("atlas-satellite", "raster-contrast", paint.satelliteContrast);
  }
  if (map.getLayer("atlas-terrain-light"))
    map.setPaintProperty(
      "atlas-terrain-light",
      "hillshade-exaggeration",
      paint.hillshadeOpacity,
    );
  if (map.getLayer("atlas-landcover"))
    map.setPaintProperty("atlas-landcover", "fill-opacity", paint.landcoverOpacity);
  if (map.getSource("terrain-dem")) {
    map.setTerrain({
      source: "terrain-dem",
      exaggeration: paint.terrainExaggeration,
    });
    map.getContainer().dataset.terrainExaggeration = String(paint.terrainExaggeration);
  }
  map.getContainer().dataset.surfaceMode = mode.toLowerCase();
}

async function ensureMarkerImages(
  runtime: AtlasRuntime,
  props: FourRegionTerrainAtlasProps,
) {
  const specifications = markerImageSpecifications(props);
  const results = await Promise.allSettled(
    [...specifications].map(async ([id, source]) => {
      if (runtime.destroyed || runtime.map.hasImage(id)) return;
      const image = await loadSvgMarkerImage(source);
      if (!runtime.destroyed && !runtime.map.hasImage(id))
        runtime.map.addImage(id, image, { pixelRatio: 2 });
    }),
  );
  return results.some((result) => result.status === "rejected");
}

function sourceReferences(props: FourRegionTerrainAtlasProps): AtlasSourceReferences {
  return {
    annotation: props.annotation,
    annotationDraftKey: props.annotationDraft?.join(":") ?? "",
    backdrop: props.backdrop,
    features: props.features,
    inventories: props.situation.inventories,
    logisticsFlows: props.situation.logisticsFlows,
    markerLayerKey: [
      props.layers.OWNED,
      props.layers.LEASED,
      props.layers.HISTORICAL_LEASED,
      props.layers.RAILWAY,
      props.layers.WEATHER,
    ].join(":"),
    railwayFacilities: props.facilities.railwayFacilities,
    railwayRoutes: props.facilities.railwayRoutes,
    selectedFacilityId: props.selectedFacilityId,
    selectedRegionCode: props.selectedRegionCode,
    storageFacilities: props.facilities.storageFacilities,
    weather: props.situation.weather,
  };
}

function updateLifecycleDataset(runtime: AtlasRuntime) {
  const snapshot = runtime.lifecycle.snapshot();
  const host = runtime.map.getContainer();
  host.dataset.viewerCount = String(snapshot.activeViewerCount);
  host.dataset.createdViewerCount = String(snapshot.createdViewerCount);
  host.dataset.billboardCount = String(snapshot.billboardCount);
  host.dataset.domMarkers = "0";
}

function markerImageSpecifications(props: FourRegionTerrainAtlasProps) {
  const images = new Map<string, string>([
    ["atlas-owned", realisticSituationIcon("OWNED")],
    ["atlas-leased", realisticSituationIcon("LEASED")],
    ["atlas-historical-leased", realisticSituationIcon("HISTORICAL_LEASED")],
    ["atlas-railway", realisticSituationIcon("RAILWAY")],
  ]);
  props.situation.weather.forEach((weather) => {
    images.set(
      weatherIconId(weather.weatherCode),
      realisticWeatherIcon(weather.weatherCode),
    );
  });
  return images;
}

function selectRegion(
  runtime: AtlasRuntime,
  event: MapLayerMouseEvent,
  drill: boolean,
) {
  if (runtime.props.annotationActive) return;
  const code = mapFeatureStringProperty(event, "code");
  if (!code) return;
  const region = regionFeatures(runtime.props).find(
    (feature) => feature.region.code === code,
  )?.region;
  if (!region) return;
  if (drill && region.level !== "VILLAGE") runtime.props.onRegionDrill(region);
  else runtime.props.onRegionSelect(region);
}

function selectOperationalMarker(runtime: AtlasRuntime, event: MapLayerMouseEvent) {
  if (runtime.props.annotationActive) return;
  const id = mapFeatureStringProperty(event, "id");
  if (id) runtime.props.onFacilitySelect(id);
}

function selectWeatherMarker(runtime: AtlasRuntime, event: MapLayerMouseEvent) {
  if (runtime.props.annotationActive) return;
  const code = mapFeatureStringProperty(event, "regionCode");
  if (!code) return;
  const region = regionFeatures(runtime.props).find(
    (feature) => feature.region.code === code,
  )?.region;
  if (region) runtime.props.onRegionSelect(region);
}

function selectAnnotationPosition(runtime: AtlasRuntime, event: MapMouseEvent) {
  const { props } = runtime;
  if (!props.annotationActive || !props.onAnnotationPosition) return;
  const { lng, lat } = event.lngLat;
  if (!insideBounds(lng, lat, props.bounds)) return;
  props.onAnnotationPosition(lng, lat);
}

function regionCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  const featuresByCode = new Map<string, MapFeature>();
  regionFeatures(props).forEach((feature) =>
    featuresByCode.set(feature.region.code, feature),
  );
  return {
    type: "FeatureCollection",
    features: [...featuresByCode.values()].map((feature) => ({
      type: "Feature",
      properties: {
        code: feature.region.code,
        level: feature.region.level,
        name: feature.region.name,
        selected: feature.region.code === props.selectedRegionCode,
      },
      geometry: feature.geometry as unknown as GeoJsonPolygon | GeoJsonMultiPolygon,
    })),
  };
}

function markerCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  const features: Feature[] = [];
  props.facilities.storageFacilities.forEach((facility) => {
    if (
      facility.longitude === null ||
      facility.latitude === null ||
      !props.layers[facility.relationType]
    )
      return;
    features.push(
      pointFeature(facility.longitude, facility.latitude, {
        iconId: depotIconId(facility.relationType),
        id: facility.code,
        kind: facility.relationType,
        name: facility.name,
        selected: facility.code === props.selectedFacilityId,
      }),
    );
  });
  if (props.layers.RAILWAY) {
    props.facilities.railwayFacilities.forEach((facility) => {
      features.push(
        pointFeature(facility.longitude, facility.latitude, {
          iconId: "atlas-railway",
          id: facility.sourceId,
          kind: "RAILWAY",
          name: facility.name,
          selected: facility.sourceId === props.selectedFacilityId,
        }),
      );
    });
  }
  if (props.layers.WEATHER) {
    props.situation.weather.forEach((weather) => {
      features.push(
        pointFeature(weather.longitude, weather.latitude, {
          iconId: weatherIconId(weather.weatherCode),
          id: weather.regionCode ?? weather.rootRegionCode,
          kind: "WEATHER",
          name: `${weather.regionName}实时天气`,
          regionCode: weather.regionCode ?? weather.rootRegionCode,
        }),
      );
    });
  }
  return { type: "FeatureCollection", features };
}

function railwayCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  const features: Feature[] = [];
  props.facilities.railwayRoutes.forEach((route) => {
    try {
      const geometry = JSON.parse(route.geometryGeoJson) as GeoJsonGeometry;
      if (geometry.type === "LineString" || geometry.type === "MultiLineString")
        features.push({ type: "Feature", properties: { id: route.id }, geometry });
    } catch {
      // Invalid public reference geometry stays hidden.
    }
  });
  return { type: "FeatureCollection", features };
}

function logisticsCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (props.situation.logisticsFlows ?? []).map((flow) => ({
      type: "Feature",
      properties: { id: flow.eventId },
      geometry: {
        type: "LineString",
        coordinates: [
          [flow.originLongitude, flow.originLatitude],
          [flow.destinationLongitude, flow.destinationLatitude],
        ],
      },
    })),
  };
}

function inventoryCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (props.situation.inventories ?? []).map((inventory) =>
      pointFeature(inventory.longitude, inventory.latitude, {
        regionCode: inventory.regionCode,
      }),
    ),
  };
}

function annotationCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  const features: Feature[] = [];
  const annotation = props.annotation;
  if (annotation?.type === "POINT")
    features.push(
      pointFeature(annotation.minLongitude, annotation.minLatitude, {
        state: "saved",
      }),
    );
  if (annotation?.type === "RECTANGLE") {
    features.push({
      type: "Feature",
      properties: { state: "saved" },
      geometry: {
        type: "Polygon",
        coordinates: [rectangleRing(annotation)],
      },
    });
  }
  if (props.annotationDraft)
    features.push(
      pointFeature(props.annotationDraft[0], props.annotationDraft[1], {
        state: "draft",
      }),
    );
  return { type: "FeatureCollection", features };
}

function pointFeature(
  longitude: number,
  latitude: number,
  properties: GeoJsonProperties,
): Feature<GeoJsonPoint> {
  return {
    type: "Feature",
    properties,
    geometry: { type: "Point", coordinates: [longitude, latitude] },
  };
}

function rectangleRing(annotation: MapAnnotation): GeoJsonPosition[] {
  return [
    [annotation.minLongitude, annotation.minLatitude],
    [annotation.maxLongitude, annotation.minLatitude],
    [annotation.maxLongitude, annotation.maxLatitude],
    [annotation.minLongitude, annotation.maxLatitude],
    [annotation.minLongitude, annotation.minLatitude],
  ];
}

function setSource(map: MapLibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) void source.setData(data);
}

function mapFeatureStringProperty(event: MapLayerMouseEvent, key: string) {
  const properties: unknown = event.features?.[0]?.properties;
  if (!properties || typeof properties !== "object") return undefined;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function setLayerVisibility(map: MapLibreMap, id: string, visible: boolean) {
  map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function applyCommand(
  map: MapLibreMap,
  command: RealisticSceneCommand,
  bounds: GeographicBounds,
) {
  if (command.type === "ZOOM_IN") map.zoomIn({ duration: 180 });
  if (command.type === "ZOOM_OUT") map.zoomOut({ duration: 180 });
  if (command.type === "RESET") fitAtlas(map, bounds, 240);
  if (command.type === "SET_TILT" && command.tiltDegrees !== undefined)
    map.easeTo({ duration: 180, pitch: 90 - command.tiltDegrees });
}

function fitAtlas(map: MapLibreMap, bounds: GeographicBounds, duration: number) {
  const atlasBounds: [[number, number], [number, number]] = [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ];
  map.setMaxBounds(null);
  const camera = map.cameraForBounds(atlasBounds, {
    bearing: -8,
    padding: { bottom: 110, left: 68, right: 68, top: 150 },
  });
  if (!camera?.center || camera.zoom === undefined) return;
  map.easeTo({
    bearing: -8,
    center: camera.center,
    duration,
    pitch: map.getPitch(),
    zoom: camera.zoom + 0.08,
  });
  map.setMinZoom(Math.max(1.5, camera.zoom - 0.18));
  map.setMaxBounds(atlasBounds);
}

function depotLayerVisible(props: FourRegionTerrainAtlasProps) {
  return DEPOT_KINDS.some((kind) => props.layers[kind]);
}

function depotIconId(kind: (typeof DEPOT_KINDS)[number]) {
  if (kind === "OWNED") return "atlas-owned";
  if (kind === "LEASED") return "atlas-leased";
  return "atlas-historical-leased";
}

function weatherIconId(weatherCode: number | null | undefined) {
  return `atlas-weather-${weatherCode ?? "unknown"}`;
}

function regionFeatures(props: FourRegionTerrainAtlasProps) {
  return [...(props.backdrop ? [props.backdrop] : []), ...props.features];
}

function centerOf(bounds: GeographicBounds): [number, number] {
  return [
    (bounds.minLongitude + bounds.maxLongitude) / 2,
    (bounds.minLatitude + bounds.maxLatitude) / 2,
  ];
}

function boundsKeyOf(bounds: GeographicBounds) {
  return [
    bounds.minLongitude,
    bounds.minLatitude,
    bounds.maxLongitude,
    bounds.maxLatitude,
  ].join(":");
}

function insideBounds(longitude: number, latitude: number, bounds: GeographicBounds) {
  return (
    longitude >= bounds.minLongitude &&
    longitude <= bounds.maxLongitude &&
    latitude >= bounds.minLatitude &&
    latitude <= bounds.maxLatitude
  );
}

function detailLevel(zoom: number): OverviewRegion["level"] {
  if (zoom < 6.1) return "PREFECTURE";
  if (zoom < 8.2) return "COUNTY";
  if (zoom < 10.5) return "TOWNSHIP";
  return "VILLAGE";
}
