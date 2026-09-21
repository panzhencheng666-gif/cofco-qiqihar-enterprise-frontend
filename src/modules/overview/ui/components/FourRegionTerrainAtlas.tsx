import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
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
  setWorkerUrl,
  addProtocol,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";

// The engine's dynamic import.meta.url worker lookup cannot survive bundling.
// Emit the worker explicitly so GeoJSON, terrain and symbols work in production.
setWorkerUrl(mapWorkerUrl);

import type { MapAnnotation } from "../../application/ports/MapAnnotationRepository";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import { flattenCoordinates, type MapFeature } from "./boundaryGeometry";
import {
  FACILITY_ICON_SIZE,
  FOUR_REGION_BASE_STYLE,
  FOUR_REGION_DETAIL_LAYERS,
  FOUR_REGION_REMOTE_SOURCES,
  publicBoundaryHierarchy,
  surfaceModePaint,
  type TerrainSurfaceMode,
} from "./fourRegionTerrainStyle";
import { calculateOperationalMapPadding } from "./operationalMapViewport";
import type { GeographicBounds } from "./realisticSituationModel";
import {
  loadSvgMarkerImage,
  realisticSituationIcon,
  realisticWeatherIcon,
} from "./realisticSituationIcons";
import { weatherObservationFresh } from "./liveWeatherPresentation";
import { weatherSpriteKind, type WeatherSpriteKind } from "./weatherSpriteKind";
import { createWeatherSpritePainter } from "./animatedWeatherSprite";
import { publicMapFocus } from "./publicMapFocus";
import { mapAnnotationGesture } from "./mapAnnotationGesture";
import {
  enhancementTimeoutMs,
  isRemoteEnhancementId,
  nextEnhancementStatus,
  REMOTE_ENHANCEMENT_IDS,
  type RemoteEnhancementId,
  type RemoteEnhancementStatus,
} from "./remoteMapEnhancement";
import { createTerrainTileCache } from "./terrainTileCache";
import {
  fourRegionContextMaskCollection,
  railwayMarkerPresentation,
  settledMarkerImages,
  terrainEnhancementStateAfterInitialIdle,
  terrainEnhancementStateForFailures,
  terrainEnhancementStateForSource,
  type TerrainEnhancementFailure,
  type TerrainEnhancementState,
} from "./fourRegionTerrainModel";

export type { TerrainEnhancementState } from "./fourRegionTerrainModel";

