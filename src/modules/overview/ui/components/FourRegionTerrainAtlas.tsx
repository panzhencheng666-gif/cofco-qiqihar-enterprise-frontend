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
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";

import type { MapAnnotation } from "../../application/ports/MapAnnotationRepository";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import { flattenCoordinates, type MapFeature } from "./boundaryGeometry";
import {
  FOUR_REGION_BASE_STYLE,
  FOUR_REGION_DETAIL_LAYERS,
  FOUR_REGION_REMOTE_SOURCES,
  surfaceModePaint,
  type TerrainSurfaceMode,
} from "./fourRegionTerrainStyle";
import {
  calculateOperationalMapPadding,
  fitOperationalMap,
} from "./operationalMapViewport";
import type { GeographicBounds } from "./realisticSituationModel";
import {
  loadSvgMarkerImage,
  realisticSituationIcon,
  realisticWeatherIcon,
} from "./realisticSituationIcons";
import { liveWeatherKind } from "./liveWeatherPresentation";

export interface RealisticSceneLayers {
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

export interface RealisticSceneCommand {
  id: number;
  type: "ZOOM_IN" | "ZOOM_OUT" | "RESET";
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
  rootFeatures: readonly MapFeature[];
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
  destroyed: boolean;
  hierarchyKey: string;
  host: HTMLDivElement;
  map: MapLibreMap;
  props: FourRegionTerrainAtlasProps;
  ready: boolean;
  resizeAnimationFrameId?: number;
  syncedProps?: FourRegionTerrainAtlasProps;
  viewportHeight: number;
  viewportWidth: number;
  weatherAnimationFrameId?: number;
  weatherAnimationUpdatedAt: number;
}

const ROOT_SOURCE = "atlas-root-regions";
const ACTIVE_SOURCE = "atlas-active-regions";
const ROOT_LABEL_SOURCE = "atlas-root-labels";
const ACTIVE_LABEL_SOURCE = "atlas-active-labels";
const MASK_SOURCE = "atlas-region-mask";
const RAIL_SOURCE = "atlas-rail-routes";
const LOGISTICS_SOURCE = "atlas-logistics";
const INVENTORY_SOURCE = "atlas-inventory";
const MARKER_SOURCE = "atlas-markers";
const ANNOTATION_SOURCE = "atlas-annotation";
const REGION_LAYER_IDS = ["atlas-active-fill", "atlas-root-fill"] as const;
const FACILITY_KINDS = ["OWNED", "LEASED", "HISTORICAL_LEASED", "RAILWAY"];

export default function FourRegionTerrainAtlas(props: FourRegionTerrainAtlasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<AtlasRuntime | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.props = props;
    if (runtime.ready) synchronizeAtlas(runtime, props);
  }, [props]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime?.ready || !props.command) return;
    applyCommand(runtime, props.command);
  }, [props.command]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        attributionControl: { compact: true },
        bearing: 0,
        center: centerOf(propsRef.current.bounds),
        container: host,
        dragRotate: false,
        fadeDuration: 120,
        localIdeographFontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        maxPitch: 68,
        minPitch: 34,
        pitch: 52,
        renderWorldCopies: false,
        style: FOUR_REGION_BASE_STYLE,
      });
    } catch {
      propsRef.current.onEnhancementState?.("DEGRADED");
      return;
    }
    map.doubleClickZoom.disable();
    map.keyboard.disableRotation();
    map.touchZoomRotate.disableRotation();
    const runtime: AtlasRuntime = {
      destroyed: false,
      hierarchyKey: "",
      host,
      map,
      props: propsRef.current,
      ready: false,
      viewportHeight: 0,
      viewportWidth: 0,
      weatherAnimationUpdatedAt: 0,
    };
    runtimeRef.current = runtime;
    host.dataset.sceneState = "loading";
    host.dataset.viewerCount = "1";
    host.dataset.createdViewerCount = "1";
    host.dataset.imageryMode = "multiresolution-tile-pyramid";
    propsRef.current.onEnhancementState?.("LOADING");

    map.on("load", () => void initializeAtlas(runtime));
    map.on("error", (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      if (!sourceId || !Object.hasOwn(FOUR_REGION_REMOTE_SOURCES, sourceId)) return;
      host.dataset.enhancementState = "degraded";
      propsRef.current.onEnhancementState?.("DEGRADED");
    });
    map.on("click", (event) => handleMapClick(runtime, event));
    map.on("mousemove", (event) => {
      if (!runtime.ready) return;
      const interactive = map.queryRenderedFeatures(event.point, {
        layers: [
          "atlas-operational-markers",
          "atlas-weather-markers",
          ...REGION_LAYER_IDS,
        ],
      });
      map.getCanvas().style.cursor = interactive.length ? "pointer" : "";
    });
    map.on("zoom", () => {
      host.dataset.imageryZoom = map.getZoom().toFixed(2);
      host.dataset.detailLevel = detailLevel(map.getZoom());
    });

    const resizeObserver = new ResizeObserver(() => scheduleAtlasResize(runtime));
    resizeObserver.observe(host);
    return () => {
      runtime.destroyed = true;
      if (runtime.resizeAnimationFrameId !== undefined)
        cancelAnimationFrame(runtime.resizeAnimationFrameId);
      if (runtime.weatherAnimationFrameId !== undefined)
        cancelAnimationFrame(runtime.weatherAnimationFrameId);
      resizeObserver.disconnect();
      runtimeRef.current = null;
      map.remove();
    };
  }, []);

  return (
    <div
      aria-label="齐齐哈尔、黑河、呼伦贝尔、大兴安岭四区域三维卫星融合沙盘"
      className="four-region-terrain-atlas"
      data-annotation-active={String(Boolean(props.annotationActive))}
      data-dom-markers="0"
      data-region-visibility="governed-four-region-mask"
      data-renderer="maplibre-four-region-terrain"
      data-surface-confinement="four-region-mask"
      ref={hostRef}
      role="img"
    />
  );
}

