import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import type { OverviewRegion } from "../../domain/overview";
import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointIcon,
} from "../../domain/overviewSamplePoint";
import { samplePointAggregateLabel } from "../presentation/samplePointAggregateRing";
import { sampleNetworkMarkerAccessibilityLabel } from "../presentation/sampleNetworkMarkerAccessibility";
import {
  designCoverageBadgePathData,
  designReferenceIconPathData,
  regionalActualBadgePathData,
} from "../presentation/sampleNetworkLayers";
import type {
  MapFeature,
  MapPointFeature,
  OverviewMapCommand,
  OverviewMapSelectionPoint,
} from "./boundaryGeometry";
import {
  compactAdministrativeName,
  createReliefOverlayLayout,
  OVERVIEW_RELIEF_DEPTH,
  overviewDetailsPanelLeft,
  overviewReliefFrame,
  projectReliefOverlays,
  projectReliefScene,
  type ReliefPoint,
  type ReliefPolygon,
  type ReliefPlatform,
  type ReliefSceneProjection,
  type ReliefSurface,
} from "./terrainReliefGeometry";
import {
  createGeologicalWallMaterial,
  createTerrainSurfaceMaterial,
} from "./terrainReliefMaterials";
import { publicAssetUrl } from "../../../../shared/assets/publicAssetUrl";

export { compactAdministrativeName } from "./terrainReliefGeometry";

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const RENDER_SCALE = 2;
export const COMPONENT_HIGHLIGHT_LIFT = 24;
const RELIEF_OBLIQUE_SHEAR = 1;
export const RELIEF_LAYER_Z = {
  substrateTop: 0.25,
  baseTop: 0.75,
  baseOutline: 1.05,
  interactionOffset: 1.25,
  interactionTop: 2,
  interactionOutline: 2.55,
} as const;
const RELIEF_FRAME_INSET = 0.035;
const TERRAIN_URL = publicAssetUrl("overview/command-terrain-v2.webp");
const samplePointRoleAssetUrl = {
  PRODUCTION: publicAssetUrl("overview/sample-points/production-rice.svg"),
  MARKET: publicAssetUrl("overview/sample-points/market-bank.svg"),
  LOGISTICS: publicAssetUrl("overview/sample-points/logistics-car.svg"),
} as const;
const BACKGROUND_Z = -900;
// Keep hit/line overlays just above the textured top. A very large z value
// makes internal boundaries render through the parent's vertical wall.
const OVERLAY_Z = 4;

export function overviewWideStageOffset(stageWidth: number) {
  return Math.max(0, (stageWidth - STAGE_WIDTH) / 2);
}

/**
 * Presentation assets keyed only by the authoritative object-type iconKey.
 * The object-type matrix itself remains backend governed; unknown keys fail
 * closed instead of silently receiving a generic building or text badge.
 */
export const samplePointIconPathData: Readonly<Record<string, string>> = {
  farmer:
    "M12 21V7m0 5C8.2 11.7 6 9.3 6 6c3.7 0 6 2.4 6 6Zm0 4c3.8-.3 6-2.7 6-6-3.7 0-6 2.4-6 6ZM8 21h8",
  "village-committee": "M3 9 12 4l9 5M5 10h14M6 10v8m4-8v8m4-8v8m4-8v8M4 21h16M9 7h6",
  "agricultural-tech-station":
    "M9 3h6m-5 0v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3m-6 12h8m-5 2c2-3 4-3 6-2",
  trader:
    "M4 5h16l1 5a3 3 0 0 1-5 2 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-5-2l1-5Zm1 8v8h14v-8m-9 8v-5h4v5",
  "deep-processor": "M3 21V10l6 4v-4l6 4V7h5v14H3Zm13-17h3v3h-3M6 18h2m3 0h2m3 0h2",
  "wholesale-market":
    "M3 9h18l-2-5H5L3 9Zm1 0a3 3 0 0 0 5 2 3 3 0 0 0 6 0 3 3 0 0 0 5-2v11H4V9Zm4 7h3v4m3-4h3v4",
  "reserve-enterprise":
    "M6 21V8a6 4 0 0 1 12 0v13M6 8h12M8 12h8m-8 4h8m-8 4h8M3 21h18M12 3v5",
  "breeding-factory": "M3 21V9l9-6 9 6v12M7 21v-8h10v8M9 13l3 3 3-3M6 8h12M5 21h14",
  "feed-mill": "M7 3h10l-1 7-4 5-4-5-1-7Zm5 12v6m-4 0h8M5 10h14M9 7h6m-1 10h4l2 4",
  "rice-mill": "M4 21V9l8-5 8 5v12M7 21v-7h10v7M8 10h8M9 17h6M12 4V2m-3 4L7 3m8 3 2-3",
  "rail-node":
    "M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 4h10M8 14h.01M16 14h.01M7 18l-2 3m12-3 2 3M8 21h8",
  "road-node": "M5 21 9 3h6l4 18M12 3v4m0 4v4m0 4v2M6 17h12M8 8h8",
};

function commandStageWidth() {
  const scale = Math.min(1, window.innerHeight / STAGE_HEIGHT);
  return Math.max(1280, window.innerWidth / Math.max(scale, 0.001));
}

interface RendererCallbacks {
  onDrill: (region: OverviewRegion) => void;
  onReady: () => void;
  onSelect: (region: OverviewRegion) => void;
  onUnavailable: (reason: string) => void;
}

export interface ReliefComponentIdentity {
  componentId: number;
  level: OverviewRegion["level"];
  parentCode?: string | undefined;
  regionCode: string;
}

interface ReliefInteractionTarget extends ReliefComponentIdentity {
  region: OverviewRegion;
}

type ComponentReliefTone = "base" | "hover" | "selected";

interface ComponentReliefVisual {
  setTone: (tone: ComponentReliefTone) => void;
}

export function reliefComponentKey({
  componentId,
  regionCode,
}: Pick<ReliefComponentIdentity, "componentId" | "regionCode">) {
  return `${regionCode}::${componentId}`;
}

export interface ReliefLayoutTransform {
  scaleX: number;
  scaleY: number;
  screenOffsetX: number;
  screenOffsetY: number;
  uvOffsetX: number;
  uvOffsetY: number;
  worldOffsetX: number;
  worldOffsetY: number;
}

const IDENTITY_LAYOUT_TRANSFORM: ReliefLayoutTransform = {
  scaleX: 1,
  scaleY: 1,
  screenOffsetX: 0,
  screenOffsetY: 0,
  uvOffsetX: 0,
  uvOffsetY: 0,
  worldOffsetX: 0,
  worldOffsetY: 0,
};

