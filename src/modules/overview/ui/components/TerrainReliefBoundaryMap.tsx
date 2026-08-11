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
const TERRAIN_URL = "/overview/command-terrain-v2.webp";
const BACKGROUND_Z = -900;
// Keep hit/line overlays just above the textured top. A very large z value
// makes internal boundaries render through the parent's vertical wall.
const OVERLAY_Z = 4;

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
  onSelect,
  onSelectionPosition,
  onUnavailable,
  points,
  samplePointAggregates = [],
  samplePointAggregateStatus,
  samplePointIcons = [],
  selectedCode,
}: {
  backdrop?: MapFeature;
  command?: OverviewMapCommand;
  features: readonly MapFeature[];
  onDrill: (region: OverviewRegion) => void;
  onReady: () => void;
  onSelect: (region: OverviewRegion) => void;
  onSelectionPosition?: (position: OverviewMapSelectionPoint | undefined) => void;
  onUnavailable: (reason: string) => void;
  points: readonly MapPointFeature[];
  samplePointAggregates?: readonly OverviewSamplePointAggregate[];
  samplePointAggregateStatus?: "hidden" | "loading" | "ready" | "unavailable";
  samplePointIcons?: readonly OverviewSamplePointIcon[];
  selectedCode: string;
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
  const detailLayoutOpenRef = useRef(false);
  const [stageWidth, setStageWidth] = useState(commandStageWidth);
  const fullMapFrame = useMemo(() => overviewReliefFrame(false), []);
  const detailMapFrame = useMemo(
    () => overviewReliefFrame(true, stageWidth),
    [stageWidth],
  );
  const sceneProjectionResult = useMemo(() => {
    const startedAt = window.performance.now();
    const projection = projectReliefScene({
      ...(backdrop ? { backdrop } : {}),
      features,
      frame: fullMapFrame,
      points,
      samplePointAggregates,
      samplePointIcons,
    });
    return {
      duration: window.performance.now() - startedAt,
      projection,
    };
  }, [
    backdrop,
    features,
    fullMapFrame,
    points,
    samplePointAggregates,
    samplePointIcons,
  ]);
  const sceneProjection = sceneProjectionResult.projection;
  const detailProjectionResult = useMemo(() => {
    const startedAt = window.performance.now();
    const projection = reframeReliefScene(sceneProjection, detailMapFrame);
    return {
      duration: window.performance.now() - startedAt,
      projection,
    };
  }, [detailMapFrame, sceneProjection]);
  const detailProjection = detailProjectionResult.projection;
  const projectionDurationMs =
    sceneProjectionResult.duration + detailProjectionResult.duration;
  const activeProjection = detailLayoutOpen ? detailProjection : sceneProjection;
  const activeSurfaceBounds = reliefSceneBounds(activeProjection);
  const activeLayoutTransform = detailLayoutOpen
    ? calculateLayoutTransform(sceneProjection, detailProjection)
    : IDENTITY_LAYOUT_TRANSFORM;
  const selectedOverlayLift = COMPONENT_HIGHLIGHT_LIFT * activeLayoutTransform.scaleY;
  const overlayLayout = useMemo(
    () => createReliefOverlayLayout(activeProjection, selectedCode),
    [activeProjection, selectedCode],
  );
  const aggregateRegionCodes = new Set(
    activeProjection.samplePointAggregates.map(({ aggregate }) => aggregate.regionCode),
  );
  const aggregateCountByRegion = new Map(
    activeProjection.samplePointAggregates.map(({ aggregate }) => [
      aggregate.regionCode,
      aggregate.samplePointCount,
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
    detailLayoutOpenRef.current = detailLayoutOpen;
  }, [detailLayoutOpen]);

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
    layoutUpdateRef.current(detailLayoutOpen);
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
  }, [activeProjection, detailLayoutOpen, selectedCode, stageWidth]);

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
    renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT, false);
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
      sceneHost.dataset.reliefMode = sceneProjection.backdrop
        ? "continuous-backdrop"
        : sceneProjection.features.length
          ? "real-feature-fallback"
          : "empty";
      sceneHost.dataset.featureCount = String(sceneProjection.features.length);
      sceneHost.dataset.pointCount = String(sceneProjection.points.length);
      sceneHost.dataset.rendererInitDurationMs = String(
        Math.round(window.performance.now() - buildStartedAt),
      );
      sceneHost.dataset.projectionDurationMs = String(Math.round(projectionDurationMs));
      if (sceneProjection.diagnostics) {
        sceneHost.dataset.projectionSourceBoundsMs = String(
          Math.round(sceneProjection.diagnostics.sourceBoundsMs),
        );
        sceneHost.dataset.projectionSurfaceMs = String(
          Math.round(sceneProjection.diagnostics.surfaceProjectionMs),
        );
        sceneHost.dataset.projectionUnionMs = String(
          Math.round(sceneProjection.diagnostics.unionMs),
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
      -STAGE_WIDTH / 2,
      STAGE_WIDTH / 2,
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

    const render = () => {
      if (!disposed) renderer.render(scene, camera);
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

        const backgroundGeometry = new THREE.PlaneGeometry(STAGE_WIDTH, STAGE_HEIGHT);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ map: terrainTexture });
        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.position.z = BACKGROUND_Z;
        scene.add(background);
        resources.push(backgroundGeometry, backgroundMaterial);

        const hazeGeometry = new THREE.PlaneGeometry(STAGE_WIDTH, STAGE_HEIGHT);
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
        const renderBodies = selectReliefRenderBodies(sceneProjection);
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
            sceneHost.dataset.parentOuterLayerCount = sceneProjection.backdrop
              ? "1"
              : "0";
          }
        }

        const selectableSurfaces = new Map<string, ReliefSurface>();
        sceneProjection.features
          .filter(({ region }) => !region.mapContextOnly)
          .forEach((surface) => selectableSurfaces.set(surface.region.code, surface));
        if (!sceneProjection.features.length && sceneProjection.backdrop) {
          selectableSurfaces.set(
            sceneProjection.backdrop.region.code,
            sceneProjection.backdrop,
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
          sceneProjection.features.length && sceneProjection.backdrop
            ? [...renderBodies.outlines, sceneProjection.backdrop]
            : renderBodies.outlines;
        const activeOutline = createUniqueOutlineGroup(
          groundOutlineSurfaces,
          outlineMaterial,
          RELIEF_LAYER_Z.baseOutline,
          false,
        );
        reliefRoot.add(activeOutline.group);
        if (sceneHost) {
          sceneHost.dataset.parentOutlineLayerCount = sceneProjection.backdrop
            ? "1"
            : "0";
          sceneHost.dataset.childrenInternalLayerCount = sceneProjection.features.length
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
          render();
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

        sceneProjection.points.forEach(({ point, region }) => {
          const densePoints = sceneProjection.points.length > 32;
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
            ? calculateLayoutTransform(sceneProjection, detailProjection)
            : IDENTITY_LAYOUT_TRANSFORM;
          applyReliefLayoutMatrix(reliefRoot, transform);
          surfaceMaterials.forEach((material) =>
            updateTerrainUvTransform(material, transform),
          );
          render();
        };
        layoutUpdateRef.current(detailLayoutOpenRef.current);

        const geometryReadyAt = window.performance.now();
        if (sceneHost) {
          sceneHost.dataset.projectedVertexCount = String(
            countProjectedVertices(sceneProjection),
          );
          sceneHost.dataset.earthVertexCount = String(
            countEarthVertices(sceneProjection),
          );
          sceneHost.dataset.hitTestVertexCount = String(
            countHitTestVertices(sceneProjection),
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
          selectedRef.current ? detailProjection : sceneProjection,
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
    detailProjection,
    drillImmediately,
    projectionDurationMs,
    sceneProjection,
    scheduleComponentSelection,
    scheduleSelection,
    stageWidth,
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
      <div className="overview-terrain-relief-canvas" ref={hostRef} />
      <div aria-label="行政区地图标签" className="overview-relief-label-layer">
        {overlayLayout.labels
          .filter(({ region, visible }) => visible && !region.mapContextOnly)
          .map(({ componentId, kind, point, region, scale }) => {
            const identity = primaryComponentIdentity(activeProjection, region);
            const isLeaf = region.mapContextOnly || region.level === "VILLAGE";
            const selectedLift = region.code === selectedCode ? selectedOverlayLift : 0;
            return (
              <Fragment key={`${kind}-${region.code}-${componentId ?? "point"}`}>
                <button
                  aria-label={reliefRegionLabel({
                    aggregateCount: aggregateCountByRegion.get(region.code),
                    isLeaf,
                    region,
                    status: samplePointAggregateStatus,
                  })}
                  className={`overview-relief-label is-${kind} is-${region.level.toLowerCase()}${aggregateRegionCodes.has(region.code) ? " has-sample-point-aggregate" : ""}${region.code === selectedCode ? " is-selected" : ""}`}
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
                    transform: `translate(-50%, -50%) scale(${scale})`,
                  }}
                  type="button"
                >
                  <span aria-hidden="true">
                    {compactAdministrativeName(region.name)}
                  </span>
                </button>
              </Fragment>
            );
          })}
        {overlayLayout.samplePointAggregates
          .filter(({ visible }) => visible)
          .map(({ aggregate, point, scale }) => (
            <span
              aria-hidden="true"
              className="overview-sample-point-aggregate-marker"
              data-layout-scale={scale}
              data-region-code={aggregate.regionCode}
              key={`sample-point-aggregate-${aggregate.regionCode}`}
              style={{
                left: point.x,
                top:
                  point.y -
                  (aggregate.regionCode === selectedCode ? selectedOverlayLift : 0),
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            >
              <strong>{aggregate.samplePointCount}</strong>
              <small>样本点</small>
            </span>
          ))}
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
        {activeProjection.samplePointIcons.map(({ icon, point }) => (
          <span
            aria-label={`${icon.name}，${icon.types.map((type) => type.name).join("、")}，地图位置`}
            className={`overview-sample-point-map-icon is-${samplePointSymbolKind(icon)}`}
            key={icon.samplePointId}
            role="img"
            style={{ left: point.x, top: point.y }}
          >
            <SamplePointMapSymbol kind={samplePointSymbolKind(icon)} />
          </span>
        ))}
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

function reliefRegionLabel({
  aggregateCount,
  isLeaf,
  region,
  status,
}: {
  aggregateCount: number | undefined;
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
  if (
    status === "unavailable" ||
    (status === "ready" && aggregateCount === undefined)
  ) {
    return `${region.name}，样本点聚合数据不可用，${action}`;
  }
  const count = status === "ready" ? aggregateCount : region.approvedRecordCount;
  return `${region.name}，已核定 ${count} 个样本点，${action}`;
}

type SamplePointSymbolKind = "agriculture" | "civic" | "facility" | "rail" | "road";

function samplePointSymbolKind(icon: OverviewSamplePointIcon): SamplePointSymbolKind {
  const identity = icon.types
    .flatMap(({ code, name }) => [code, name])
    .join(" ")
    .toUpperCase();
  if (/RAIL|TRAIN|铁路|火车/.test(identity)) return "rail";
  if (/ROAD|HIGHWAY|TRUCK|公路|物流/.test(identity)) return "road";
  if (/VILLAGE|COMMITTEE|GOV|村委/.test(identity)) return "civic";
  if (/FARMER|AGRI|农户|农技/.test(identity)) return "agriculture";
  return "facility";
}

function SamplePointMapSymbol({ kind }: { kind: SamplePointSymbolKind }) {
  if (kind === "agriculture") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 21V6m0 5C8 10 6.5 7.5 6.5 5 10 5 12 7.3 12 11Zm0 4c4-1 5.5-3.5 5.5-6-3.5 0-5.5 2.3-5.5 6Z" />
      </svg>
    );
  }
  if (kind === "civic") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m4 9 8-5 8 5M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16" />
      </svg>
    );
  }
  if (kind === "rail") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 4h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm-2 8h14M8 22l2-3m6 3-2-3M8 8h2m4 0h2" />
      </svg>
    );
  }
  if (kind === "road") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 8h11v9H3V8Zm11 3h4l3 3v3h-7v-6ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 21V7l7-4 7 4v14M9 10h2m2 0h2m-6 4h2m2 0h2m-6 4h6" />
    </svg>
  );
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
  return {
    outlines: scene.features.length
      ? scene.features.filter(({ region }) => !region.mapContextOnly)
      : scene.backdrop
        ? [scene.backdrop]
        : [],
    tops: scene.backdrop ? [scene.backdrop] : [],
    walls: scene.backdrop ? [scene.backdrop] : scene.platform ? [scene.platform] : [],
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
          x: anchor.x,
          y: anchor.y,
        }
      : undefined,
  );
}