async function initializeAtlas(runtime: AtlasRuntime) {
  if (runtime.destroyed) return;
  const { host, map } = runtime;
  installRemoteTerrain(map);
  try {
    await installAtlasMarkerImages(map);
  } catch {
    if (runtime.destroyed) return;
    host.dataset.enhancementState = "degraded-icons";
    runtime.props.onEnhancementState?.("DEGRADED");
  }
  if (runtime.destroyed) return;
  installAtlasLayers(map);
  runtime.ready = true;
  host.dataset.sceneState = "local-ready";
  synchronizeAtlas(runtime, runtime.props);
  startWeatherAnimation(runtime);
  runtime.props.onReady?.();
  map.once("idle", () => {
    if (runtime.destroyed) return;
    host.dataset.enhancementState = "ready";
    runtime.props.onEnhancementState?.("READY");
  });
}

async function installAtlasMarkerImages(map: MapLibreMap) {
  const sources = [
    ["atlas-icon-depot-owned", realisticSituationIcon("OWNED")],
    ["atlas-icon-inventory", realisticSituationIcon("OWNED")],
    ["atlas-icon-depot-leased", realisticSituationIcon("LEASED")],
    ["atlas-icon-depot-historical", realisticSituationIcon("HISTORICAL_LEASED")],
    ["atlas-icon-railway", realisticSituationIcon("RAILWAY")],
    ["atlas-icon-weather-clear", realisticWeatherIcon(0)],
    ["atlas-icon-weather-cloud", realisticWeatherIcon(2)],
    ["atlas-icon-weather-rain", realisticWeatherIcon(63)],
    ["atlas-icon-weather-snow", realisticWeatherIcon(73)],
    ["atlas-icon-weather-storm", realisticWeatherIcon(95)],
  ] as const;
  const images = await Promise.all(
    sources.map(
      async ([id, source]) => [id, await loadSvgMarkerImage(source)] as const,
    ),
  );
  images.forEach(([id, image]) => {
    if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
  });
}