export default function TerrainReliefBoundaryMap({
  backdrop,
  command,
  features,
  onDrill,
  onReady,
  onSamplePointSelect,
  onSelect,
  onSelectionPosition,
  onUnavailable,
  points,
  samplePointAggregates = [],
  samplePointAggregateStatus,
  samplePointIcons = [],
  reserveRightPanel = false,
  selectedCode,
  selectedSamplePointId,
}: {
  backdrop?: MapFeature;
  command?: OverviewMapCommand;
  features: readonly MapFeature[];
  onDrill: (region: OverviewRegion) => void;
  onReady: () => void;
  onSamplePointSelect?: (samplePointId: string) => void;
  onSelect: (region: OverviewRegion) => void;
  onSelectionPosition?: (position: OverviewMapSelectionPoint | undefined) => void;
  onUnavailable: (reason: string) => void;
  points: readonly MapPointFeature[];
  samplePointAggregates?: readonly OverviewSamplePointAggregate[];
  samplePointAggregateStatus?: "hidden" | "loading" | "ready" | "unavailable";
  samplePointIcons?: readonly OverviewSamplePointIcon[];
  reserveRightPanel?: boolean;
  selectedCode: string;
  selectedSamplePointId?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef<RendererCallbacks>({
    onDrill,
    onReady,
    onSelect,
    onUnavailable,
  });
  const selectedRef = useRef(selectedCode);
  const selectedComponentRef = useRef("");
  const positionCallbackRef = useRef(onSelectionPosition);
  const componentReliefVisualsRef = useRef(new Map<string, ComponentReliefVisual>());
  const primaryComponentByRegionRef = useRef(
    new Map<string, ReliefComponentIdentity>(),
  );
  const componentReliefUpdateRef = useRef<(hoveredKey?: string) => void>(
    () => undefined,
  );
  const componentSelectionUpdateRef = useRef<
    (identity: ReliefComponentIdentity) => void
  >(() => undefined);
  const pointMaterialsRef = useRef(new Map<string, THREE.MeshBasicMaterial>());
  const hoverUpdateRef = useRef<(identity?: ReliefComponentIdentity) => void>(
    () => undefined,
  );
  const layoutUpdateRef = useRef<(open: boolean) => void>(() => undefined);
  const renderRef = useRef<() => void>(() => undefined);
  const layoutTimerRef = useRef<number | undefined>(undefined);
  const detailsOpen = Boolean(selectedCode);
  const [detailLayoutOpen, setDetailLayoutOpen] = useState(false);
  const activeDetailLayout = reserveRightPanel || (detailsOpen && detailLayoutOpen);
  const detailLayoutOpenRef = useRef(false);
  const [stageWidth, setStageWidth] = useState(commandStageWidth);
  const renderedStageWidth = Math.max(STAGE_WIDTH, Math.ceil(stageWidth));
  const wideStageOffset = overviewWideStageOffset(renderedStageWidth);
  const fullMapFrame = useMemo(() => overviewReliefFrame(false), []);
  const detailMapFrame = useMemo(
    () => overviewReliefFrame(true, stageWidth),
    [stageWidth],
  );
  const terrainProjectionResult = useMemo(() => {
    const startedAt = window.performance.now();
    const projection = projectReliefScene({
      ...(backdrop ? { backdrop } : {}),
      features,
      frame: fullMapFrame,
      points,
    });
    return {
      duration: window.performance.now() - startedAt,
      projection,
    };
  }, [backdrop, features, fullMapFrame, points]);
  const terrainProjection = terrainProjectionResult.projection;
  const sceneProjectionResult = useMemo(() => {
    if (!samplePointAggregates.length && !samplePointIcons.length) {
      return terrainProjectionResult;
    }
    const startedAt = window.performance.now();
    const projection = projectReliefOverlays(
      terrainProjection,
      samplePointAggregates,
      samplePointIcons,
    );
    return {
      duration: window.performance.now() - startedAt,
      projection,
    };
  }, [
    samplePointAggregates,
    samplePointIcons,
    terrainProjection,
    terrainProjectionResult,
  ]);
  const sceneProjection = sceneProjectionResult.projection;
  const terrainDetailProjectionResult = useMemo(() => {
    const startedAt = window.performance.now();
    const projection = reframeReliefScene(terrainProjection, detailMapFrame);
    return {
      duration: window.performance.now() - startedAt,
      projection,
    };
  }, [detailMapFrame, terrainProjection]);
  const terrainDetailProjection = terrainDetailProjectionResult.projection;
  const detailProjectionResult = useMemo(() => {
    const startedAt = window.performance.now();
    const projection = reframeReliefScene(sceneProjection, detailMapFrame);
    return {
      duration: window.performance.now() - startedAt,
      projection,
    };
  }, [detailMapFrame, sceneProjection]);
  const detailProjection = detailProjectionResult.projection;
  const rendererProjectionDurationMs =
    terrainProjectionResult.duration + terrainDetailProjectionResult.duration;
  const activeProjection = activeDetailLayout ? detailProjection : sceneProjection;
  const activeSurfaceBounds = reliefSceneBounds(activeProjection);
  const activeLayoutTransform = activeDetailLayout
    ? calculateLayoutTransform(sceneProjection, detailProjection)
    : IDENTITY_LAYOUT_TRANSFORM;
  const selectedOverlayLift = COMPONENT_HIGHLIGHT_LIFT * activeLayoutTransform.scaleY;
  const overlayLayout = useMemo(
    () => createReliefOverlayLayout(activeProjection),
    [activeProjection],
  );
  const coordinateGroupBySamplePointId = useMemo(() => {
    const groups = new Map<string, OverviewSamplePointIcon[]>();
    activeProjection.samplePointIcons.forEach(({ icon }) => {
      if (
        (icon.layerType ?? "ANNUAL_ACTUAL") !== "ANNUAL_ACTUAL" ||
        icon.longitude === null ||
        icon.latitude === null
      ) {
        return;
      }
      const key = `${icon.longitude.toFixed(12)}:${icon.latitude.toFixed(12)}`;
      groups.set(key, [...(groups.get(key) ?? []), icon]);
    });
    const byId = new Map<string, { count: number; index: number }>();
    groups.forEach((icons) => {
      [...icons]
        .sort((left, right) => left.samplePointId.localeCompare(right.samplePointId))
        .forEach((icon, index) =>
          byId.set(icon.samplePointId, { count: icons.length, index: index + 1 }),
        );
    });
    return byId;
  }, [activeProjection.samplePointIcons]);
  const aggregateRegionCodes = new Set(
    activeProjection.samplePointAggregates.map(
      ({ aggregate }) => aggregate.anchorRegionCode ?? aggregate.regionCode,
    ),
  );
  const aggregateByRegion = new Map(
    activeProjection.samplePointAggregates.map(({ aggregate }) => [
      aggregate.anchorRegionCode ?? aggregate.regionCode,
      aggregate,
    ]),
  );

  const cancelLayoutTimer = useCallback(() => {
    if (layoutTimerRef.current === undefined) return;
    window.clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = undefined;
  }, []);
  const scheduleSelection = useCallback((region: OverviewRegion) => {
    callbacksRef.current.onSelect(region);
  }, []);
  const scheduleComponentSelection = useCallback(
    (region: OverviewRegion, componentId: number) => {
      const identity: ReliefComponentIdentity = {
        componentId,
        level: region.level,
        parentCode: region.parentCode,
        regionCode: region.code,
      };
      componentSelectionUpdateRef.current(identity);
      callbacksRef.current.onSelect(region);
    },
    [],
  );
  const drillImmediately = useCallback(
    (region: OverviewRegion) => {
      cancelLayoutTimer();
      callbacksRef.current.onDrill(region);
    },
    [cancelLayoutTimer],
  );

  useEffect(() => {
    detailLayoutOpenRef.current = activeDetailLayout;
  }, [activeDetailLayout]);

  useEffect(() => {
    const updateStageWidth = () => setStageWidth(commandStageWidth());
    window.addEventListener("resize", updateStageWidth);
    return () => window.removeEventListener("resize", updateStageWidth);
  }, []);

  useEffect(() => {
    cancelLayoutTimer();
    if (!detailsOpen) {
      layoutTimerRef.current = window.setTimeout(() => {
        layoutTimerRef.current = undefined;
        setDetailLayoutOpen(false);
      }, 0);
      return cancelLayoutTimer;
    }
    // The detail drawer responds on the first click. The map itself keeps its
    // original hit positions for one double-click interval, so the second
    // click can still drill without paying an artificial 220 ms selection
    // delay or losing its target while the safe frame is reflowed.
    layoutTimerRef.current = window.setTimeout(() => {
      layoutTimerRef.current = undefined;
      setDetailLayoutOpen(true);
    }, 220);
    return cancelLayoutTimer;
  }, [cancelLayoutTimer, detailsOpen, selectedCode]);

  useEffect(() => {
    callbacksRef.current = { onDrill, onReady, onSelect, onUnavailable };
  }, [onDrill, onReady, onSelect, onUnavailable]);

  useEffect(() => {
    positionCallbackRef.current = onSelectionPosition;
  }, [onSelectionPosition]);

  useEffect(() => {
    selectedRef.current = selectedCode;
    if (selectedCode && !selectedComponentRef.current.startsWith(`${selectedCode}::`)) {
      const primary = primaryComponentByRegionRef.current.get(selectedCode);
      selectedComponentRef.current = primary ? reliefComponentKey(primary) : "";
    }
    if (!selectedCode) {
      selectedComponentRef.current = "";
    }
    layoutUpdateRef.current(activeDetailLayout);
    hoverUpdateRef.current(undefined);
    componentReliefUpdateRef.current();
    pointMaterialsRef.current.forEach((material, code) => {
      material.color.set(code === selectedCode ? 0xffd564 : 0x76f4ff);
      material.opacity = code === selectedCode ? 1 : 0.9;
    });
    reportSelectionPosition(
      activeProjection,
      selectedCode,
      positionCallbackRef.current,
      stageWidth,
    );
    renderRef.current();
  }, [activeDetailLayout, activeProjection, selectedCode, stageWidth]);

  useEffect(() => {
    if (!command) return;
    // The approved presentation camera is intentionally immutable. All visible
    // controls resolve to the same fitted golden-frame composition.
    reportSelectionPosition(
      activeProjection,
      selectedRef.current,
      positionCallbackRef.current,
      stageWidth,
    );
    renderRef.current();
  }, [activeProjection, command, stageWidth]);

  useEffect(() => {
    const canvasHost = hostRef.current;
    if (!canvasHost) return;
    const buildStartedAt = window.performance.now();
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    // The approved 1920×1080 presentation baseline uses a fixed 2× render
    // buffer. Geometry is simplified before triangulation, so full-resolution
    // MSAA can remove edge stair-stepping without restoring the former Turf
    // union or per-interaction projection bottleneck.
    renderer.setPixelRatio(RENDER_SCALE);
    renderer.setSize(renderedStageWidth, STAGE_HEIGHT, false);
    renderer.domElement.style.width = `${renderedStageWidth}px`;
    renderer.domElement.style.height = `${STAGE_HEIGHT}px`;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    // Keep one stable accessibility contract across the terrain, Three.js,
    // and fallback renderers. Visual implementation details belong in data
    // attributes; consumers should not have to know which renderer is active.
    renderer.domElement.setAttribute("aria-label", "行政区边界地图");
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.tabIndex = 0;
    const sceneHost = canvasHost.parentElement;
    if (sceneHost) {
      sceneHost.dataset.styleState = "preparing";
      sceneHost.dataset.overviewScene = "viewer-created";
      sceneHost.dataset.sceneVersion = "terrain-relief-v10-true-z-extrusion";
      sceneHost.dataset.elevationAxis = "z";
      sceneHost.dataset.groundFootprintTranslation = "0,0";
      sceneHost.dataset.renderer = "three-single-canvas-relief";
      sceneHost.dataset.renderScale = `${RENDER_SCALE}x-msaa`;
      sceneHost.dataset.wallMaterial = "opaque-depth-gradient-prism-wall";
      sceneHost.dataset.interactionCapLayerCount = "1";
      sceneHost.dataset.interactionSocketLayerCount = "0";
      sceneHost.dataset.reliefMode = terrainProjection.backdrop
        ? "continuous-backdrop"
        : terrainProjection.features.length
          ? "real-feature-fallback"
          : "empty";
      sceneHost.dataset.featureCount = String(terrainProjection.features.length);
      sceneHost.dataset.pointCount = String(terrainProjection.points.length);
      sceneHost.dataset.rendererInitDurationMs = String(
        Math.round(window.performance.now() - buildStartedAt),
      );
      sceneHost.dataset.projectionDurationMs = String(
        Math.round(rendererProjectionDurationMs),
      );
      if (terrainProjection.diagnostics) {
        sceneHost.dataset.projectionSourceBoundsMs = String(
          Math.round(terrainProjection.diagnostics.sourceBoundsMs),
        );
        sceneHost.dataset.projectionSurfaceMs = String(
          Math.round(terrainProjection.diagnostics.surfaceProjectionMs),
        );
        sceneHost.dataset.projectionUnionMs = String(
          Math.round(terrainProjection.diagnostics.unionMs),
        );
      }
    }

    const scene = new THREE.Scene();
    const reliefRoot = new THREE.Group();
    // Keep the governed x/y footprint fixed and project true z elevation into
    // the approved oblique screen composition. Ground vertices (z=0) remain
    // pixel-registered; raised vertices move only because their real height is
    // projected, not because a duplicate 2-D polygon is translated.
    reliefRoot.matrixAutoUpdate = false;
    applyReliefLayoutMatrix(reliefRoot, IDENTITY_LAYOUT_TRANSFORM);
    scene.add(reliefRoot);
    // Same lighting model used by mature maptalks.three extrusion examples:
    // broad ambient sky light preserves the terrain texture, while one soft
    // directional light separates the raised cap from the ground without a
    // glossy or plastic highlight.
    const ambientLight = new THREE.HemisphereLight(0xdaf7ff, 0x0b2638, 1.15);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(-0.55, 0.7, 1.8).normalize();
    scene.add(ambientLight, keyLight);
    const camera = new THREE.OrthographicCamera(
      -renderedStageWidth / 2,
      renderedStageWidth / 2,
      STAGE_HEIGHT / 2,
      -STAGE_HEIGHT / 2,
      0.1,
      3000,
    );
    camera.position.set(0, 0, 1000);
    camera.lookAt(0, 0, 0);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const interactiveMeshes: THREE.Object3D[] = [];
    const targetByObject = new Map<string, ReliefInteractionTarget>();
    const resources: Array<{ dispose: () => void }> = [];
    const componentReliefVisuals = new Map<string, ComponentReliefVisual>();
    const pointMaterials = new Map<string, THREE.MeshBasicMaterial>();
    componentReliefVisualsRef.current = componentReliefVisuals;
    pointMaterialsRef.current = pointMaterials;

    let renderCount = 0;
    const render = () => {
      if (disposed) return;
      renderCount += 1;
      if (sceneHost) sceneHost.dataset.rendererFrameCount = String(renderCount);
      renderer.render(scene, camera);
    };
    renderRef.current = render;

    loadTerrainImage()
      .then((terrainImage) => {
        if (disposed) {
          return;
        }
        const terrainReadyAt = window.performance.now();
        if (sceneHost) {
          sceneHost.dataset.terrainReadyDurationMs = String(
            Math.round(terrainReadyAt - buildStartedAt),
          );
        }
        const terrainTexture = new THREE.Texture(terrainImage);
        terrainTexture.needsUpdate = true;
        terrainTexture.colorSpace = THREE.SRGBColorSpace;
        terrainTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        terrainTexture.minFilter = THREE.LinearMipmapLinearFilter;
        terrainTexture.magFilter = THREE.LinearFilter;
        resources.push(terrainTexture);

        const backgroundGeometry = new THREE.PlaneGeometry(
          renderedStageWidth,
          STAGE_HEIGHT,
        );
        const backgroundMaterial = new THREE.MeshBasicMaterial({ map: terrainTexture });
        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.position.z = BACKGROUND_Z;
        scene.add(background);
        resources.push(backgroundGeometry, backgroundMaterial);

        const hazeGeometry = new THREE.PlaneGeometry(renderedStageWidth, STAGE_HEIGHT);
        const hazeMaterial = new THREE.MeshBasicMaterial({
          color: 0x043d59,
          opacity: 0.38,
          transparent: true,
        });
        const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
        haze.position.z = BACKGROUND_Z + 1;
        scene.add(haze);
        resources.push(hazeGeometry, hazeMaterial);

        const baseSurfaceMaterial = createTerrainSurfaceMaterial(
          terrainTexture,
          "base",
        );
        const hoverSurfaceMaterial = createTerrainSurfaceMaterial(
          terrainTexture,
          "hover",
        );
        const selectedSurfaceMaterial = createTerrainSurfaceMaterial(
          terrainTexture,
          "selected",
        );
        const outlineMaterial = createOutlineMaterial({
          color: 0xd8fbff,
          opacity: 0.98,
          width: 1.8,
        });
        const sideMaterial = createGeologicalWallMaterial(terrainTexture, "base");
        const hoverSideMaterial = createGeologicalWallMaterial(terrainTexture, "hover");
        const hoverOutlineMaterial = createOutlineMaterial({
          color: 0xffdf72,
          opacity: 1,
          width: 2.2,
        });
        const selectedSideMaterial = createGeologicalWallMaterial(
          terrainTexture,
          "selected",
        );
        const selectedOutlineMaterial = createOutlineMaterial({
          color: 0xffe890,
          opacity: 1,
          width: 2.4,
        });
        resources.push(
          baseSurfaceMaterial,
          hoverSurfaceMaterial,
          selectedSurfaceMaterial,
          selectedOutlineMaterial,
          selectedSideMaterial,
          outlineMaterial,
          sideMaterial,
          hoverSideMaterial,
          hoverOutlineMaterial,
        );

        const surfaceGeometryCache = new Map<
          ReliefGeometry,
          readonly THREE.ShapeGeometry[]
        >();
        const geometriesFor = (surface: ReliefGeometry) => {
          const cached = surfaceGeometryCache.get(surface);
          if (cached) return cached;
          const geometries = createSurfaceGeometries(surface);
          surfaceGeometryCache.set(surface, geometries);
          return geometries;
        };
        // One recessed, non-interactive parent substrate closes the ground
        // beneath every movable administrative component. It sits below the
        // component caps, so it cannot become a pasted interaction overlay;
        // it only prevents transparent voids from appearing when a cap rises.
        const renderBodies = selectReliefRenderBodies(terrainProjection);
        const earthWallBodies = renderBodies.walls;
        const earthTopBodies = renderBodies.tops;
        if (sceneHost) {
          sceneHost.dataset.capOwnership =
            "administrative-component-mesh-over-recessed-substrate";
          sceneHost.dataset.duplicateInteractiveTopCount = "0";
          sceneHost.dataset.reliefWallGeometryCount = "0";
          sceneHost.dataset.reliefSolidVisible = "false";
          sceneHost.dataset.parentOuterLayerCount = "0";
        }
        if (earthWallBodies.length || earthTopBodies.length) {
          const earthTopGeometries = earthTopBodies.flatMap((surface) =>
            geometriesFor(surface),
          );
          const earthWalls = createVisibleWallGeometries(
            earthWallBodies,
            OVERVIEW_RELIEF_DEPTH,
          );
          const solid = createSolidReliefGroupFromGeometries(
            { tops: earthTopGeometries, walls: earthWalls },
            baseSurfaceMaterial,
            sideMaterial,
            RELIEF_LAYER_Z.substrateTop,
          );
          reliefRoot.add(solid);
          if (sceneHost) {
            sceneHost.dataset.reliefWallGeometryCount = String(earthWalls.length);
            sceneHost.dataset.reliefSolidVisible = earthWalls.length ? "true" : "false";
            sceneHost.dataset.parentOuterLayerCount = terrainProjection.backdrop
              ? "1"
              : "0";
          }
        }

        const selectableSurfaces = new Map<string, ReliefSurface>();
        terrainProjection.features
          .filter(({ region }) => !region.mapContextOnly)
          .forEach((surface) => selectableSurfaces.set(surface.region.code, surface));
        if (!terrainProjection.features.length && terrainProjection.backdrop) {
          selectableSurfaces.set(
            terrainProjection.backdrop.region.code,
            terrainProjection.backdrop,
          );
        }
        const primaryComponentByRegion = new Map<string, ReliefComponentIdentity>();
        primaryComponentByRegionRef.current = primaryComponentByRegion;
        selectableSurfaces.forEach((surface, code) => {
          const componentId = surface.primaryPolygonIndex;
          const identity: ReliefComponentIdentity = {
            componentId,
            level: surface.region.level,
            parentCode: surface.region.parentCode,
            regionCode: code,
          };
          primaryComponentByRegion.set(code, identity);
          const canRaise = surface.raiseablePolygonIndices.length > 0;
          const key = reliefComponentKey(identity);
          const target: ReliefInteractionTarget = {
            ...identity,
            region: surface.region,
          };
          // One group owns the complete administrative geometry. Every top,
          // detached polygon and matching wall rises through the same transform.
          const geometries = createMovableComponentGeometries(surface);
          const componentGroup = new THREE.Group();
          const wallMeshes = geometries.walls.map((geometry) => {
            const mesh = new THREE.Mesh(geometry, selectedSideMaterial);
            mesh.position.z = RELIEF_LAYER_Z.baseTop;
            mesh.renderOrder = 2;
            mesh.visible = false;
            componentGroup.add(mesh);
            return mesh;
          });
          const topMeshes = geometries.tops.map((geometry) => {
            const mesh = new THREE.Mesh(geometry, baseSurfaceMaterial);
            mesh.position.z = RELIEF_LAYER_Z.baseTop;
            mesh.renderOrder = 3;
            componentGroup.add(mesh);
            if (canRaise) {
              interactiveMeshes.push(mesh);
              targetByObject.set(mesh.uuid, target);
            }
            return mesh;
          });
          const interactionOutline = createOutlineGroup(
            surface,
            selectedOutlineMaterial,
            RELIEF_LAYER_Z.interactionOutline - RELIEF_LAYER_Z.interactionOffset,
          );
          interactionOutline.visible = false;
          componentGroup.add(interactionOutline);
          reliefRoot.add(componentGroup);

          const setOutlineMaterial = (material: THREE.Material) => {
            interactionOutline.traverse((object) => {
              const line = object as THREE.Object3D & {
                material?: THREE.Material;
              };
              if (line.material) line.material = material;
            });
          };
          if (!canRaise) return;
          componentReliefVisuals.set(key, {
            setTone: (tone) => {
              const raised = tone !== "base";
              componentGroup.position.set(0, 0, raised ? COMPONENT_HIGHLIGHT_LIFT : 0);
              topMeshes.forEach((mesh) => {
                mesh.material =
                  tone === "selected"
                    ? selectedSurfaceMaterial
                    : tone === "hover"
                      ? hoverSurfaceMaterial
                      : baseSurfaceMaterial;
              });
              wallMeshes.forEach((mesh) => {
                mesh.visible = raised;
                mesh.material =
                  tone === "hover" ? hoverSideMaterial : selectedSideMaterial;
              });
              interactionOutline.visible = raised;
              if (raised) {
                setOutlineMaterial(
                  tone === "hover" ? hoverOutlineMaterial : selectedOutlineMaterial,
                );
              }
            },
          });
        });

        // One ownership-aware ground outline keeps all resting borders visible.
        // When a component rises, only segments owned by that region disappear;
        // the rest of the administrative structure remains on the ground.
        const groundOutlineSurfaces =
          terrainProjection.features.length && terrainProjection.backdrop
            ? [...renderBodies.outlines, terrainProjection.backdrop]
            : renderBodies.outlines;
        const activeOutline = createUniqueOutlineGroup(
          groundOutlineSurfaces,
          outlineMaterial,
          RELIEF_LAYER_Z.baseOutline,
          false,
        );
        reliefRoot.add(activeOutline.group);
        if (sceneHost) {
          sceneHost.dataset.parentOutlineLayerCount = terrainProjection.backdrop
            ? "1"
            : "0";
          sceneHost.dataset.childrenInternalLayerCount = terrainProjection.features
            .length
            ? "1"
            : "0";
          sceneHost.dataset.duplicateOutlineSegmentCount = "0";
          sceneHost.dataset.deduplicatedOutlineSegmentCount = String(
            activeOutline.duplicateSegmentCount,
          );
          sceneHost.dataset.groundOutlineLayerCount = "1";
          sceneHost.dataset.groundOutlinesSuppressed = "false";
        }

        componentReliefUpdateRef.current = (hoveredKey = "") => {
          componentReliefVisuals.forEach((visual, key) => {
            const tone: ComponentReliefTone = hoveredKey
              ? key === hoveredKey
                ? "hover"
                : "base"
              : key === selectedComponentRef.current
                ? "selected"
                : "base";
            visual.setTone(tone);
          });
          const raisedComponentKey = hoveredKey || selectedComponentRef.current;
          const raisedRegionCode = raisedComponentKey.split("::", 1)[0] ?? "";
          activeOutline.setSuppressedRegion(raisedRegionCode);
          if (sceneHost) {
            sceneHost.dataset.groundOutlinesSuppressed = String(
              Boolean(raisedRegionCode),
            );
            sceneHost.dataset.suppressedGroundOutlineRegion = raisedRegionCode;
          }
        };

        componentSelectionUpdateRef.current = (identity) => {
          const key = reliefComponentKey(identity);
          selectedComponentRef.current = key;
          componentReliefUpdateRef.current();
          if (sceneHost) {
            sceneHost.dataset.selectedRegion = identity.regionCode;
            sceneHost.dataset.selectedComponent = key;
            sceneHost.dataset.raisedSelectionComponentCount =
              componentReliefVisuals.has(key) ? "1" : "0";
            sceneHost.dataset.selectionOverlayLayerCount = "0";
            sceneHost.dataset.selectionRaisedGeometryCount = "1";
          }
        };

        let hoveredComponentKey = "";
        hoverUpdateRef.current = (identity) => {
          const nextKey = identity ? reliefComponentKey(identity) : "";
          if (nextKey === hoveredComponentKey) return;
          hoveredComponentKey = nextKey;
          componentReliefUpdateRef.current(nextKey);
          if (sceneHost) {
            sceneHost.dataset.hoveredRegion = identity?.regionCode ?? "";
            sceneHost.dataset.hoveredComponent = nextKey;
            sceneHost.dataset.raisedHoverComponentCount =
              nextKey && componentReliefVisuals.has(nextKey) ? "1" : "0";
            sceneHost.dataset.hoverOverlayLayerCount = "0";
            sceneHost.dataset.hoverRaisedGeometryCount = nextKey ? "1" : "0";
          }
          render();
        };

        terrainProjection.points.forEach(({ point, region }) => {
          const densePoints = terrainProjection.points.length > 32;
          const geometry = new THREE.CircleGeometry(
            densePoints ? 1.65 : region.level === "VILLAGE" ? 3.8 : 5.1,
            densePoints ? 12 : 24,
          );
          const material = new THREE.MeshBasicMaterial({
            color: region.code === selectedRef.current ? 0xffd564 : 0x76f4ff,
            opacity: region.code === selectedRef.current ? 1 : 0.9,
            transparent: true,
          });
          const marker = new THREE.Mesh(geometry, material);
          const position = screenToWorld(point);
          marker.position.set(position.x, position.y, OVERLAY_Z + 4);
          reliefRoot.add(marker);
          interactiveMeshes.push(marker);
          const primary = primaryComponentByRegion.get(region.code);
          targetByObject.set(marker.uuid, {
            componentId: primary?.componentId ?? -1,
            level: region.level,
            parentCode: region.parentCode,
            region,
            regionCode: region.code,
          });
          pointMaterials.set(region.code, material);
          resources.push(geometry, material);

          if (densePoints) return;
          const haloGeometry = new THREE.RingGeometry(8, 11, 32);
          const haloMaterial = new THREE.MeshBasicMaterial({
            color: 0x69eaf4,
            opacity: 0.4,
            side: THREE.DoubleSide,
            transparent: true,
          });
          const halo = new THREE.Mesh(haloGeometry, haloMaterial);
          halo.position.set(position.x, position.y, OVERLAY_Z + 3);
          reliefRoot.add(halo);
          resources.push(haloGeometry, haloMaterial);
        });

        if (selectedRef.current) {
          const primary = primaryComponentByRegion.get(selectedRef.current);
          if (primary) {
            selectedComponentRef.current = reliefComponentKey({
              componentId: primary.componentId,
              regionCode: selectedRef.current,
            });
          }
        }
        componentReliefUpdateRef.current();

        const surfaceMaterials = [
          baseSurfaceMaterial,
          hoverSurfaceMaterial,
          selectedSurfaceMaterial,
        ];
        layoutUpdateRef.current = (open) => {
          const transform = open
            ? calculateLayoutTransform(terrainProjection, terrainDetailProjection)
            : IDENTITY_LAYOUT_TRANSFORM;
          applyReliefLayoutMatrix(reliefRoot, transform);
          surfaceMaterials.forEach((material) =>
            updateTerrainUvTransform(material, transform),
          );
        };
        layoutUpdateRef.current(detailLayoutOpenRef.current);

        const geometryReadyAt = window.performance.now();
        if (sceneHost) {
          sceneHost.dataset.projectedVertexCount = String(
            countProjectedVertices(terrainProjection),
          );
          sceneHost.dataset.earthVertexCount = String(
            countEarthVertices(terrainProjection),
          );
          sceneHost.dataset.hitTestVertexCount = String(
            countHitTestVertices(terrainProjection),
          );
          sceneHost.dataset.geometryCpuDurationMs = String(
            Math.round(geometryReadyAt - terrainReadyAt),
          );
        }
        render();
        // Keep the previously rendered map visible while the new safe-frame
        // scene is prepared off-DOM. Swapping only after the first completed
        // frame removes the blue blank state on selection and drill-down.
        canvasHost.replaceChildren(renderer.domElement);
        if (sceneHost) {
          sceneHost.dataset.firstRenderDurationMs = String(
            Math.round(window.performance.now() - geometryReadyAt),
          );
          sceneHost.dataset.geometryBuildDurationMs = String(
            Math.round(window.performance.now() - terrainReadyAt),
          );
          sceneHost.dataset.buildDurationMs = String(
            Math.round(window.performance.now() - buildStartedAt),
          );
          sceneHost.dataset.styleState = "ready";
        }
        callbacksRef.current.onReady();
        reportSelectionPosition(
          selectedRef.current ? terrainDetailProjection : terrainProjection,
          selectedRef.current,
          positionCallbackRef.current,
          stageWidth,
        );
      })
      .catch(() => {
        if (!disposed) callbacksRef.current.onUnavailable("地表纹理加载失败");
      });

    const eventTarget = (event: PointerEvent | MouseEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactiveMeshes, false)[0];
      return hit ? targetByObject.get(hit.object.uuid) : undefined;
    };
    const handleClick = (event: MouseEvent) => {
      const target = eventTarget(event);
      if (target) scheduleComponentSelection(target.region, target.componentId);
    };
    const handleDoubleClick = (event: MouseEvent) => {
      const target = eventTarget(event);
      if (target) drillImmediately(target.region);
    };
    const handlePointerMove = (event: PointerEvent) => {
      const target = eventTarget(event);
      renderer.domElement.style.cursor = target ? "pointer" : "default";
      hoverUpdateRef.current(target);
    };
    const handlePointerLeave = () => {
      renderer.domElement.style.cursor = "default";
      hoverUpdateRef.current(undefined);
    };
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      disposed = true;
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      resources.forEach((resource) => resource.dispose());
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      scene.traverse((object) => {
        const geometry = (object as { geometry?: THREE.BufferGeometry }).geometry;
        if (geometry?.isBufferGeometry && !disposedGeometries.has(geometry)) {
          disposedGeometries.add(geometry);
          geometry.dispose();
        }
      });
      // Renderer disposal releases Three.js resources but deliberately keeps
      // the browser WebGL context alive. A drill-down rebuilds this renderer;
      // explicitly lose the obsolete context so software WebGL runners and
      // long-lived workstations do not exhaust their finite context budget.
      renderer.forceContextLoss();
      renderer.dispose();
      componentReliefVisualsRef.current = new Map();
      primaryComponentByRegionRef.current = new Map();
      componentReliefUpdateRef.current = () => undefined;
      componentSelectionUpdateRef.current = () => undefined;
      pointMaterialsRef.current = new Map();
      renderRef.current = () => undefined;
      hoverUpdateRef.current = () => undefined;
      layoutUpdateRef.current = () => undefined;
      // Do not remove the last completed canvas here. A replacement effect
      // keeps it as a frozen visual fallback until its own first frame is ready;
      // on component unmount the host removes it with the React subtree.
    };
  }, [
    cancelLayoutTimer,
    terrainDetailProjection,
    drillImmediately,
    rendererProjectionDurationMs,
    renderedStageWidth,
    scheduleComponentSelection,
    scheduleSelection,
    stageWidth,
    terrainProjection,
  ]);

  return (
    <div
      className="overview-terrain-relief-map"
      data-command-stage-width={stageWidth}
      data-details-panel-left={overviewDetailsPanelLeft(stageWidth)}
      data-visible-surface-max-x={activeSurfaceBounds?.maxX}
      data-visible-surface-max-y={activeSurfaceBounds?.maxY}
      data-visible-surface-min-x={activeSurfaceBounds?.minX}
      data-visible-surface-min-y={activeSurfaceBounds?.minY}
    >
      <div
        className="overview-terrain-relief-canvas"
        ref={hostRef}
        style={{ width: renderedStageWidth }}
      />
      <div
        aria-label="行政区地图标签"
        className="overview-relief-label-layer"
        style={{ transform: `translateX(${wideStageOffset}px)` }}
      >
        {overlayLayout.labels
          .filter(({ region, visible }) => visible && !region.mapContextOnly)
          .map(({ componentId, footprint, kind, point, region, scale }) => {
            const identity = primaryComponentIdentity(activeProjection, region);
            const isLeaf = region.mapContextOnly || region.level === "VILLAGE";
            const selectedLift = region.code === selectedCode ? selectedOverlayLift : 0;
            const aggregate = aggregateByRegion.get(region.code);
            const visibleAggregateCount =
              samplePointAggregateStatus === "ready" &&
              aggregate &&
              aggregate.samplePointCount > 0
                ? aggregate.scopeKind === "PARENT_DIRECT"
                  ? `本级${aggregate.samplePointCount}个`
                  : `${aggregate.samplePointCount}个`
                : undefined;
            return (
              <Fragment key={`${kind}-${region.code}-${componentId ?? "point"}`}>
                <button
                  aria-label={reliefRegionLabel({
                    aggregate: aggregateByRegion.get(region.code),
                    isLeaf,
                    region,
                    status: samplePointAggregateStatus,
                  })}
                  className={`overview-relief-label is-${kind} is-${region.level.toLowerCase()}${kind === "region" || aggregateRegionCodes.has(region.code) ? " can-have-count" : ""}${aggregateRegionCodes.has(region.code) ? " has-sample-point-aggregate" : ""}${region.code === selectedCode ? " is-selected" : ""}`}
                  onClick={() =>
                    identity
                      ? scheduleComponentSelection(region, identity.componentId)
                      : scheduleSelection(region)
                  }
                  {...(!isLeaf
                    ? { onDoubleClick: () => drillImmediately(region) }
                    : {})}
                  onPointerEnter={() => hoverUpdateRef.current(identity)}
                  onPointerLeave={() => hoverUpdateRef.current(undefined)}
                  data-layout-scale={scale}
                  data-region-code={region.code}
                  style={{
                    left: point.x,
                    top: point.y - selectedLift,
                    width: footprint.width,
                    height: footprint.height,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="overview-relief-label-name">
                    {compactAdministrativeName(region.name)}
                  </span>
                  {visibleAggregateCount ? (
                    <span aria-hidden="true" className="overview-relief-label-count">
                      {visibleAggregateCount}
                    </span>
                  ) : null}
                </button>
              </Fragment>
            );
          })}
        {activeProjection.points
          .filter(({ region }) => region.level === "VILLAGE")
          .map(({ point, region }) => {
            const identity = primaryComponentIdentity(activeProjection, region);
            return (
              <button
                aria-label={`${region.name}，点击查看行政村详情`}
                className="overview-relief-point-hit"
                key={`point-hit-${region.code}`}
                onClick={() =>
                  identity
                    ? scheduleComponentSelection(region, identity.componentId)
                    : scheduleSelection(region)
                }
                onPointerEnter={() => hoverUpdateRef.current(identity)}
                onPointerLeave={() => hoverUpdateRef.current(undefined)}
                style={{ left: point.x, top: point.y }}
                type="button"
              >
                <span className="overview-sr-only">{region.name}</span>
              </button>
            );
          })}
        {overlayLayout.samplePointIcons
          .filter(({ visible }) => visible)
          .map(
            ({
              anchorPoint,
              glyphFootprint,
              glyphPlacement,
              glyphPolygonContained,
              icon,
              point,
              scale,
            }) => {
              const isDesignCoverage = icon.layerType === "DESIGN_COVERAGE_BADGE";
              const isDesignExact = icon.layerType === "DESIGN_EXACT_LOCATION";
              const isRegionalActual = icon.layerType === "REGIONAL_ACTUAL_BADGE";
              const isReferenceLayer = isDesignCoverage || isDesignExact;
              const expanded =
                Math.abs(anchorPoint.x - point.x) > 0.01 ||
                Math.abs(anchorPoint.y - point.y) > 0.01;
              const distance = Math.hypot(
                point.x - anchorPoint.x,
                point.y - anchorPoint.y,
              );
              const angle =
                (Math.atan2(point.y - anchorPoint.y, point.x - anchorPoint.x) * 180) /
                Math.PI;
              const domainClass = samplePointDomainClass(icon);
              const coordinateGroup = coordinateGroupBySamplePointId.get(
                icon.samplePointId,
              );
              return (
                <Fragment key={icon.samplePointId}>
                  {expanded && (
                    <>
                      <span
                        aria-hidden="true"
                        className="overview-sample-point-map-leader"
                        style={{
                          left: anchorPoint.x,
                          top: anchorPoint.y,
                          transform: `rotate(${angle}deg)`,
                          width: distance,
                        }}
                      />
                      <span
                        aria-hidden="true"
                        className="overview-sample-point-map-exact-anchor"
                        style={{ left: anchorPoint.x, top: anchorPoint.y }}
                      />
                    </>
                  )}
                  {isReferenceLayer || isRegionalActual ? (
                    <span
                      aria-label={sampleNetworkMarkerLabel(icon)}
                      className={`overview-sample-point-map-icon is-${icon.iconKey ?? "unknown"} is-layer-${(icon.layerType ?? "ANNUAL_ACTUAL").toLowerCase()}${domainClass}${icon.visualState ? ` is-${icon.visualState}` : ""}`}
                      data-anchor-latitude={icon.latitude ?? undefined}
                      data-anchor-longitude={icon.longitude ?? undefined}
                      data-layer-type={icon.layerType}
                      role="img"
                      style={{
                        left: point.x,
                        top: point.y,
                        borderRadius: "50%",
                        cursor: "default",
                        pointerEvents: "none",
                        transform: "translate(-50%, -50%)",
                        ...(icon.visualState === "muted" ? { opacity: 0.42 } : {}),
                      }}
                      title={sampleNetworkMarkerTitle(icon)}
                    >
                      <SamplePointMapSymbol
                        {...(icon.aggregateCount !== undefined
                          ? { aggregateCount: icon.aggregateCount }
                          : {})}
                        iconKey={icon.iconKey}
                        layerType={icon.layerType}
                        roles={icon.roles}
                      />
                    </span>
                  ) : (
                    <button
                      aria-label={`${icon.name}，${(icon.roles ?? []).map((role) => role.name).join("、")}${icon.types.length ? `，当前品种对象类型：${icon.types.map((type) => type.name).join("、")}` : "，当前品种暂无审核通过业务数据"}${coordinateGroup && coordinateGroup.count > 1 ? `，该真实坐标共有 ${coordinateGroup.count} 个正式样本身份` : ""}${expanded ? "，图标为区域内标注，引线起点是真实经纬度" : "，图标锚点是真实经纬度"}，点击查看样本点详情`}
                      aria-pressed={selectedSamplePointId === icon.samplePointId}
                      className={`overview-sample-point-map-icon is-${icon.iconKey ?? "unknown"} is-layer-${(icon.layerType ?? "ANNUAL_ACTUAL").toLowerCase()}${domainClass}${icon.dataQualityReason === "DUPLICATE_COORDINATE_UNVERIFIED" ? " has-coordinate-warning" : ""}${selectedSamplePointId === icon.samplePointId ? " is-selected" : ""}`}
                      data-anchor-latitude={icon.latitude ?? undefined}
                      data-anchor-longitude={icon.longitude ?? undefined}
                      data-coordinate-identity-count={coordinateGroup?.count ?? 1}
                      data-coordinate-identity-index={coordinateGroup?.index ?? 1}
                      data-glyph-placement={glyphPlacement}
                      data-glyph-polygon-contained={glyphPolygonContained}
                      data-glyph-positioning={
                        expanded ? "inset-callout" : "exact-anchor"
                      }
                      data-projected-anchor-x={anchorPoint.x}
                      data-projected-anchor-y={anchorPoint.y}
                      data-glyph-footprint-height={glyphFootprint.height}
                      data-glyph-footprint-width={glyphFootprint.width}
                      data-layout-scale={scale}
                      data-region-code={icon.regionCode}
                      data-layer-type={icon.layerType ?? "ANNUAL_ACTUAL"}
                      onClick={() => onSamplePointSelect?.(icon.samplePointId)}
                      style={{
                        left: point.x,
                        top: point.y,
                        zIndex: coordinateGroup?.index ?? 1,
                        ["--overview-icon-scale" as string]: scale,
                      }}
                      title={
                        expanded
                          ? "区域内样本标注；引线起点为真实经纬度；点击查看样本点详情"
                          : coordinateGroup && coordinateGroup.count > 1
                            ? `真实坐标同址 ${coordinateGroup.count} 个正式样本；点击查看当前样本详情`
                            : "真实经纬度位置；点击查看样本点详情"
                      }
                      type="button"
                    >
                      <SamplePointMapSymbol
                        {...(coordinateGroup &&
                        coordinateGroup.count > 1 &&
                        coordinateGroup.index === coordinateGroup.count
                          ? { aggregateCount: coordinateGroup.count }
                          : {})}
                        iconKey={icon.iconKey}
                        layerType={icon.layerType}
                        roles={icon.roles}
                      />
                    </button>
                  )}
                </Fragment>
              );
            },
          )}
        {!activeProjection.backdrop &&
          !activeProjection.features.length &&
          activeProjection.points.length > 0 && (
            <span className="overview-relief-governance-note">
              当前层级仅展示已治理真实坐标点
            </span>
          )}
      </div>
    </div>
  );
}

function sampleNetworkMarkerLabel(icon: OverviewSamplePointIcon): string {
  return sampleNetworkMarkerAccessibilityLabel(icon);
}

function sampleNetworkMarkerTitle(icon: OverviewSamplePointIcon): string {
  if (icon.layerType === "DESIGN_COVERAGE_BADGE") {
    return "行政村设计覆盖；展示分区不是权威边界";
  }
  if (icon.layerType === "DESIGN_EXACT_LOCATION") {
    return "原始设计样本点；已审核精确位置";
  }
  return `区域级现有样本；仅确认到${regionalActualLevelLabel(icon.representedRegionLevel)}，不绘制图钉`;
}

function regionalActualLevelLabel(
  level: OverviewSamplePointIcon["representedRegionLevel"],
): string {
  if (level === "PREFECTURE") return "地级市";
  if (level === "COUNTY") return "区县";
  if (level === "TOWNSHIP") return "乡镇";
  return "行政区域";
}

function reliefRegionLabel({
  aggregate,
  isLeaf,
  region,
  status,
}: {
  aggregate: OverviewSamplePointAggregate | undefined;
  isLeaf: boolean;
  region: OverviewRegion;
  status: "hidden" | "loading" | "ready" | "unavailable" | undefined;
}) {
  if (region.mapContextOnly) {
    return `${region.name}，点击查看非监测地图参考区域`;
  }
  const action = isLeaf ? "点击查看行政村详情" : "点击选中，双击进入下一级";
  if (status === "hidden") return `${region.name}，${action}`;
  if (status === "loading") return `${region.name}，样本点聚合数据加载中，${action}`;
  if (status === "unavailable" || (status === "ready" && aggregate === undefined)) {
    return `${region.name}，样本点聚合数据不可用，${action}`;
  }
  if (status === "ready" && aggregate) {
    return `${region.name}，${samplePointAggregateLabel(aggregate)}，${action}`;
  }
  if (region.approvedRecordCount === null) {
    return `${region.name}，年度业务统计加载中，${action}`;
  }
  return `${region.name}，已核定 ${region.approvedRecordCount} 个样本点，${action}`;
}

function SamplePointMapSymbol({
  aggregateCount,
  iconKey,
  layerType,
  roles,
}: {
  aggregateCount?: number;
  iconKey: string | undefined;
  layerType?: OverviewSamplePointIcon["layerType"];
  roles?: OverviewSamplePointIcon["roles"];
}) {
  if ((!layerType || layerType === "ANNUAL_ACTUAL") && roles?.length) {
    return (
      <>
        <span className="overview-sample-point-role-icons">
          {roles.map((role) => (
            <img
              alt=""
              aria-hidden="true"
              key={role.code}
              src={samplePointRoleAssetUrl[role.code]}
            />
          ))}
        </span>
        {aggregateCount && aggregateCount > 1 ? (
          <strong aria-hidden="true" className="overview-sample-point-map-count">
            {aggregateCount}
          </strong>
        ) : null}
      </>
    );
  }
  const pathData =
    layerType === "DESIGN_COVERAGE_BADGE"
      ? designCoverageBadgePathData
      : iconKey === "design-reference"
        ? designReferenceIconPathData
        : iconKey === "regional-actual"
          ? regionalActualBadgePathData
          : iconKey
            ? samplePointIconPathData[iconKey]
            : undefined;
  if (!pathData) return null;
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d={pathData} />
      </svg>
      {aggregateCount ? (
        <strong aria-hidden="true" className="overview-sample-point-map-count">
          {aggregateCount}
        </strong>
      ) : null}
    </>
  );
}