const loadTerrainTile = createTerrainTileCache();
addProtocol("cofco-terrain", async (request, controller) => {
  const tile = /^cofco-terrain:\/\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(request.url);
  if (
    !tile ||
    Number(tile[1]) > 15 ||
    Number(tile[2]) >= 2 ** Number(tile[1]) ||
    Number(tile[3]) >= 2 ** Number(tile[1])
  )
    throw new Error("Invalid terrain tile");
  controller.signal.throwIfAborted();
  const data = await loadTerrainTile(
    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile[1]}/${tile[2]}/${tile[3]}.png`,
  );
  controller.signal.throwIfAborted();
  return { data };
});

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

export interface FourRegionTerrainAtlasProps {
  annotation?: MapAnnotation;
  annotationActive?: boolean;
  annotationDraft?: readonly [number, number];
  backdrop?: MapFeature;
  bounds: GeographicBounds;
  command?: RealisticSceneCommand;
  focusRequest?: { id: number; region: OverviewRegion };
  facilities: OperationalFacilityCatalogue;
  features: readonly MapFeature[];
  rootFeatures: readonly MapFeature[];
  layers: RealisticSceneLayers;
  onFacilitySelect: (id: string) => void;
  onEnhancementState?: (state: TerrainEnhancementState) => void;
  onAnnotationPosition?: (longitude: number, latitude: number) => void;
  onAnnotationRectangle?: (
    start: readonly [number, number],
    end: readonly [number, number],
  ) => void;
  onReady?: () => void;
  onRegionDrill: (region: OverviewRegion) => void;
  onRegionSelect: (region: OverviewRegion) => void;
  onWeatherSelect?: (regionCode: string) => void;
  selectedFacilityId?: string;
  selectedRegionCode?: string;
  situation: OperationalSituationCatalogue;
  weatherHistorical?: boolean;
  surfaceMode?: TerrainSurfaceMode;
}

interface AtlasRuntime {
  destroyed: boolean;
  enhancementFailures: Set<TerrainEnhancementFailure>;
  enhancementTimers: Map<RemoteEnhancementId, ReturnType<typeof setTimeout>>;
  hierarchyKey: string;
  host: HTMLDivElement;
  map: MapLibreMap;
  props: FourRegionTerrainAtlasProps;
  ready: boolean;
  remoteEnhancementStatus: RemoteEnhancementStatus;
  fittedCenter?: [number, number];
  resizeAnimationFrameId?: number;
  syncedProps?: FourRegionTerrainAtlasProps;
  viewportHeight: number;
  viewportWidth: number;
  weatherAnimationFrameId?: number;
  weatherAnimationUpdatedAt: number;
  suppressClickUntil?: number;
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
        dragPan: true,
        fadeDuration: 0,
        localIdeographFontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        maxPitch: 68,
        minPitch: 34,
        pitch: 52,
        renderWorldCopies: false,
        refreshExpiredTiles: false,
        style: FOUR_REGION_BASE_STYLE,
      });
    } catch {
      propsRef.current.onEnhancementState?.("DEGRADED_RENDERER");
      return;
    }
    map.doubleClickZoom.disable();
    map.keyboard.disable();
    map.touchPitch.disable();
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.disableRotation();
    const runtime: AtlasRuntime = {
      destroyed: false,
      enhancementFailures: new Set(),
      enhancementTimers: new Map(),
      hierarchyKey: "",
      host,
      map,
      props: propsRef.current,
      ready: false,
      remoteEnhancementStatus: {
        failed: new Set(),
        pending: new Set(REMOTE_ENHANCEMENT_IDS),
      },
      viewportHeight: 0,
      viewportWidth: 0,
      weatherAnimationUpdatedAt: 0,
    };
    runtimeRef.current = runtime;
    const releaseAnnotationGestures = installAnnotationGestures(runtime);
    host.dataset.sceneState = "loading";
    host.dataset.viewerCount = "1";
    host.dataset.createdViewerCount = "1";
    host.dataset.imageryMode = "multiresolution-tile-pyramid";
    host.dataset.enhancementState = "loading";
    propsRef.current.onEnhancementState?.("LOADING");

    map.on("load", () => void initializeAtlas(runtime));
    map.on("error", (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      if (!isRemoteEnhancementId(sourceId)) return;
      updateRemoteEnhancement(runtime, sourceId, "FAILED");
    });
    map.on("sourcedata", (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      if (!isRemoteEnhancementId(sourceId)) return;
      try {
        if (map.getSource(sourceId) && map.isSourceLoaded(sourceId))
          updateRemoteEnhancement(runtime, sourceId, "READY");
      } catch {
        // A transient source inspection failure is handled by its deadline.
      }
    });
    map.on("click", (event) => handleMapClick(runtime, event));
    map.on("mousemove", (event) => {
      if (!runtime.ready) return;
      const interactive = map.queryRenderedFeatures(event.point, {
        layers: [
          "atlas-active-labels",
          "atlas-root-labels",
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
      releaseAnnotationGestures();
      if (runtime.resizeAnimationFrameId !== undefined)
        cancelAnimationFrame(runtime.resizeAnimationFrameId);
      if (runtime.weatherAnimationFrameId !== undefined)
        cancelAnimationFrame(runtime.weatherAnimationFrameId);
      runtime.enhancementTimers.forEach((timer) => clearTimeout(timer));
      runtime.enhancementTimers.clear();
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
  startRemoteEnhancementDeadlines(runtime);
  const markerImagesDegraded = await installAtlasMarkerImages(map);
  if (runtime.destroyed) return;
  if (markerImagesDegraded) {
    reportEnhancementFailure(runtime, "DEGRADED_ICONS");
  }
  installAtlasLayers(map);
  runtime.ready = true;
  host.dataset.sceneState = "local-ready";
  synchronizeAtlas(runtime, runtime.props);
  startWeatherAnimation(runtime);
  runtime.props.onReady?.();
  map.once("idle", () => {
    if (runtime.destroyed) return;
    const state = terrainEnhancementStateAfterInitialIdle(runtime.enhancementFailures);
    host.dataset.enhancementState = state.toLowerCase();
    runtime.props.onEnhancementState?.(state);
  });
}

function reportEnhancementFailure(
  runtime: AtlasRuntime,
  failure: TerrainEnhancementFailure,
) {
  runtime.enhancementFailures.add(failure);
  const state = terrainEnhancementStateForFailures(runtime.enhancementFailures);
  if (!state) return;
  runtime.host.dataset.enhancementState = state.toLowerCase();
  runtime.props.onEnhancementState?.(state);
}

function startRemoteEnhancementDeadlines(runtime: AtlasRuntime) {
  REMOTE_ENHANCEMENT_IDS.forEach((id) => {
    const previous = runtime.enhancementTimers.get(id);
    if (previous !== undefined) clearTimeout(previous);
    runtime.enhancementTimers.set(
      id,
      setTimeout(
        () => updateRemoteEnhancement(runtime, id, "FAILED"),
        enhancementTimeoutMs(id),
      ),
    );
  });
}

function updateRemoteEnhancement(
  runtime: AtlasRuntime,
  id: RemoteEnhancementId,
  type: "FAILED" | "READY",
) {
  if (runtime.destroyed) return;
  const timer = runtime.enhancementTimers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  runtime.enhancementTimers.delete(id);
  runtime.remoteEnhancementStatus = nextEnhancementStatus(
    runtime.remoteEnhancementStatus,
    { id, type },
  );
  setRemoteEnhancementVisibility(runtime, id, type === "READY");

  const failure = terrainEnhancementStateForSource(id);
  if (failure) {
    if (type === "FAILED") runtime.enhancementFailures.add(failure);
    else {
      const equivalentSourceStillFailed = [
        ...runtime.remoteEnhancementStatus.failed,
      ].some((failedId) => terrainEnhancementStateForSource(failedId) === failure);
      if (!equivalentSourceStillFailed) runtime.enhancementFailures.delete(failure);
    }
  }
  const state =
    terrainEnhancementStateForFailures(runtime.enhancementFailures) ??
    (runtime.remoteEnhancementStatus.pending.size ? "LOADING" : "READY");
  runtime.host.dataset.enhancementState = state.toLowerCase();
  runtime.props.onEnhancementState?.(state);
}

function setRemoteEnhancementVisibility(
  runtime: AtlasRuntime,
  id: RemoteEnhancementId,
  visible: boolean,
) {
  const { map } = runtime;
  FOUR_REGION_DETAIL_LAYERS.forEach((layer) => {
    if ((layer as { source?: string }).source !== id || !map.getLayer(layer.id)) return;
    map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
  });
  if (id !== "terrain-dem") return;
  if (!visible) map.setTerrain(null);
  else if (runtime.ready) applySurfaceMode(map, runtime.props.surfaceMode ?? "FUSION");
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
  const settled = await Promise.allSettled(
    sources.map(
      async ([id, source]) => [id, await loadSvgMarkerImage(source)] as const,
    ),
  );
  const { images, hasFailures: loadFailures } = settledMarkerImages(settled);
  let hasFailures = loadFailures;
  images.forEach(([id, image]) => {
    try {
      if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
    } catch {
      hasFailures = true;
    }
  });
  return hasFailures;
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
  const background = document.createElement("canvas");
  background.width = background.height = 128;
  const context = background.getContext("2d");
  if (context) {
    context.fillStyle = "#202722";
    context.fillRect(0, 0, 128, 128);
    // Quiet, non-geographic matte texture; no grid, stars or outside imagery.
    for (let y = 0; y < 128; y += 2)
      for (let x = 0; x < 128; x += 2) {
        context.fillStyle = `rgba(176,169,143,${((x * 17 + y * 31) % 13) / 180})`;
        context.fillRect(x, y, 1, 1);
      }
    map.addImage("atlas-survey-background", context.getImageData(0, 0, 128, 128));
  }
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
    filter: ["==", ["get", "kind"], "outside-four-region-context"],
    paint: {
      "fill-antialias": false,
      "fill-color": "#202722",
      "fill-opacity": 1,
      ...(context ? { "fill-pattern": "atlas-survey-background" } : {}),
    },
  });
  map.addLayer({
    id: "atlas-region-context",
    type: "fill",
    source: MASK_SOURCE,
    filter: ["==", ["get", "kind"], "four-region-context-ring"],
    paint: {
      "fill-antialias": false,
      "fill-color": "#202722",
      "fill-opacity": 0.58,
      ...(context ? { "fill-pattern": "atlas-survey-background" } : {}),
    },
  });
  map.addLayer({
    id: "atlas-root-fill",
    type: "fill",
    source: ROOT_SOURCE,
    paint: { "fill-color": "#8ed0bd", "fill-opacity": 0 },
  });
  map.addLayer({
    id: "atlas-root-glow",
    type: "line",
    source: ROOT_SOURCE,
    paint: {
      "line-blur": 2,
      "line-color": "#9be3d9",
      "line-opacity": 0,
      "line-width": 3,
    },
  });
  map.addLayer({
    id: "atlas-root-outline",
    type: "line",
    source: ROOT_SOURCE,
    paint: {
      "line-color": "#9ef6ff",
      "line-opacity": 0,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 1.6],
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
    filter: ["!=", ["get", "level"], "VILLAGE"],
    layout: { "fill-sort-key": ["get", "levelRank"] },
    paint: {
      "fill-color": ["case", ["==", ["get", "selected"], true], "#f6ca5c", "#8ed4bf"],
      "fill-opacity": 0,
    },
  });
  map.addLayer({
    id: "atlas-active-outline",
    type: "line",
    source: ACTIVE_SOURCE,
    filter: ["!=", ["get", "level"], "VILLAGE"],
    paint: {
      "line-color": [
        "match",
        ["get", "level"],
        "COUNTY",
        "#b7a5ff",
        "TOWNSHIP",
        "#f4a9e2",
        "VILLAGE",
        "#80f7ce",
        "#9ef6ff",
      ],
      "line-opacity": 0,
      "line-width": ["case", ["==", ["get", "selected"], true], 1.5, 0.85],
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
      "line-color": "#d9e4df",
      "line-dasharray": [3, 3],
      "line-opacity": 0.68,
      "line-width": 1,
    },
  });
  map.addLayer({
    id: "atlas-logistics",
    type: "line",
    source: LOGISTICS_SOURCE,
    paint: {
      "line-color": "#f4b43f",
      "line-dasharray": [1.5, 1.3],
      "line-opacity": 0.7,
      "line-width": 1.4,
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
    id: "atlas-selected-facility-halo",
    type: "circle",
    source: MARKER_SOURCE,
    filter: [
      "all",
      ["in", ["get", "kind"], ["literal", FACILITY_KINDS]],
      ["==", ["get", "selected"], true],
    ],
    paint: {
      "circle-color": "rgba(255,212,95,0.18)",
      "circle-radius": [
        "interpolate",
        ["exponential", 1.45],
        ["zoom"],
        4,
        4,
        8,
        8,
        12,
        18,
        16,
        45,
        20,
        78,
        22,
        96,
      ],
      "circle-stroke-color": "#ffd45f",
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        0.7,
        12,
        2,
        18,
        3,
        22,
        4,
      ],
    },
  });
  map.addLayer({
    id: "atlas-nearby-railway-halo",
    type: "circle",
    source: MARKER_SOURCE,
    filter: [
      "all",
      ["==", ["get", "kind"], "RAILWAY"],
      ["==", ["get", "nearby"], true],
    ],
    paint: {
      "circle-color": "#342d22",
      "circle-opacity": 0.34,
      "circle-radius": [
        "interpolate",
        ["exponential", 1.45],
        ["zoom"],
        4,
        4,
        8,
        7,
        12,
        17,
        16,
        42,
        20,
        74,
        22,
        92,
      ],
      "circle-stroke-color": "#f0c96c",
      "circle-stroke-opacity": 0.92,
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        0.7,
        12,
        2,
        18,
        3,
        22,
        4,
      ],
    },
  });
  map.addLayer({
    id: "atlas-operational-markers",
    type: "symbol",
    source: MARKER_SOURCE,
    filter: ["in", ["get", "kind"], ["literal", FACILITY_KINDS]],
    layout: {
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
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
      "icon-size": FACILITY_ICON_SIZE,
    },
    paint: {
      "icon-opacity": ["case", ["==", ["get", "nearby"], true], 0.68, 0.98],
    },
  });
  map.addLayer({
    id: "atlas-weather-pulse",
    type: "circle",
    source: MARKER_SOURCE,
    filter: [
      "all",
      ["==", ["get", "kind"], "WEATHER"],
      ["==", ["get", "weatherFresh"], true],
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
      "icon-image": ["get", "weatherImage"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.85, 12, 1.1],
    },
    paint: {
      "icon-opacity": ["case", ["==", ["get", "weatherFresh"], true], 0.98, 0.55],
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
    setSource(
      runtime.map,
      MASK_SOURCE,
      fourRegionContextMaskCollection(props.rootFeatures),
    );
  }
  const active = activeHierarchyFeatures(props);
  if (hierarchyChanged || selectionChanged) {
    // Keep only the current children plus the selected parent outline, never
    // accumulate earlier levels or use unverified village display partitions.
    const outlined =
      active.length && props.backdrop ? [props.backdrop, ...active] : active;
    setSource(runtime.map, ACTIVE_SOURCE, regionCollection(outlined, props));
    setSource(runtime.map, ACTIVE_LABEL_SOURCE, regionLabelCollection(active));
  }
  if (
    !previous ||
    previous.facilities !== props.facilities ||
    previous.situation !== props.situation ||
    previous.layers !== props.layers ||
    previous.selectedFacilityId !== props.selectedFacilityId ||
    previous.weatherHistorical !== props.weatherHistorical
  ) {
    setSource(runtime.map, RAIL_SOURCE, railwayCollection(props));
    setSource(runtime.map, LOGISTICS_SOURCE, logisticsCollection(props));
    setSource(runtime.map, INVENTORY_SOURCE, inventoryCollection(props));
    refreshOperationalMarkerSources(runtime);
    runtime.map.setLayoutProperty(
      "atlas-base-railways",
      "visibility",
      props.layers.RAILWAY_ROUTE ? "visible" : "none",
    );
  }
  if (
    !previous ||
    previous.annotation !== props.annotation ||
    previous.annotationDraft !== props.annotationDraft
  )
    setSource(runtime.map, ANNOTATION_SOURCE, annotationCollection(props));
  if (!previous || previous.surfaceMode !== props.surfaceMode)
    applySurfaceMode(runtime.map, props.surfaceMode ?? "FUSION");
  if (
    !previous ||
    hierarchyChanged ||
    selectionChanged ||
    previous.focusRequest !== props.focusRequest ||
    previous.layers.ADMINISTRATIVE !== props.layers.ADMINISTRATIVE
  ) {
    setAdministrativeVisibility(runtime.map, props.layers.ADMINISTRATIVE);
    const emphasis = publicBoundaryHierarchy(active.length > 0);
    runtime.map.setPaintProperty(
      "atlas-root-outline",
      "line-opacity",
      emphasis.rootOpacity,
    );
    runtime.map.setPaintProperty(
      "atlas-active-outline",
      "line-opacity",
      emphasis.activeOpacity,
    );
    runtime.map.setLayoutProperty(
      "atlas-root-labels",
      "visibility",
      props.layers.ADMINISTRATIVE && !props.focusRequest ? emphasis.rootLabels : "none",
    );
    // Remove matching basemap names too; authoritative business labels own
    // administrative names while small settlement detail remains available.
    const names = [
      ...new Set(
        [...(props.focusRequest ? [] : props.rootFeatures), ...active].map(
          (feature) => feature.region.name,
        ),
      ),
    ];
    runtime.map.setFilter("atlas-place-labels", [
      "all",
      [
        "in",
        ["get", "class"],
        [
          "literal",
          ["city", "town", "village", "hamlet", "isolated_dwelling", "neighbourhood"],
        ],
      ],
      [
        "!",
        [
          "in",
          [
            "coalesce",
            ["get", "name:zh-Hans"],
            ["get", "name:zh"],
            ["get", "name"],
            "",
          ],
          ["literal", names],
        ],
      ],
    ]);
  }

  const nextHierarchyKey = hierarchyKey(props, active);
  if (
    nextHierarchyKey !== runtime.hierarchyKey ||
    previous?.focusRequest !== props.focusRequest
  ) {
    runtime.hierarchyKey = nextHierarchyKey;
    fitCurrentHierarchy(runtime, props, active);
    refreshOperationalMarkerSources(runtime);
  }
  runtime.host.dataset.annotationActive = String(Boolean(props.annotationActive));
  if (props.annotationActive) runtime.map.dragPan.disable();
  else runtime.map.dragPan.enable();
  runtime.host.dataset.rootRegionCount = String(props.rootFeatures.length);
  runtime.host.dataset.activeRegionCount = String(active.length);
  runtime.host.dataset.featureCount = String(props.rootFeatures.length + active.length);
  runtime.host.dataset.detailLevel = active[0]?.region.level ?? "PREFECTURE";
  runtime.host.dataset.billboardCount = String(
    operationalMarkerCollection(props).features.length,
  );
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
  const searchBounds = props.focusRequest
    ? publicMapFocus(props.focusRequest.region)
    : undefined;
  const bounds = searchBounds ?? featureBounds(focusFeatures) ?? props.bounds;
  const rootView = !searchBounds && active.length === 0;
  const padding = calculateOperationalMapPadding(runtime.host, 125);
  const map = runtime.map;
  delete runtime.fittedCenter;
  map.setMaxBounds(null);
  map.setMinZoom(0);
  const camera = map.cameraForBounds(toMapBounds(bounds), { bearing: 0, padding });
  if (!camera || camera.zoom === undefined) return;
  map.jumpTo({ ...camera, bearing: 0, pitch: rootView ? 40 : 48 });
  // Fit the actual projected outline at the chosen pitch, not a flat bounding
  // box followed by a tilt. Bound the search; it runs only on hierarchy/resize.
  const coordinates: [number, number][] = [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.minLongitude, bounds.maxLatitude],
    [bounds.maxLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ];
  let low = Math.max(0, camera.zoom - 2);
  let high = Math.min(18, camera.zoom + 2);
  const recenterOutline = () => {
    if (!coordinates.length) return;
    for (let pass = 0; pass < 2; pass += 1) {
      const points = coordinates.map(([lng, lat]) => map.project([lng, lat]));
      const minX = Math.min(...points.map((point) => point.x));
      const maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxY = Math.max(...points.map((point) => point.y));
      map.panBy(
        [
          (minX + maxX - runtime.host.clientWidth - padding.left + padding.right) / 2,
          (minY + maxY - runtime.host.clientHeight - padding.top + padding.bottom) / 2,
        ],
        { duration: 0 },
      );
    }
  };
  for (let i = 0; i < 8; i += 1) {
    const zoom = (low + high) / 2;
    map.jumpTo({ zoom });
    recenterOutline();
    const fits = coordinates.every(([lng, lat]) => {
      const p = map.project([lng, lat]);
      return (
        p.x >= padding.left &&
        p.x <= runtime.host.clientWidth - padding.right &&
        p.y >= padding.top &&
        p.y <= runtime.host.clientHeight - padding.bottom
      );
    });
    if (fits) low = zoom;
    else high = zoom;
  }
  map.jumpTo({ zoom: low });
  recenterOutline();
  map.setMinZoom(low);
  runtime.fittedCenter = [map.getCenter().lng, map.getCenter().lat];
  // maxBounds also raises zoom to fill the viewport; that crops a fitted
  // four-region outline on wide screens. User panning is disabled instead.
  runtime.host.dataset.minimumZoom = low.toFixed(2);
  runtime.host.dataset.imageryZoom = runtime.map.getZoom().toFixed(2);
  runtime.host.dataset.focusRegion = props.focusRequest?.region.code ?? "";
  runtime.host.dataset.focusBounds = JSON.stringify(bounds);
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
    if (runtime.ready && viewportChanged) refreshOperationalMarkerSources(runtime);
  });
}

function installAnnotationGestures(runtime: AtlasRuntime) {
  const canvas = runtime.map.getCanvas();
  const controller = new AbortController();
  const preview = document.createElement("div");
  preview.style.cssText =
    "display:none;position:absolute;pointer-events:none;border:1px solid #ffe796;background:#ffd45f33;z-index:2";
  runtime.map.getContainer().appendChild(preview);
  let start:
    { id: number; pixel: [number, number]; coordinate: [number, number] } | undefined;
  const position = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!runtime.props.annotationActive || event.button !== 0) return;
      const pixel = position(event);
      const coordinate = runtime.map.unproject(pixel);
      start = {
        id: event.pointerId,
        pixel,
        coordinate: [coordinate.lng, coordinate.lat],
      };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!start || start.id !== event.pointerId) return;
      const end = position(event);
      preview.style.display = "block";
      preview.style.left = `${Math.min(start.pixel[0], end[0])}px`;
      preview.style.top = `${Math.min(start.pixel[1], end[1])}px`;
      preview.style.width = `${Math.abs(start.pixel[0] - end[0])}px`;
      preview.style.height = `${Math.abs(start.pixel[1] - end[1])}px`;
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!start || start.id !== event.pointerId) return;
      const gesture = start;
      start = undefined;
      preview.style.display = "none";
      runtime.suppressClickUntil = performance.now() + 500;
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      if (!runtime.props.annotationActive) return;
      const pixel = position(event);
      const end = runtime.map.unproject(pixel);
      if (mapAnnotationGesture(gesture.pixel, pixel) === "POINT") {
        runtime.props.onAnnotationPosition?.(...gesture.coordinate);
      } else {
        runtime.props.onAnnotationRectangle?.(gesture.coordinate, [end.lng, end.lat]);
      }
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      start = undefined;
      preview.style.display = "none";
    },
    { signal: controller.signal },
  );
  return () => {
    controller.abort();
    preview.remove();
  };
}

function handleMapClick(runtime: AtlasRuntime, event: MapMouseEvent) {
  if (performance.now() < (runtime.suppressClickUntil ?? 0)) return;
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
  if (facility && facilityId) {
    const area = map.queryRenderedFeatures(event.point, {
      layers: [...REGION_LAYER_IDS],
    })[0];
    const code = area ? featureStringProperty(area, "code") : undefined;
    const region = code ? regionByCode(props).get(code) : undefined;
    if (region) props.onRegionSelect(region);
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
    props.onWeatherSelect?.(weatherRegionCode);
    return;
  }
  // A name's identifier wins over a different partition beneath its location.
  const label = map.queryRenderedFeatures(event.point, {
    layers: ["atlas-active-labels", "atlas-root-labels"],
  })[0];
  const labelCode = label ? featureStringProperty(label, "code") : undefined;
  const labelRegion = labelCode ? regionByCode(props).get(labelCode) : undefined;
  if (labelRegion) {
    props.onRegionSelect(labelRegion);
    if (labelRegion.level !== "VILLAGE") props.onRegionDrill(labelRegion);
    return;
  }
  if (activeHierarchyFeatures(props)[0]?.region.level === "VILLAGE") return;
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
      // Only non-village regions may fall back to their boundary centre.
    }
  }
  if (feature.region.level === "VILLAGE") return undefined;
  const bounds = featureBounds([feature]);
  return bounds ? centerOf(bounds) : undefined;
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

interface OperationalMarkerCandidate {
  id: string;
  latitude: number;
  longitude: number;
  properties: Record<string, string | number | boolean>;
}

function operationalMarkerCandidates(
  props: FourRegionTerrainAtlasProps,
): OperationalMarkerCandidate[] {
  const candidates: OperationalMarkerCandidate[] = [];
  props.facilities.storageFacilities.forEach((facility) => {
    if (
      facility.longitude === null ||
      facility.latitude === null ||
      !props.layers[facility.relationType]
    )
      return;
    candidates.push({
      id: facility.code,
      longitude: facility.longitude,
      latitude: facility.latitude,
      properties: {
        id: facility.code,
        kind: facility.relationType,
        name: facility.name,
        selected: facility.code === props.selectedFacilityId,
      },
    });
  });
  if (props.layers.RAILWAY) {
    props.facilities.railwayFacilities.forEach((facility) => {
      const presentation = railwayMarkerPresentation(
        facility.locationRelation,
        facility.name,
      );
      candidates.push({
        id: facility.sourceId,
        longitude: facility.longitude,
        latitude: facility.latitude,
        properties: {
          id: facility.sourceId,
          kind: "RAILWAY",
          ...presentation,
          selected: facility.sourceId === props.selectedFacilityId,
        },
      });
    });
  }
  return candidates;
}

function operationalMarkerCollection(
  props: FourRegionTerrainAtlasProps,
): FeatureCollection {
  const features: Feature[] = operationalMarkerCandidates(props).map((candidate) =>
    pointFeature(candidate.longitude, candidate.latitude, {
      ...candidate.properties,
    }),
  );
  if (props.layers.WEATHER) {
    props.situation.weather.forEach((weather) => {
      features.push(
        pointFeature(weather.longitude, weather.latitude, {
          id: weather.regionCode ?? weather.rootRegionCode,
          kind: "WEATHER",
          name: weather.regionName,
          regionCode: weather.regionCode ?? weather.rootRegionCode,
          weatherKind: weatherSpriteKind(weather),
          weatherFresh:
            !props.weatherHistorical && weatherObservationFresh(weather.observedAt),
          weatherImage: `atlas-icon-weather-${weatherSpriteKind(weather).toLowerCase()}${!props.weatherHistorical && weatherObservationFresh(weather.observedAt) ? "" : "-static"}`,
        }),
      );
    });
  }
  return { type: "FeatureCollection", features };
}

function refreshOperationalMarkerSources(runtime: AtlasRuntime) {
  const collection = operationalMarkerCollection(runtime.props);
  const facilityCount = operationalMarkerCandidates(runtime.props).length;
  runtime.host.dataset.operationalMarkerCount = String(facilityCount);
  runtime.host.dataset.operationalLeaderCount = "0";
  setSource(runtime.map, MARKER_SOURCE, collection);
}

function startWeatherAnimation(runtime: AtlasRuntime) {
  const paint = createWeatherSpritePainter();
  const kinds: WeatherSpriteKind[] = [
    "CLEAR",
    "CLOUD",
    "RAIN",
    "SNOW",
    "STORM",
    "CLEAR_NIGHT",
    "UNKNOWN",
  ];
  if (paint)
    for (const kind of kinds) {
      const id = `atlas-icon-weather-${kind.toLowerCase()}`;
      if (runtime.map.hasImage(id)) runtime.map.removeImage(id);
      runtime.map.addImage(id, paint(kind, 0), { pixelRatio: 2 });
      runtime.map.addImage(`${id}-static`, paint(kind, 0), { pixelRatio: 2 });
    }
  let freshnessCheckedAt = 0;
  const animate = (timestamp: number) => {
    if (runtime.destroyed) return;
    if (
      !document.hidden &&
      runtime.props.layers.WEATHER &&
      timestamp - runtime.weatherAnimationUpdatedAt >= 90 &&
      runtime.map.getLayer("atlas-weather-pulse")
    ) {
      if (timestamp - freshnessCheckedAt > 30_000) {
        refreshOperationalMarkerSources(runtime);
        freshnessCheckedAt = timestamp;
      }
      const motionTime =
        runtime.props.weatherHistorical ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : timestamp;
      if (paint)
        for (const kind of new Set(
          runtime.props.situation.weather
            .filter((weather) => weatherObservationFresh(weather.observedAt))
            .map(weatherSpriteKind),
        )) {
          runtime.map.updateImage(
            `atlas-icon-weather-${kind.toLowerCase()}`,
            paint(kind, motionTime),
          );
        }
      const phase = (Math.sin(motionTime / 1200) + 1) / 2;
      runtime.map.setPaintProperty(
        "atlas-weather-pulse",
        "circle-radius",
        12 + phase * 8,
      );
      runtime.map.setPaintProperty(
        "atlas-weather-pulse",
        "circle-opacity",
        0.08 + phase * 0.1,
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