function installRemoteTerrain(map: MapLibreMap) {
  Object.entries(FOUR_REGION_REMOTE_SOURCES).forEach(([id, source]) => {
    if (!map.getSource(id)) map.addSource(id, source);
  });
  FOUR_REGION_DETAIL_LAYERS.forEach((layer) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  });
}

function installAtlasLayers(map: MapLibreMap) {
  map.addSource(ROOT_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(ACTIVE_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(ROOT_LABEL_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(ACTIVE_LABEL_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(MASK_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(RAIL_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(LOGISTICS_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(INVENTORY_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(MARKER_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addSource(ANNOTATION_SOURCE, { type: "geojson", data: emptyCollection() });

  map.addLayer({
    id: "atlas-region-mask",
    type: "fill",
    source: MASK_SOURCE,
    paint: {
      "fill-antialias": false,
      "fill-color": "#173a3c",
      "fill-opacity": 0.64,
    },
  });
  map.addLayer({
    id: "atlas-root-fill",
    type: "fill",
    source: ROOT_SOURCE,
    paint: { "fill-color": "#8ed0bd", "fill-opacity": 0.015 },
  });
  map.addLayer({
    id: "atlas-root-glow",
    type: "line",
    source: ROOT_SOURCE,
    paint: {
      "line-blur": 4,
      "line-color": "#9be3d9",
      "line-opacity": 0.55,
      "line-width": 8,
    },
  });
  map.addLayer({
    id: "atlas-root-outline",
    type: "line",
    source: ROOT_SOURCE,
    paint: {
      "line-color": "#fff1b8",
      "line-opacity": 0.98,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 10, 4.2],
    },
  });
  map.addLayer({
    id: "atlas-root-labels",
    type: "symbol",
    source: ROOT_LABEL_SOURCE,
    layout: {
      "text-allow-overlap": true,
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4, 17, 8, 22],
    },
    paint: {
      "text-color": "#fffdf3",
      "text-halo-color": "#102a28",
      "text-halo-width": 2.4,
    },
  });
  map.addLayer({
    id: "atlas-active-fill",
    type: "fill",
    source: ACTIVE_SOURCE,
    layout: { "fill-sort-key": ["get", "levelRank"] },
    paint: {
      "fill-color": ["case", ["==", ["get", "selected"], true], "#f6ca5c", "#8ed4bf"],
      "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.2, 0.06],
    },
  });
  map.addLayer({
    id: "atlas-active-outline",
    type: "line",
    source: ACTIVE_SOURCE,
    paint: {
      "line-color": ["case", ["==", ["get", "selected"], true], "#ffcf55", "#f7efd0"],
      "line-opacity": 0.96,
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.3, 13, 3.8],
    },
  });
  map.addLayer({
    id: "atlas-active-labels",
    type: "symbol",
    source: ACTIVE_LABEL_SOURCE,
    layout: {
      "text-allow-overlap": false,
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 6, 13, 13, 17],
    },
    paint: {
      "text-color": "#fffdf0",
      "text-halo-color": "#16302c",
      "text-halo-width": 2,
    },
  });
  map.addLayer({
    id: "atlas-rail-routes",
    type: "line",
    source: RAIL_SOURCE,
    paint: {
      "line-color": "#ffffff",
      "line-dasharray": [2, 2],
      "line-opacity": 0.88,
      "line-width": 1.8,
    },
  });
  map.addLayer({
    id: "atlas-logistics",
    type: "line",
    source: LOGISTICS_SOURCE,
    paint: {
      "line-color": "#f4b43f",
      "line-dasharray": [1.5, 1.3],
      "line-opacity": 0.96,
      "line-width": 3.2,
    },
  });
  map.addLayer({
    id: "atlas-inventory",
    type: "symbol",
    source: INVENTORY_SOURCE,
    layout: {
      "icon-allow-overlap": false,
      "icon-image": "atlas-icon-inventory",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.46, 12, 0.62],
    },
    paint: {
      "icon-opacity": 0.86,
    },
  });
  map.addLayer({
    id: "atlas-operational-markers",
    type: "symbol",
    source: MARKER_SOURCE,
    filter: ["in", ["get", "kind"], ["literal", FACILITY_KINDS]],
    layout: {
      "icon-allow-overlap": false,
      "icon-image": [
        "match",
        ["get", "kind"],
        "OWNED",
        "atlas-icon-depot-owned",
        "LEASED",
        "atlas-icon-depot-leased",
        "HISTORICAL_LEASED",
        "atlas-icon-depot-historical",
        "atlas-icon-railway",
      ],
      "icon-size": [
        "case",
        ["==", ["get", "selected"], true],
        0.68,
        ["interpolate", ["linear"], ["zoom"], 5, 0.58, 12, 0.74],
      ],
    },
    paint: {
      "icon-opacity": 0.98,
    },
  });
  map.addLayer({
    id: "atlas-weather-pulse",
    type: "circle",
    source: MARKER_SOURCE,
    filter: [
      "all",
      ["==", ["get", "kind"], "WEATHER"],
      ["in", ["get", "weatherKind"], ["literal", ["CLOUD", "RAIN", "STORM"]]],
    ],
    paint: {
      "circle-blur": 0.5,
      "circle-color": [
        "match",
        ["get", "weatherKind"],
        "STORM",
        "#d7a7ff",
        "RAIN",
        "#7ed8ff",
        "#dce9ef",
      ],
      "circle-opacity": 0.3,
      "circle-radius": 14,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 0.34,
      "circle-stroke-width": 1.5,
    },
  });
  map.addLayer({
    id: "atlas-weather-markers",
    type: "symbol",
    source: MARKER_SOURCE,
    filter: ["==", ["get", "kind"], "WEATHER"],
    layout: {
      "icon-allow-overlap": true,
      "icon-image": [
        "match",
        ["get", "weatherKind"],
        "CLOUD",
        "atlas-icon-weather-cloud",
        "RAIN",
        "atlas-icon-weather-rain",
        "SNOW",
        "atlas-icon-weather-snow",
        "STORM",
        "atlas-icon-weather-storm",
        "atlas-icon-weather-clear",
      ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.58, 12, 0.76],
    },
    paint: {
      "icon-opacity": 0.98,
    },
  });
  map.addLayer({
    id: "atlas-marker-labels",
    type: "symbol",
    source: MARKER_SOURCE,
    minzoom: 9,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-offset": [0, 1.2],
      "text-size": 11,
    },
    paint: {
      "text-color": "#fffdf0",
      "text-halo-color": "#17312f",
      "text-halo-width": 1.4,
    },
  });
  map.addLayer({
    id: "atlas-annotation-fill",
    type: "fill",
    source: ANNOTATION_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#ffd45f", "fill-opacity": 0.22 },
  });
  map.addLayer({
    id: "atlas-annotation-line",
    type: "line",
    source: ANNOTATION_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#ffe796", "line-width": 3 },
  });
  map.addLayer({
    id: "atlas-annotation-point",
    type: "circle",
    source: ANNOTATION_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": "#ffd45f",
      "circle-radius": 7,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
    },
  });
}

function synchronizeAtlas(runtime: AtlasRuntime, props: FourRegionTerrainAtlasProps) {
  const previous = runtime.syncedProps;
  runtime.props = props;
  const rootsChanged = !previous || previous.rootFeatures !== props.rootFeatures;
  const hierarchyChanged =
    rootsChanged ||
    !previous ||
    previous.features !== props.features ||
    previous.backdrop !== props.backdrop;
  const selectionChanged =
    !previous || previous.selectedRegionCode !== props.selectedRegionCode;
  if (rootsChanged || selectionChanged) {
    setSource(runtime.map, ROOT_SOURCE, regionCollection(props.rootFeatures, props));
  }
  if (rootsChanged) {
    setSource(
      runtime.map,
      ROOT_LABEL_SOURCE,
      regionLabelCollection(props.rootFeatures),
    );
    setSource(runtime.map, MASK_SOURCE, fourRegionMaskCollection(props.rootFeatures));
  }
  const active = activeHierarchyFeatures(props);
  if (hierarchyChanged || selectionChanged) {
    setSource(runtime.map, ACTIVE_SOURCE, regionCollection(active, props));
    setSource(runtime.map, ACTIVE_LABEL_SOURCE, regionLabelCollection(active));
  }
  if (
    !previous ||
    previous.facilities !== props.facilities ||
    previous.situation !== props.situation ||
    previous.layers !== props.layers ||
    previous.selectedFacilityId !== props.selectedFacilityId
  ) {
    setSource(runtime.map, RAIL_SOURCE, railwayCollection(props));
    setSource(runtime.map, LOGISTICS_SOURCE, logisticsCollection(props));
    setSource(runtime.map, INVENTORY_SOURCE, inventoryCollection(props));
    setSource(runtime.map, MARKER_SOURCE, markerCollection(props));
  }
  if (
    !previous ||
    previous.annotation !== props.annotation ||
    previous.annotationDraft !== props.annotationDraft
  )
    setSource(runtime.map, ANNOTATION_SOURCE, annotationCollection(props));
  if (!previous || previous.surfaceMode !== props.surfaceMode)
    applySurfaceMode(runtime.map, props.surfaceMode ?? "FUSION");
  if (!previous || previous.layers.ADMINISTRATIVE !== props.layers.ADMINISTRATIVE)
    setAdministrativeVisibility(runtime.map, props.layers.ADMINISTRATIVE);

  const nextHierarchyKey = hierarchyKey(props, active);
  if (nextHierarchyKey !== runtime.hierarchyKey) {
    runtime.hierarchyKey = nextHierarchyKey;
    fitCurrentHierarchy(runtime, props, active);
  }
  runtime.host.dataset.annotationActive = String(Boolean(props.annotationActive));
  runtime.host.dataset.rootRegionCount = String(props.rootFeatures.length);
  runtime.host.dataset.activeRegionCount = String(active.length);
  runtime.host.dataset.featureCount = String(props.rootFeatures.length + active.length);
  runtime.host.dataset.detailLevel = active[0]?.region.level ?? "PREFECTURE";
  runtime.host.dataset.billboardCount = String(markerCollection(props).features.length);
  runtime.host.dataset.facilityIconCount = String(
    props.facilities.storageFacilities.length +
      props.facilities.railwayFacilities.length,
  );
  runtime.host.dataset.weatherIconCount = String(
    props.layers.WEATHER ? props.situation.weather.length : 0,
  );
  runtime.syncedProps = props;
}

function activeHierarchyFeatures(props: FourRegionTerrainAtlasProps) {
  const contextCode = props.backdrop?.region.code;
  if (!contextCode) return [];
  const rootCodes = new Set(props.rootFeatures.map((feature) => feature.region.code));
  return props.features.filter(
    (feature) =>
      !rootCodes.has(feature.region.code) &&
      feature.region.parentCode === contextCode &&
      !feature.region.mapContextOnly,
  );
}

function fitCurrentHierarchy(
  runtime: AtlasRuntime,
  props: FourRegionTerrainAtlasProps,
  active: readonly MapFeature[],
) {
  const focusFeatures = active.length
    ? props.backdrop
      ? [props.backdrop]
      : active
    : props.rootFeatures;
  const bounds = featureBounds(focusFeatures) ?? props.bounds;
  const rootView = active.length === 0;
  const padding = calculateOperationalMapPadding(runtime.host, rootView ? 104 : 116);
  fitOperationalMap(
    runtime.map,
    toMapBounds(bounds),
    padding,
    rootView ? 45 : 50,
    rootView ? 0.12 : 0,
  );
  runtime.host.dataset.imageryZoom = runtime.map.getZoom().toFixed(2);
}

function scheduleAtlasResize(runtime: AtlasRuntime) {
  if (runtime.resizeAnimationFrameId !== undefined)
    cancelAnimationFrame(runtime.resizeAnimationFrameId);
  runtime.resizeAnimationFrameId = requestAnimationFrame(() => {
    delete runtime.resizeAnimationFrameId;
    if (runtime.destroyed) return;
    const viewportWidth = runtime.host.clientWidth;
    const viewportHeight = runtime.host.clientHeight;
    const viewportChanged =
      Math.abs(viewportWidth - runtime.viewportWidth) > 1 ||
      Math.abs(viewportHeight - runtime.viewportHeight) > 1;
    runtime.viewportWidth = viewportWidth;
    runtime.viewportHeight = viewportHeight;
    runtime.host.dataset.viewportWidth = String(viewportWidth);
    runtime.host.dataset.viewportHeight = String(viewportHeight);
    runtime.map.resize();
    if (runtime.ready && viewportChanged)
      fitCurrentHierarchy(
        runtime,
        runtime.props,
        activeHierarchyFeatures(runtime.props),
      );
  });
}

function handleMapClick(runtime: AtlasRuntime, event: MapMouseEvent) {
  const { map, props } = runtime;
  if (props.annotationActive) {
    if (insideBounds(event.lngLat.lng, event.lngLat.lat, props.bounds))
      props.onAnnotationPosition?.(event.lngLat.lng, event.lngLat.lat);
    return;
  }
  const facility = map
    .queryRenderedFeatures(event.point, { layers: ["atlas-operational-markers"] })
    .find((feature) => featureStringProperty(feature, "id"));
  const facilityId = facility ? featureStringProperty(facility, "id") : undefined;
  if (facilityId) {
    props.onFacilitySelect(facilityId);
    return;
  }
  const weather = map
    .queryRenderedFeatures(event.point, { layers: ["atlas-weather-markers"] })
    .find((feature) => featureStringProperty(feature, "regionCode"));
  const weatherRegionCode = weather
    ? featureStringProperty(weather, "regionCode")
    : undefined;
  if (weatherRegionCode) {
    const region = regionByCode(props).get(weatherRegionCode);
    if (region) props.onRegionSelect(region);
    return;
  }
  const rendered = map.queryRenderedFeatures(event.point, {
    layers: [...REGION_LAYER_IDS],
  });
  const hit =
    rendered.find((feature) => feature.layer.id === "atlas-active-fill") ??
    rendered.find((feature) => feature.layer.id === "atlas-root-fill");
  const code = hit ? featureStringProperty(hit, "code") : undefined;
  const region = code ? regionByCode(props).get(code) : undefined;
  if (!region) return;
  props.onRegionSelect(region);
  if (region.level !== "VILLAGE") props.onRegionDrill(region);
}

function applyCommand(runtime: AtlasRuntime, command: RealisticSceneCommand) {
  const { map } = runtime;
  if (command.type === "ZOOM_IN") map.zoomIn({ duration: 220 });
  if (command.type === "ZOOM_OUT") map.zoomOut({ duration: 220 });
  if (command.type === "RESET") {
    runtime.hierarchyKey = "";
    fitCurrentHierarchy(runtime, runtime.props, activeHierarchyFeatures(runtime.props));
  }
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
  if (map.getSource("terrain-dem"))
    map.setTerrain({ source: "terrain-dem", exaggeration: paint.terrainExaggeration });
  map.getContainer().dataset.surfaceMode = mode.toLowerCase();
  map.getContainer().dataset.terrainExaggeration = String(paint.terrainExaggeration);
}

function setAdministrativeVisibility(map: MapLibreMap, visible: boolean) {
  [
    "atlas-root-glow",
    "atlas-root-outline",
    "atlas-root-labels",
    "atlas-active-fill",
    "atlas-active-outline",
    "atlas-active-labels",
  ].forEach((id) =>
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none"),
  );
}

function regionCollection(
  features: readonly MapFeature[],
  props: FourRegionTerrainAtlasProps,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      properties: {
        code: feature.region.code,
        level: feature.region.level,
        levelRank: regionLevelRank(feature.region.level),
        name: feature.region.name,
        selected: feature.region.code === props.selectedRegionCode,
      },
      geometry: feature.geometry as unknown as GeoJsonPolygon | GeoJsonMultiPolygon,
    })),
  };
}