function samplePointDomainClass(icon: OverviewSamplePointIcon): string {
  const roles = new Set(icon.roles?.map(({ code }) => code) ?? []);
  if (roles.size > 1) return " is-domain-cross";
  if (roles.has("PRODUCTION")) return " is-domain-production";
  if (roles.has("MARKET")) return " is-domain-market";
  if (roles.has("LOGISTICS")) return " is-domain-logistics";
  return "";
}

export function createRetryableResourceLoader<T>(load: () => Promise<T>) {
  let cached: Promise<T> | undefined;
  return () => {
    if (cached) return cached;
    const request = Promise.resolve().then(load);
    const retryable = request.catch((error: unknown) => {
      if (cached === retryable) cached = undefined;
      throw error;
    });
    cached = retryable;
    return retryable;
  };
}

const loadTerrainImage = createRetryableResourceLoader(
  () =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      new THREE.ImageLoader().load(
        TERRAIN_URL,
        (image) => resolve(image),
        undefined,
        reject,
      );
    }),
);

export type ReliefGeometry = ReliefSurface | ReliefPlatform;

export interface ReliefRenderBodies {
  outlines: readonly ReliefSurface[];
  tops: readonly ReliefSurface[];
  walls: readonly ReliefGeometry[];
}

/**
 * Produces one non-overlapping render plan for the current administrative
 * level. Component groups own every interactive cap. The parent contributes
 * one recessed, non-interactive substrate at `substrateTop`, closing the real
 * ground below raised components without adding another administrative border
 * or a same-height selection overlay.
 */
export function selectReliefRenderBodies(
  scene: ReliefSceneProjection,
): ReliefRenderBodies {
  const wallBody = scene.backdrop ?? scene.platform;
  return {
    outlines: scene.features.length
      ? scene.features.filter(({ region }) => !region.mapContextOnly)
      : scene.backdrop
        ? [scene.backdrop]
        : [],
    tops: scene.backdrop ? [scene.backdrop] : [],
    walls: scene.features.length && wallBody ? [wallBody] : [],
  };
}

interface ReliefPolygonGeometry {
  polygons: readonly ReliefPolygon[];
}

function createSurfaceGeometries(surface: ReliefPolygonGeometry) {
  const geometries: THREE.ShapeGeometry[] = [];
  surface.polygons.forEach((polygon) => {
    const shape = toShape(polygon);
    if (!shape) return;
    const geometry = new THREE.ShapeGeometry(shape);
    applyScreenSpaceUvs(geometry);
    geometries.push(geometry);
  });
  return geometries;
}

function createOutlineGroup(
  surface: ReliefGeometry,
  material: LineMaterial,
  z: number,
) {
  const group = new THREE.Group();
  surface.polygons.forEach(({ rings }) =>
    rings
      .filter(({ isHole }) => !isHole)
      .forEach(({ points }) => {
        if (points.length < 2) return;
        const closed = sameReliefPoint(points[0], points.at(-1))
          ? points
          : [...points, points[0] as ReliefPoint];
        const positions = closed.flatMap((point) => {
          const world = screenToWorld(point);
          return [world.x, world.y, z];
        });
        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        const line = new Line2(geometry, material);
        line.computeLineDistances();
        line.frustumCulled = false;
        group.add(line);
      }),
  );
  return group;
}