function regionLabelCollection(features: readonly MapFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.flatMap((feature) => {
      const position = regionLabelPosition(feature);
      return position
        ? [
            pointFeature(position[0], position[1], {
              code: feature.region.code,
              name: feature.region.name,
            }),
          ]
        : [];
    }),
  };
}

function regionLabelPosition(
  feature: MapFeature,
): readonly [number, number] | undefined {
  if (feature.region.locationGeoJson) {
    try {
      const location = JSON.parse(feature.region.locationGeoJson) as {
        coordinates?: unknown;
        type?: string;
      };
      if (
        location.type === "Point" &&
        Array.isArray(location.coordinates) &&
        typeof location.coordinates[0] === "number" &&
        typeof location.coordinates[1] === "number"
      )
        return [location.coordinates[0], location.coordinates[1]];
    } catch {
      // Fall back to the governed boundary centre when a location is malformed.
    }
  }
  const bounds = featureBounds([feature]);
  return bounds ? centerOf(bounds) : undefined;
}

function fourRegionMaskCollection(
  rootFeatures: readonly MapFeature[],
): FeatureCollection {
  const holes = rootFeatures.flatMap((feature) =>
    outerRings(feature).map(clockwiseRing),
  );
  const world: GeoJsonPosition[] = [
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
        properties: { kind: "outside-four-regions" },
        geometry: { type: "Polygon", coordinates: [world, ...holes] },
      },
    ],
  };
}