function createUniqueOutlineGroup(
  surfaces: readonly ReliefGeometry[],
  material: LineMaterial,
  z: number,
  includeHoles: boolean,
) {
  const segments = new Map<
    string,
    {
      owners: Set<string>;
      position: readonly [number, number, number, number, number, number];
    }
  >();
  let duplicateSegmentCount = 0;
  surfaces.forEach((surface) => {
    const ownerRegionCode = "region" in surface ? surface.region.code : "";
    surface.polygons.forEach(({ rings }) =>
      rings
        .filter(({ isHole }) => includeHoles || !isHole)
        .forEach(({ points }) => {
          closedRingEdges(points).forEach(({ end, start }) => {
            const key = normalizedSegmentKey(start, end);
            const existing = segments.get(key);
            if (existing) {
              duplicateSegmentCount += 1;
              if (ownerRegionCode) existing.owners.add(ownerRegionCode);
              return;
            }
            const worldStart = screenToWorld(start);
            const worldEnd = screenToWorld(end);
            segments.set(key, {
              owners: new Set(ownerRegionCode ? [ownerRegionCode] : []),
              position: [worldStart.x, worldStart.y, z, worldEnd.x, worldEnd.y, z],
            });
          });
        }),
    );
  });
  const group = new THREE.Group();
  const geometry = new LineSegmentsGeometry();
  let line: LineSegments2 | undefined;
  if (segments.size) {
    const positions = [...segments.values()].flatMap(({ position }) => position);
    geometry.setPositions(positions);
    line = new LineSegments2(geometry, material);
    line.computeLineDistances();
    line.frustumCulled = false;
    group.add(line);
  }
  return {
    duplicateSegmentCount,
    group,
    setSuppressedRegion: (regionCode: string) => {
      if (!line) return;
      const visiblePositions = [...segments.values()]
        .filter(({ owners }) => shouldShowGroundOutlineSegment(owners, regionCode))
        .flatMap(({ position }) => position);
      geometry.setPositions(visiblePositions);
      line.computeLineDistances();
    },
  };
}

function normalizedSegmentKey(start: ReliefPoint, end: ReliefPoint) {
  const pointKey = ({ x, y }: ReliefPoint) =>
    `${Math.round(x * 2) / 2},${Math.round(y * 2) / 2}`;
  const left = pointKey(start);
  const right = pointKey(end);
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

export function shouldShowGroundOutlineSegment(
  ownerRegionCodes: Iterable<string>,
  raisedRegionCode: string,
) {
  return !raisedRegionCode || !new Set(ownerRegionCodes).has(raisedRegionCode);
}

function createOutlineMaterial({
  color,
  opacity,
  width,
}: {
  color: number;
  opacity: number;
  width: number;
}) {
  return new LineMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    linewidth: width,
    opacity,
    resolution: new THREE.Vector2(
      STAGE_WIDTH * RENDER_SCALE,
      STAGE_HEIGHT * RENDER_SCALE,
    ),
    transparent: opacity < 1,
    worldUnits: false,
  });
}

interface SolidReliefGeometries {
  tops: readonly THREE.ShapeGeometry[];
  walls: readonly THREE.BufferGeometry[];
}

/**
 * Build the sole movable terrain entity for one continuous administrative
 * component. Its top mesh is visible both at rest and while raised; interaction
 * changes this entity's transform and material instead of adding another cap.
 * The matching skirt uses the same polygon boundary and reaches back to the
 * component's original ground position.
 */
export function createMovableComponentGeometries(
  surface: ReliefGeometry,
): SolidReliefGeometries {
  return {
    tops: createSurfaceGeometries(surface),
    walls: createVisibleWallGeometries(
      [{ polygons: surface.polygons }],
      COMPONENT_HIGHLIGHT_LIFT,
    ),
  };
}

function createSolidReliefGroupFromGeometries(
  geometries: SolidReliefGeometries,
  topMaterial: THREE.Material,
  sideMaterial: THREE.Material,
  topZ: number = RELIEF_LAYER_Z.baseTop,
) {
  const group = new THREE.Group();
  geometries.walls.forEach((geometry) => {
    const mesh = new THREE.Mesh(geometry, sideMaterial);
    mesh.position.z = 0;
    mesh.renderOrder = 2;
    group.add(mesh);
  });
  geometries.tops.forEach((geometry) => {
    const mesh = new THREE.Mesh(geometry, topMaterial);
    mesh.position.z = topZ;
    mesh.renderOrder = 3;
    group.add(mesh);
  });
  return group;
}

interface VisibleWallEdge {
  end: ReliefPoint;
  start: ReliefPoint;
}

export interface WallCompletenessMetrics {
  completeness: number;
  expectedEdgeCount: number;
  expectedPerimeter: number;
  generatedEdgeCount: number;
  generatedPerimeter: number;
  holeWallEdgeCount: number;
  zeroLengthEdgeCount: number;
}

export function measureWallCompleteness(
  surface: ReliefSurface,
): WallCompletenessMetrics {
  const expectedEdges = foregroundBoundaryChains(
    uniqueOuterBoundaryEdges(
      surface.wallPolygons.flatMap((polygon) =>
        polygon.rings
          .filter(({ isHole }) => !isHole)
          .flatMap(({ points }) => closedRingEdges(clockwiseReliefRing(points))),
      ),
    ),
  );
  const generatedEdges = foregroundBoundaryChains(
    uniqueOuterBoundaryEdges(collectVisibleWallEdges([surface])[0] ?? []),
  );
  const perimeter = (edges: readonly VisibleWallEdge[]) =>
    edges.reduce(
      (sum, { end, start }) => sum + Math.hypot(end.x - start.x, end.y - start.y),
      0,
    );
  const expectedPerimeter = perimeter(expectedEdges);
  const generatedPerimeter = perimeter(generatedEdges);
  return {
    completeness: expectedPerimeter > 0 ? generatedPerimeter / expectedPerimeter : 1,
    expectedEdgeCount: expectedEdges.length,
    expectedPerimeter,
    generatedEdgeCount: generatedEdges.length,
    generatedPerimeter,
    holeWallEdgeCount: 0,
    zeroLengthEdgeCount: generatedEdges.filter(
      ({ end, start }) => Math.hypot(end.x - start.x, end.y - start.y) < 0.75,
    ).length,
  };
}