function outerRings(feature: MapFeature): GeoJsonPosition[][] {
  const mutableRing = (ring: readonly (readonly [number, number])[]) =>
    ring.map(([longitude, latitude]) => [longitude, latitude]);
  if (feature.geometry.type === "Polygon") {
    const polygon = feature.geometry.coordinates as readonly (readonly (readonly [
      number,
      number,
    ])[])[];
    return [mutableRing(polygon[0] ?? [])];
  }
  const polygons = feature.geometry
    .coordinates as readonly (readonly (readonly (readonly [number, number])[])[])[];
  return polygons.map((polygon) => mutableRing(polygon[0] ?? []));
}

function clockwiseRing(ring: GeoJsonPosition[]) {
  return signedRingArea(ring) > 0 ? [...ring].reverse() : ring;
}

function signedRingArea(ring: readonly GeoJsonPosition[]) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    if (!current || !next) continue;
    area += current[0]! * next[1]! - next[0]! * current[1]!;
  }
  return area / 2;
}

function railwayCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  if (!props.layers.RAILWAY_ROUTE) return emptyCollection();
  const features: Feature[] = [];
  props.facilities.railwayRoutes.forEach((route) => {
    try {
      const geometry = JSON.parse(route.geometryGeoJson) as GeoJsonGeometry;
      if (geometry.type === "LineString" || geometry.type === "MultiLineString")
        features.push({ type: "Feature", properties: { id: route.id }, geometry });
    } catch {
      // Invalid public reference geometry remains hidden.
    }
  });
  return { type: "FeatureCollection", features };
}

function logisticsCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  if (!props.layers.LOGISTICS) return emptyCollection();
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
  if (!props.layers.INVENTORY) return emptyCollection();
  return {
    type: "FeatureCollection",
    features: (props.situation.inventories ?? []).map((inventory) =>
      pointFeature(inventory.longitude, inventory.latitude, {
        regionCode: inventory.regionCode,
      }),
    ),
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
          id: weather.regionCode ?? weather.rootRegionCode,
          kind: "WEATHER",
          name: weather.regionName,
          regionCode: weather.regionCode ?? weather.rootRegionCode,
          weatherKind: liveWeatherKind(weather),
        }),
      );
    });
  }
  return { type: "FeatureCollection", features };
}

function startWeatherAnimation(runtime: AtlasRuntime) {
  const animate = (timestamp: number) => {
    if (runtime.destroyed) return;
    if (
      timestamp - runtime.weatherAnimationUpdatedAt >= 90 &&
      runtime.map.getLayer("atlas-weather-pulse")
    ) {
      const phase = (Math.sin(timestamp / 520) + 1) / 2;
      runtime.map.setPaintProperty(
        "atlas-weather-pulse",
        "circle-radius",
        12 + phase * 8,
      );
      runtime.map.setPaintProperty(
        "atlas-weather-pulse",
        "circle-opacity",
        0.12 + phase * 0.24,
      );
      runtime.weatherAnimationUpdatedAt = timestamp;
      runtime.host.dataset.weatherAnimation = "active";
    }
    runtime.weatherAnimationFrameId = requestAnimationFrame(animate);
  };
  runtime.weatherAnimationFrameId = requestAnimationFrame(animate);
}