export function createVisibleWallGeometries(
  surfaces: readonly ReliefGeometry[],
  depth: number,
): THREE.BufferGeometry[] {
  return collectVisibleWallEdges(surfaces)
    .map((edges) => createNonIndexedWallGeometry(edges, depth))
    .filter((geometry): geometry is THREE.BufferGeometry => Boolean(geometry));
}

function collectVisibleWallEdges(surfaces: readonly ReliefGeometry[]) {
  return surfaces.map((surface) => {
    const wallPolygons =
      "wallPolygons" in surface ? surface.wallPolygons : surface.polygons;
    return wallPolygons.flatMap((polygon) =>
      polygon.rings
        .filter(({ isHole }) => !isHole)
        .flatMap(({ points }) => closedRingEdges(clockwiseReliefRing(points))),
    );
  });
}

function clockwiseReliefRing(points: readonly ReliefPoint[]) {
  let signedArea = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    if (next) signedArea += point.x * next.y - next.x * point.y;
  });
  return signedArea > 0 ? [...points].reverse() : points;
}

function closedRingEdges(points: readonly ReliefPoint[]): VisibleWallEdge[] {
  const open = sameReliefPoint(points[0], points.at(-1))
    ? points.slice(0, -1)
    : [...points];
  if (open.length < 2) return [];
  return open.flatMap((start, index) => {
    const end = open[(index + 1) % open.length];
    if (!end || Math.hypot(end.x - start.x, end.y - start.y) <= Number.EPSILON)
      return [];
    return [{ end, start }];
  });
}

function createNonIndexedWallGeometry(
  edges: readonly VisibleWallEdge[],
  depth: number,
): THREE.BufferGeometry | undefined {
  // Keep exact governed segments that lie on the screen-space foreground
  // envelope. Unlike the former sampled silhouette, this never interpolates,
  // bridges concavities, or turns a nearly vertical rear edge into a wall shard.
  const visibleEdges = foregroundBoundaryChains(uniqueOuterBoundaryEdges(edges));
  if (!visibleEdges.length) return undefined;
  const positions: number[] = [];
  const shades: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertexByPosition = new Map<string, number>();
  const wallXs = visibleEdges.flatMap(({ end, start }) => [start.x, end.x]);
  const minWallX = Math.min(...wallXs);
  const maxWallX = Math.max(...wallXs);
  const wallWidth = Math.max(maxWallX - minWallX, 1);
  const minWallWorldX = minWallX - STAGE_WIDTH / 2;
  const shadeAt = (point: ReliefPoint) => {
    // One continuous light field replaces per-edge lighting. Short real-world
    // boundary segments no longer become alternating bright/dark wall strips.
    return 0.84 + ((point.x - minWallWorldX) / wallWidth) * 0.12;
  };
  const vertex = (point: ReliefPoint, z: number, depthUv: number) => {
    const key = `${point.x}:${point.y}:${z}`;
    const existing = vertexByPosition.get(key);
    if (existing !== undefined) return existing;
    const index = positions.length / 3;
    positions.push(point.x, point.y, z);
    uvs.push(0, depthUv);
    shades.push(shadeAt(point));
    vertexByPosition.set(key, index);
    return index;
  };
  visibleEdges.forEach(({ end, start }) => {
    // The top cap and wall use identical projected vertices. Snapping only the
    // wall shifted it away from the real boundary and opened visible cracks.
    const topStart = screenToWorld(start);
    const topEnd = screenToWorld(end);
    const bottomZ = -depth;
    const topStartIndex = vertex(topStart, 0, 0);
    const bottomStartIndex = vertex(topStart, bottomZ, 1);
    const topEndIndex = vertex(topEnd, 0, 0);
    const bottomEndIndex = vertex(topEnd, bottomZ, 1);
    indices.push(
      topStartIndex,
      bottomStartIndex,
      topEndIndex,
      topEndIndex,
      bottomStartIndex,
      bottomEndIndex,
    );
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("wallShade", new THREE.Float32BufferAttribute(shades, 1));
  return geometry;
}

function uniqueOuterBoundaryEdges(
  edges: readonly VisibleWallEdge[],
): VisibleWallEdge[] {
  const matchesBySegment = new Map<string, VisibleWallEdge[]>();
  const pointKey = ({ x, y }: ReliefPoint) => `${x.toFixed(6)},${y.toFixed(6)}`;
  edges.forEach((edge) => {
    const start = pointKey(edge.start);
    const end = pointKey(edge.end);
    const key = start < end ? `${start}|${end}` : `${end}|${start}`;
    const matches = matchesBySegment.get(key) ?? [];
    matches.push(edge);
    matchesBySegment.set(key, matches);
  });
  // Shared edges inside one solid occur twice and are not outside walls.
  // Unmatched edges are emitted verbatim—never interpolated or bridged.
  return [...matchesBySegment.values()].flatMap((matches) =>
    matches.length % 2 === 1 ? [matches[0] as VisibleWallEdge] : [],
  );
}

function foregroundBoundaryChains(
  edges: readonly VisibleWallEdge[],
): VisibleWallEdge[] {
  const edgeIndicesByPoint = new Map<string, number[]>();
  const pointKey = ({ x, y }: ReliefPoint) => `${x.toFixed(6)},${y.toFixed(6)}`;
  edges.forEach((edge, index) => {
    [edge.start, edge.end].forEach((point) => {
      const key = pointKey(point);
      const indices = edgeIndicesByPoint.get(key) ?? [];
      indices.push(index);
      edgeIndicesByPoint.set(key, indices);
    });
  });
  const used = new Set<number>();
  const foreground: VisibleWallEdge[] = [];
  edges.forEach((seed, seedIndex) => {
    if (used.has(seedIndex)) return;
    used.add(seedIndex);
    const points: ReliefPoint[] = [seed.start, seed.end];
    let current = seed.end;
    for (let guard = 0; guard <= edges.length; guard += 1) {
      if (sameReliefPoint(current, points[0])) break;
      const nextIndex = (edgeIndicesByPoint.get(pointKey(current)) ?? []).find(
        (index) => !used.has(index),
      );
      if (nextIndex === undefined) break;
      const nextEdge = edges[nextIndex];
      if (!nextEdge) break;
      used.add(nextIndex);
      current = sameReliefPoint(nextEdge.start, current)
        ? nextEdge.end
        : nextEdge.start;
      points.push(current);
    }
    if (points.length >= 4 && sameReliefPoint(points[0], points.at(-1))) {
      foreground.push(...foregroundRingChain(points));
    }
  });
  return foreground;
}

function foregroundRingChain(points: readonly ReliefPoint[]) {
  const clockwise = clockwiseReliefRing(points);
  const open = sameReliefPoint(clockwise[0], clockwise.at(-1))
    ? clockwise.slice(0, -1)
    : [...clockwise];
  if (open.length < 3) return [];
  const extremeIndex = (side: "left" | "right") =>
    open.reduce((chosen, point, index) => {
      const current = open[chosen];
      if (!current) return index;
      if (side === "left" && point.x < current.x - 0.001) return index;
      if (side === "right" && point.x > current.x + 0.001) return index;
      if (Math.abs(point.x - current.x) <= 0.001 && point.y > current.y) return index;
      return chosen;
    }, 0);
  const left = extremeIndex("left");
  const right = extremeIndex("right");
  const path = (from: number, to: number) => {
    const result: VisibleWallEdge[] = [];
    let index = from;
    while (index !== to && result.length <= open.length) {
      const nextIndex = (index + 1) % open.length;
      const start = open[index];
      const end = open[nextIndex];
      if (!start || !end) break;
      result.push({ end, start });
      index = nextIndex;
    }
    return result;
  };
  const first = path(left, right);
  const second = path(right, left);
  const averageY = (candidate: readonly VisibleWallEdge[]) => {
    const weights = candidate.map(({ end, start }) =>
      Math.max(Math.abs(end.x - start.x), 0.001),
    );
    const weight = weights.reduce((sum, value) => sum + value, 0);
    return (
      candidate.reduce(
        (sum, { end, start }, index) =>
          sum + ((start.y + end.y) / 2) * (weights[index] ?? 0),
        0,
      ) / Math.max(weight, 0.001)
    );
  };
  return averageY(first) >= averageY(second) ? first : second;
}

function primaryComponentIdentity(
  projection: ReliefSceneProjection,
  region: OverviewRegion,
): ReliefComponentIdentity | undefined {
  const surface = [
    ...projection.features,
    ...(projection.backdrop ? [projection.backdrop] : []),
  ].find((candidate) => candidate.region.code === region.code);
  if (!surface) return undefined;
  return {
    componentId: surface.primaryPolygonIndex,
    level: region.level,
    parentCode: region.parentCode,
    regionCode: region.code,
  };
}

function calculateLayoutTransform(
  source: ReliefSceneProjection,
  target: ReliefSceneProjection,
): ReliefLayoutTransform {
  const sourceBounds = reliefSceneBounds(source);
  const targetBounds = reliefSceneBounds(target);
  if (!sourceBounds || !targetBounds) return IDENTITY_LAYOUT_TRANSFORM;
  const sourceWidth = Math.max(sourceBounds.maxX - sourceBounds.minX, 1);
  const sourceHeight = Math.max(sourceBounds.maxY - sourceBounds.minY, 1);
  const scaleX = (targetBounds.maxX - targetBounds.minX) / sourceWidth;
  const scaleY = (targetBounds.maxY - targetBounds.minY) / sourceHeight;
  const screenOffsetX = targetBounds.minX - sourceBounds.minX * scaleX;
  const screenOffsetY = targetBounds.minY - sourceBounds.minY * scaleY;
  return {
    scaleX,
    scaleY,
    screenOffsetX,
    screenOffsetY,
    uvOffsetX: screenOffsetX / STAGE_WIDTH,
    uvOffsetY: 1 - scaleY - screenOffsetY / STAGE_HEIGHT,
    worldOffsetX: scaleX * (STAGE_WIDTH / 2) + screenOffsetX - STAGE_WIDTH / 2,
    worldOffsetY: (STAGE_HEIGHT / 2) * (1 - scaleY) - screenOffsetY,
  };
}

export function applyReliefLayoutMatrix(
  root: THREE.Group,
  transform: ReliefLayoutTransform,
) {
  // matrixAutoUpdate is disabled so the oblique z projection and the
  // details-open safe-frame transform must be composed explicitly. Calling
  // root.scale/position alone leaves the canvas in the old frame while HTML
  // labels move to the new one, which makes a correct region look misbound.
  root.matrix.set(
    transform.scaleX,
    0,
    0,
    transform.worldOffsetX,
    0,
    transform.scaleY,
    transform.scaleY * RELIEF_OBLIQUE_SHEAR,
    transform.worldOffsetY,
    0,
    -transform.scaleY * RELIEF_OBLIQUE_SHEAR,
    1,
    0,
    0,
    0,
    0,
    1,
  );
  root.matrixWorldNeedsUpdate = true;
}

/**
 * Refit one already projected scene into another safe frame. Both the normal
 * and detail layouts use the same source bounds, so their relationship is an
 * affine screen transform. Re-running GeoJSON parsing, Turf union and ring
 * simplification for the detail drawer made the first interaction pay the
 * entire map-projection cost twice.
 */
export function reframeReliefScene(
  source: ReliefSceneProjection,
  targetFrame: ReliefSceneProjection["frame"],
): ReliefSceneProjection {
  const transform = calculateFrameTransform(source, targetFrame);
  const point = ({ x, y }: ReliefPoint): ReliefPoint => ({
    x: x * transform.scaleX + transform.screenOffsetX,
    y: y * transform.scaleY + transform.screenOffsetY,
  });
  const polygons = (value: readonly ReliefPolygon[]): ReliefPolygon[] =>
    value.map(({ rings }) => ({
      rings: rings.map((ring) => ({
        ...ring,
        points: ring.points.map(point),
      })),
    }));
  const surface = (value: ReliefSurface): ReliefSurface => {
    const projectedPolygons = polygons(value.polygons);
    const wallPolygonIndices = new Set(
      value.wallPolygons.map((wallPolygon) => value.polygons.indexOf(wallPolygon)),
    );
    return {
      ...value,
      anchor: point(value.anchor),
      hitPolygons: polygons(value.hitPolygons),
      polygons: projectedPolygons,
      raiseablePolygonIndices: value.raiseablePolygonIndices,
      wallPolygons: projectedPolygons.filter((_, index) =>
        wallPolygonIndices.has(index),
      ),
    };
  };

  return {
    ...(source.backdrop ? { backdrop: surface(source.backdrop) } : {}),
    ...(source.diagnostics ? { diagnostics: source.diagnostics } : {}),
    features: source.features.map(surface),
    frame: targetFrame,
    labels: source.labels.map((label) => ({ ...label, point: point(label.point) })),
    ...(source.platform
      ? { platform: { polygons: polygons(source.platform.polygons) } }
      : {}),
    points: source.points.map((location) => ({
      ...location,
      point: point(location.point),
    })),
    samplePointAggregates: source.samplePointAggregates.map((samplePoint) => ({
      ...samplePoint,
      point: point(samplePoint.point),
    })),
    samplePointIcons: source.samplePointIcons.map((samplePoint) => ({
      ...samplePoint,
      anchorPoint: point(samplePoint.anchorPoint),
      point: point(samplePoint.point),
    })),
  };
}

function calculateFrameTransform(
  source: ReliefSceneProjection,
  targetFrame: ReliefSceneProjection["frame"],
): ReliefLayoutTransform {
  const sourceBounds = reliefSceneBounds(source);
  if (!sourceBounds) return IDENTITY_LAYOUT_TRANSFORM;
  const sourceWidth = Math.max(sourceBounds.maxX - sourceBounds.minX, 1);
  const sourceHeight = Math.max(sourceBounds.maxY - sourceBounds.minY, 1);
  const sourceCompression = source.frame.width < 1300 ? 0.7 : 0.62;
  const targetCompression = targetFrame.width < 1300 ? 0.7 : 0.62;
  const targetAspect =
    (sourceHeight / sourceWidth / sourceCompression) * targetCompression;
  const availableWidth = targetFrame.width * (1 - RELIEF_FRAME_INSET * 2);
  const availableHeight = targetFrame.height * (1 - RELIEF_FRAME_INSET * 2);
  const targetWidth = Math.min(availableWidth, availableHeight / targetAspect);
  const targetHeight = targetWidth * targetAspect;
  const targetMinX = targetFrame.x + (targetFrame.width - targetWidth) / 2;
  const targetMinY =
    targetFrame.y +
    (targetFrame.height - targetHeight) / 2 -
    (targetFrame.width < 1300 ? 12 : 0);
  const scaleX = targetWidth / sourceWidth;
  const scaleY = targetHeight / sourceHeight;
  const screenOffsetX = targetMinX - sourceBounds.minX * scaleX;
  const screenOffsetY = targetMinY - sourceBounds.minY * scaleY;
  return {
    scaleX,
    scaleY,
    screenOffsetX,
    screenOffsetY,
    uvOffsetX: screenOffsetX / STAGE_WIDTH,
    uvOffsetY: 1 - scaleY - screenOffsetY / STAGE_HEIGHT,
    worldOffsetX: scaleX * (STAGE_WIDTH / 2) + screenOffsetX - STAGE_WIDTH / 2,
    worldOffsetY: (STAGE_HEIGHT / 2) * (1 - scaleY) - screenOffsetY,
  };
}

function reliefSceneBounds(scene: ReliefSceneProjection) {
  const bodies: readonly ReliefGeometry[] = scene.backdrop
    ? [scene.backdrop]
    : scene.platform
      ? [scene.platform]
      : scene.features;
  const points = bodies.flatMap(({ polygons }) =>
    polygons.flatMap(({ rings }) => rings.flatMap((ring) => ring.points)),
  );
  if (!points.length) {
    points.push(...scene.points.map(({ point }) => point));
  }
  if (!points.length) return undefined;
  return {
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y)),
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
  };
}