function annotationCollection(props: FourRegionTerrainAtlasProps): FeatureCollection {
  const features: Feature[] = [];
  const annotation = props.annotation;
  if (annotation?.type === "POINT")
    features.push(
      pointFeature(annotation.minLongitude, annotation.minLatitude, { state: "saved" }),
    );
  if (annotation?.type === "RECTANGLE") {
    features.push({
      type: "Feature",
      properties: { state: "saved" },
      geometry: { type: "Polygon", coordinates: [rectangleRing(annotation)] },
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

function rectangleRing(annotation: MapAnnotation): GeoJsonPosition[] {
  return [
    [annotation.minLongitude, annotation.minLatitude],
    [annotation.maxLongitude, annotation.minLatitude],
    [annotation.maxLongitude, annotation.maxLatitude],
    [annotation.minLongitude, annotation.maxLatitude],
    [annotation.minLongitude, annotation.minLatitude],
  ];
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

function featureBounds(features: readonly MapFeature[]) {
  const coordinates = features.flatMap((feature) =>
    flattenCoordinates(feature.geometry),
  );
  if (!coordinates.length) return undefined;
  return {
    maxLatitude: Math.max(...coordinates.map(([, latitude]) => latitude)),
    maxLongitude: Math.max(...coordinates.map(([longitude]) => longitude)),
    minLatitude: Math.min(...coordinates.map(([, latitude]) => latitude)),
    minLongitude: Math.min(...coordinates.map(([longitude]) => longitude)),
  } satisfies GeographicBounds;
}

function regionByCode(props: FourRegionTerrainAtlasProps) {
  return new Map(
    [...props.rootFeatures, ...activeHierarchyFeatures(props)].map((feature) => [
      feature.region.code,
      feature.region,
    ]),
  );
}

function setSource(map: MapLibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) void source.setData(data);
}

function featureStringProperty(feature: MapGeoJSONFeature, key: string) {
  const value: unknown = feature.properties?.[key];
  return typeof value === "string" ? value : undefined;
}

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function toMapBounds(bounds: GeographicBounds): [[number, number], [number, number]] {
  return [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ];
}

function centerOf(bounds: GeographicBounds): [number, number] {
  return [
    (bounds.minLongitude + bounds.maxLongitude) / 2,
    (bounds.minLatitude + bounds.maxLatitude) / 2,
  ];
}

function hierarchyKey(
  props: FourRegionTerrainAtlasProps,
  active: readonly MapFeature[],
) {
  return [
    props.backdrop?.region.code ?? "ROOT",
    ...active.map((feature) => feature.region.code),
  ].join(":");
}

function regionLevelRank(level: OverviewRegion["level"]) {
  if (level === "VILLAGE") return 4;
  if (level === "TOWNSHIP") return 3;
  if (level === "COUNTY") return 2;
  return 1;
}

function detailLevel(zoom: number): OverviewRegion["level"] {
  if (zoom >= 13) return "VILLAGE";
  if (zoom >= 10) return "TOWNSHIP";
  if (zoom >= 7) return "COUNTY";
  return "PREFECTURE";
}

function insideBounds(longitude: number, latitude: number, bounds: GeographicBounds) {
  return (
    longitude >= bounds.minLongitude &&
    longitude <= bounds.maxLongitude &&
    latitude >= bounds.minLatitude &&
    latitude <= bounds.maxLatitude
  );
}