function countProjectedVertices(scene: ReliefSceneProjection) {
  const surfaces: readonly ReliefGeometry[] = [
    ...(scene.backdrop ? [scene.backdrop] : []),
    ...(scene.platform ? [scene.platform] : []),
    ...scene.features,
  ];
  return surfaces.reduce(
    (count, surface) =>
      count +
      surface.polygons.reduce(
        (polygonCount, polygon) =>
          polygonCount +
          polygon.rings.reduce((ringCount, ring) => ringCount + ring.points.length, 0),
        0,
      ),
    0,
  );
}

function countEarthVertices(scene: ReliefSceneProjection) {
  const earthBodies = selectReliefRenderBodies(scene).tops;
  return earthBodies.reduce(
    (count, earth) =>
      count +
      earth.polygons.reduce(
        (polygonCount, polygon) =>
          polygonCount +
          polygon.rings.reduce((ringCount, ring) => ringCount + ring.points.length, 0),
        0,
      ),
    0,
  );
}

function countHitTestVertices(scene: ReliefSceneProjection) {
  const surfaces = [...scene.features, ...(scene.backdrop ? [scene.backdrop] : [])];
  return surfaces.reduce(
    (count, surface) =>
      count +
      surface.hitPolygons.reduce(
        (polygonCount, polygon) =>
          polygonCount +
          polygon.rings.reduce((ringCount, ring) => ringCount + ring.points.length, 0),
        0,
      ),
    0,
  );
}

function updateTerrainUvTransform(
  material: THREE.ShaderMaterial,
  transform: ReliefLayoutTransform,
) {
  const scale = material.uniforms.terrainUvScale?.value as THREE.Vector2 | undefined;
  const offset = material.uniforms.terrainUvOffset?.value as THREE.Vector2 | undefined;
  scale?.set(transform.scaleX, transform.scaleY);
  offset?.set(transform.uvOffsetX, transform.uvOffsetY);
}

function toShape(polygon: ReliefPolygon) {
  const outer = polygon.rings.find((ring) => !ring.isHole)?.points;
  if (!outer || outer.length < 3) return undefined;
  const shape = new THREE.Shape();
  drawPath(shape, outer);
  polygon.rings
    .filter((ring) => ring.isHole)
    .forEach(({ points }) => {
      if (points.length < 3) return;
      const hole = new THREE.Path();
      drawPath(hole, points);
      shape.holes.push(hole);
    });
  return shape;
}

function drawPath(path: THREE.Path, points: readonly ReliefPoint[]) {
  const first = points[0];
  if (!first) return;
  const start = screenToWorld(first);
  path.moveTo(start.x, start.y);
  points.slice(1).forEach((point) => {
    const world = screenToWorld(point);
    path.lineTo(world.x, world.y);
  });
  path.closePath();
}

function applyScreenSpaceUvs(geometry: THREE.ShapeGeometry) {
  const positions = geometry.getAttribute("position");
  const uv: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    uv.push(
      (positions.getX(index) + STAGE_WIDTH / 2) / STAGE_WIDTH,
      (positions.getY(index) + STAGE_HEIGHT / 2) / STAGE_HEIGHT,
    );
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

function screenToWorld(point: ReliefPoint) {
  return {
    x: point.x - STAGE_WIDTH / 2,
    y: STAGE_HEIGHT / 2 - point.y,
  };
}

function sameReliefPoint(left?: ReliefPoint, right?: ReliefPoint) {
  return Boolean(left && right && left.x === right.x && left.y === right.y);
}

function reportSelectionPosition(
  scene: ReliefSceneProjection,
  selectedCode: string,
  callback: ((position: OverviewMapSelectionPoint | undefined) => void) | undefined,
  stageWidth: number,
) {
  if (!callback) return;
  const surface =
    scene.features.find(({ region }) => region.code === selectedCode) ??
    (scene.backdrop?.region.code === selectedCode ? scene.backdrop : undefined);
  const point = scene.points.find(({ region }) => region.code === selectedCode);
  const anchor = surface?.anchor ?? point?.point;
  callback(
    anchor
      ? {
          height: STAGE_HEIGHT,
          width: stageWidth,
          x: anchor.x + overviewWideStageOffset(Math.max(STAGE_WIDTH, stageWidth)),
          y: anchor.y,
        }
      : undefined,
  );
}
