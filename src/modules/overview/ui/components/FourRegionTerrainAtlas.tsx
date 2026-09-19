import "./realistic-operational-situation.css";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { MapAnnotation } from "../../application/ports/MapAnnotationRepository";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import type { TerrainSurfaceMode } from "./fourRegionTerrainStyle";
import {
  projectReliefScene,
  type ReliefPoint,
  type ReliefPolygon,
  type ReliefSceneProjection,
  type ReliefSurface,
} from "./terrainReliefGeometry";
import {
  loadSatelliteSurfaceTexture,
  type ProjectedSurfaceBounds,
  type SatelliteSurfaceBounds,
} from "./satelliteSurfaceTexture";
import type { GeographicBounds } from "./realisticSituationModel";

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

interface RegionVisual {
  baseMaterial: THREE.Material;
  group: THREE.Group;
  region: OverviewRegion;
  topMeshes: THREE.Mesh<THREE.ShapeGeometry, THREE.Material>[];
}

type InteractionTarget =
  { kind: "FACILITY"; id: string } | { kind: "REGION"; region: OverviewRegion };

interface AtlasRuntime {
  annotationRoot: THREE.Group;
  camera: THREE.OrthographicCamera;
  contentRoot: THREE.Group;
  destroyed: boolean;
  host: HTMLDivElement;
  operationalObjects: THREE.Object3D[];
  operationalRoot: THREE.Group;
  operationalTargets: Map<string, InteractionTarget>;
  projection: ReliefSceneProjection;
  props: FourRegionTerrainAtlasProps;
  raycaster: THREE.Raycaster;
  regionObjects: THREE.Object3D[];
  regionRoot: THREE.Group;
  regionTargets: Map<string, InteractionTarget>;
  regionVisuals: Map<string, RegionVisual>;
  render: () => void;
  renderer: THREE.WebGLRenderer;
  satelliteDetailRevision: number;
  satelliteRevision: number;
  surfaceMaterials: {
    base: THREE.ShaderMaterial;
    hidden: THREE.MeshBasicMaterial;
    hover: THREE.ShaderMaterial;
    selected: THREE.ShaderMaterial;
    shadow: THREE.MeshBasicMaterial;
  };
  texture: THREE.Texture;
}

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const GLOBE_RADIUS = 468;
const GLOBE_SURFACE_LIFT = 7;
const GLOBE_FRAME = { x: 510, y: 80, width: 900, height: 920 } as const;
const LABEL_Z = 18;

export default function FourRegionTerrainAtlas(props: FourRegionTerrainAtlasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<AtlasRuntime | null>(null);
  const propsRef = useRef(props);
  const geometryKey = useMemo(
    () =>
      JSON.stringify({
        features: props.features,
        rootFeatures: props.rootFeatures,
      }),
    [props.features, props.rootFeatures],
  );
  const projectedFeatures = useMemo(() => {
    const byCode = new Map<string, MapFeature>();
    props.rootFeatures.forEach((feature) => byCode.set(feature.region.code, feature));
    props.features.forEach((feature) => byCode.set(feature.region.code, feature));
    return [...byCode.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey]);
  const projection = useMemo(
    () =>
      stretchGlobeProjection(
        projectReliefScene({
          features: projectedFeatures,
          frame: GLOBE_FRAME,
          points: [],
        }),
      ),
    // geometryKey represents the complete governed geometry. Ordinary weather
    // and timeline updates must not recreate the WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geometryKey, projectedFeatures],
  );

  useEffect(() => {
    propsRef.current = props;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const previous = runtime.props;
    runtime.props = props;
    if (
      previous.selectedRegionCode !== props.selectedRegionCode ||
      previous.surfaceMode !== props.surfaceMode
    ) {
      applySelection(runtime);
      applySurfaceMode(runtime, props.surfaceMode ?? "FUSION");
    }
    if (
      previous.facilities !== props.facilities ||
      previous.layers !== props.layers ||
      previous.selectedFacilityId !== props.selectedFacilityId ||
      previous.situation !== props.situation
    ) {
      updateOperationalLayers(runtime);
    }
    if (
      previous.annotation !== props.annotation ||
      previous.annotationActive !== props.annotationActive ||
      previous.annotationDraft !== props.annotationDraft
    ) {
      buildAnnotationObjects(runtime);
    }
    runtime.render();
  }, [props]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !props.command) return;
    applyCommand(runtime, props.command);
  }, [props.command]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    renderer.setClearColor(0x153338, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.setAttribute("aria-label", "四区域三维卫星融合沙盘");
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.tabIndex = 0;
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x153338, 1300, 2400);
    const camera = new THREE.OrthographicCamera(
      -STAGE_WIDTH / 2,
      STAGE_WIDTH / 2,
      STAGE_HEIGHT / 2,
      -STAGE_HEIGHT / 2,
      0.1,
      3200,
    );
    camera.position.set(0, 0, 1100);
    camera.lookAt(0, 0, 0);

    const contentRoot = new THREE.Group();
    const regionRoot = new THREE.Group();
    const operationalRoot = new THREE.Group();
    const annotationRoot = new THREE.Group();
    contentRoot.add(regionRoot, operationalRoot, annotationRoot);
    scene.add(createFourRegionGlobeBackdrop(), contentRoot);
    scene.add(new THREE.HemisphereLight(0xe8f4ea, 0x17261f, 1.2));
    const keyLight = new THREE.DirectionalLight(0xfff6da, 1.45);
    keyLight.position.set(-0.4, 0.8, 1.8).normalize();
    scene.add(keyLight);

    const fallbackTexture = createFallbackTexture(projectedBounds(projection));
    const surfaceMaterials = {
      base: createCurvedSatelliteSurfaceMaterial(fallbackTexture, "base"),
      hidden: new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
      hover: createCurvedSatelliteSurfaceMaterial(fallbackTexture, "hover"),
      selected: createCurvedSatelliteSurfaceMaterial(fallbackTexture, "selected"),
      shadow: new THREE.MeshBasicMaterial({
        color: 0x031a17,
        depthTest: false,
        depthWrite: false,
        opacity: 0.48,
        transparent: true,
      }),
    };
    const regionObjects: THREE.Object3D[] = [];
    const regionTargets = new Map<string, InteractionTarget>();
    const regionVisuals = new Map<string, RegionVisual>();
    buildReliefGeometry({
      projection,
      regionObjects,
      regionRoot,
      regionTargets,
      regionVisuals,
      surfaceMaterials,
      rootCodes: new Set(
        propsRef.current.rootFeatures.map(({ region }) => region.code),
      ),
    });

    const runtime: AtlasRuntime = {
      annotationRoot,
      camera,
      contentRoot,
      destroyed: false,
      host,
      operationalObjects: [],
      operationalRoot,
      operationalTargets: new Map(),
      projection,
      props: propsRef.current,
      raycaster: new THREE.Raycaster(),
      regionObjects,
      regionRoot,
      regionTargets,
      regionVisuals,
      render: () => {
        if (!disposed) renderer.render(scene, camera);
      },
      renderer,
      satelliteDetailRevision: 0,
      satelliteRevision: 0,
      surfaceMaterials,
      texture: fallbackTexture,
    };
    runtimeRef.current = runtime;
    host.dataset.sceneState = "local-ready";
    host.dataset.viewerCount = "1";
    host.dataset.createdViewerCount = "1";
    host.dataset.featureCount = String(projection.features.length);
    host.dataset.rootRegionCount = String(propsRef.current.rootFeatures.length);
    host.dataset.detailLevel = projection.features[0]?.region.level ?? "PREFECTURE";
    applySurfaceMode(runtime, propsRef.current.surfaceMode ?? "FUSION");
    applySelection(runtime);
    updateOperationalLayers(runtime);
    buildAnnotationObjects(runtime);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      fitFixedGlobeCamera(camera, width, height);
      renderer.setSize(width, height, false);
      runtime.render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let hoveredCode = "";
    const pointer = new THREE.Vector2();
    const interactionTarget = (event: PointerEvent | MouseEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 + 1;
      runtime.raycaster.setFromCamera(pointer, camera);
      const hits = runtime.raycaster.intersectObjects(
        [...runtime.operationalObjects, ...runtime.regionObjects],
        true,
      );
      for (const hit of hits) {
        const operational = runtime.operationalTargets.get(hit.object.uuid);
        if (operational) return operational;
        const region = runtime.regionTargets.get(hit.object.uuid);
        if (region) return region;
      }
      return undefined;
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (runtime.props.annotationActive) return;
      const target = interactionTarget(event);
      const nextCode = target?.kind === "REGION" ? target.region.code : "";
      if (nextCode === hoveredCode) return;
      hoveredCode = nextCode;
      applySelection(runtime, hoveredCode);
      renderer.domElement.style.cursor = target ? "pointer" : "default";
      runtime.render();
    };
    const handlePointerLeave = () => {
      hoveredCode = "";
      applySelection(runtime);
      renderer.domElement.style.cursor = "default";
      runtime.render();
    };
    const handleClick = (event: MouseEvent) => {
      if (runtime.props.annotationActive) {
        const coordinate = annotationCoordinate(runtime, event);
        if (coordinate)
          runtime.props.onAnnotationPosition?.(coordinate[0], coordinate[1]);
        return;
      }
      const target = interactionTarget(event);
      if (target?.kind === "FACILITY") runtime.props.onFacilitySelect(target.id);
      if (target?.kind === "REGION") runtime.props.onRegionSelect(target.region);
    };
    const handleDoubleClick = (event: MouseEvent) => {
      if (runtime.props.annotationActive) return;
      const target = interactionTarget(event);
      if (target?.kind === "REGION") runtime.props.onRegionDrill(target.region);
    };
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);

    runtime.render();
    propsRef.current.onReady?.();
    void refreshSatelliteTexture(runtime);

    return () => {
      disposed = true;
      runtime.destroyed = true;
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      disposeTree(scene);
      runtime.texture.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, [geometryKey, projection]);

  return (
    <div
      aria-label="齐齐哈尔、黑河、呼伦贝尔、大兴安岭四区域三维卫星融合沙盘"
      className="four-region-terrain-atlas"
      data-annotation-active={String(Boolean(props.annotationActive))}
      data-dom-markers="0"
      data-globe-mode="fixed-visible-hemisphere"
      data-region-visibility="all-four-front-hemisphere"
      data-renderer="three-fixed-four-region-globe"
      data-surface-confinement="region-meshes-only"
      ref={hostRef}
      role="img"
    />
  );
}

function createFourRegionGlobeBackdrop() {
  const globe = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
    createGlobeSurfaceMaterial(),
  );
  sphere.position.z = -GLOBE_RADIUS;
  sphere.renderOrder = 0;
  globe.add(sphere);
  const atmosphere = new THREE.Mesh(
    new THREE.RingGeometry(GLOBE_RADIUS - 2, GLOBE_RADIUS + 8, 128),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x8de5e5,
      depthWrite: false,
      opacity: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  atmosphere.position.z = -8;
  atmosphere.renderOrder = 1;
  globe.add(atmosphere);
  return globe;
}

function createGlobeSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    depthWrite: true,
    fragmentShader: `
      precision highp float;
      varying vec3 globeNormal;

      void main() {
        float facing = smoothstep(0.0, 0.96, max(globeNormal.z, 0.0));
        vec3 edge = vec3(0.035, 0.15, 0.17);
        vec3 centre = vec3(0.09, 0.29, 0.29);
        vec3 colour = mix(edge, centre, facing);
        float latitude = asin(clamp(globeNormal.y, -1.0, 1.0));
        float longitude = atan(globeNormal.x, max(globeNormal.z, 0.0001));
        float latGrid = 1.0 - smoothstep(0.0, 0.035, abs(sin(latitude * 9.0)));
        float lonGrid = 1.0 - smoothstep(0.0, 0.035, abs(sin(longitude * 12.0)));
        float grid = max(latGrid, lonGrid) * facing * 0.13;
        colour += vec3(0.18, 0.46, 0.43) * grid;
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
    vertexShader: `
      varying vec3 globeNormal;

      void main() {
        globeNormal = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
}

function fitFixedGlobeCamera(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
) {
  const aspect = width / Math.max(height, 1);
  const fittedDiameter = GLOBE_RADIUS * 2 + 64;
  const viewWidth = aspect >= 1 ? fittedDiameter * aspect : fittedDiameter;
  const viewHeight = aspect >= 1 ? fittedDiameter : fittedDiameter / aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

function createCurvedSatelliteSurfaceMaterial(
  texture: THREE.Texture,
  tone: "base" | "hover" | "selected",
) {
  const selected = tone === "selected";
  const hovered = tone === "hover";
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
    uniforms: {
      globeRadius: { value: GLOBE_RADIUS },
      globeSurfaceLift: { value: GLOBE_SURFACE_LIFT },
      surfaceBrightness: { value: selected || hovered ? 1.14 : 1.1 },
      surfaceContrast: { value: 1.06 },
      surfaceTint: {
        value: new THREE.Color(selected ? 0xffc84a : hovered ? 0xf2c94c : 0x5b9d91),
      },
      surfaceTintStrength: { value: selected ? 0.22 : hovered ? 0.18 : 0.2 },
      terrainMap: { value: texture },
    },
    vertexShader: `
      uniform float globeRadius;
      uniform float globeSurfaceLift;
      varying vec2 terrainUv;
      varying float globeLight;
      varying float globeRadiusRatio;

      void main() {
        terrainUv = uv;
        globeRadiusRatio = length(position.xy) / globeRadius;
        float normalizedRadius = clamp(globeRadiusRatio, 0.0, 1.0);
        float hemisphere = sqrt(max(0.0, 1.0 - normalizedRadius * normalizedRadius));
        float sphereSurface = hemisphere * globeRadius - globeRadius;
        vec3 curvedPosition = vec3(
          position.xy,
          position.z + sphereSurface + globeSurfaceLift
        );
        globeLight = 0.78 + hemisphere * 0.28;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(curvedPosition, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D terrainMap;
      uniform vec3 surfaceTint;
      uniform float surfaceTintStrength;
      uniform float surfaceBrightness;
      uniform float surfaceContrast;
      varying vec2 terrainUv;
      varying float globeLight;
      varying float globeRadiusRatio;

      void main() {
        if (globeRadiusRatio > 1.0) discard;
        vec3 terrain = texture2D(terrainMap, terrainUv).rgb;
        terrain = (terrain - 0.5) * surfaceContrast + 0.5;
        terrain *= surfaceBrightness * globeLight;
        float luminance = dot(terrain, vec3(0.2126, 0.7152, 0.0722));
        vec3 gradedTint = surfaceTint * (0.36 + luminance * 0.72);
        terrain = mix(terrain, gradedTint, surfaceTintStrength);
        gl_FragColor = vec4(clamp(terrain, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function globeSurfaceHeight({ x, y }: { x: number; y: number }) {
  const normalizedRadius = Math.min(1, Math.hypot(x, y) / GLOBE_RADIUS);
  return (
    Math.sqrt(Math.max(0, 1 - normalizedRadius ** 2)) * GLOBE_RADIUS -
    GLOBE_RADIUS +
    GLOBE_SURFACE_LIFT
  );
}

function stretchGlobeProjection(
  projection: ReliefSceneProjection,
): ReliefSceneProjection {
  const stretchPoint = ({ x, y }: ReliefPoint): ReliefPoint => ({
    x,
    y: STAGE_HEIGHT / 2 + (y - STAGE_HEIGHT / 2) * 1.55,
  });
  const stretchPolygon = (polygon: ReliefPolygon): ReliefPolygon => ({
    rings: polygon.rings.map((ring) => ({
      ...ring,
      points: ring.points.map(stretchPoint),
    })),
  });
  const stretchSurface = (surface: ReliefSurface): ReliefSurface => ({
    ...surface,
    anchor: stretchPoint(surface.anchor),
    hitPolygons: surface.hitPolygons.map(stretchPolygon),
    polygons: surface.polygons.map(stretchPolygon),
    wallPolygons: surface.wallPolygons.map(stretchPolygon),
  });
  return {
    ...projection,
    features: projection.features.map(stretchSurface),
    labels: projection.labels.map((label) => ({
      ...label,
      point: stretchPoint(label.point),
    })),
    points: projection.points.map((location) => ({
      ...location,
      point: stretchPoint(location.point),
    })),
  };
}

function buildReliefGeometry({
  projection,
  regionObjects,
  regionRoot,
  regionTargets,
  regionVisuals,
  rootCodes,
  surfaceMaterials,
}: {
  projection: ReliefSceneProjection;
  regionObjects: THREE.Object3D[];
  regionRoot: THREE.Group;
  regionTargets: Map<string, InteractionTarget>;
  regionVisuals: Map<string, RegionVisual>;
  rootCodes: ReadonlySet<string>;
  surfaceMaterials: AtlasRuntime["surfaceMaterials"];
}) {
  const orderedSurfaces = [...projection.features].sort(
    (left, right) =>
      Number(rootCodes.has(right.region.code)) -
      Number(rootCodes.has(left.region.code)),
  );
  orderedSurfaces.forEach((surface) =>
    addCurvedRegionSurface(
      surface,
      regionRoot,
      surfaceMaterials,
      !surface.region.mapContextOnly,
      regionObjects,
      regionTargets,
      regionVisuals,
      rootCodes.has(surface.region.code) ? 0 : 2,
      rootCodes.has(surface.region.code),
    ),
  );
  addRegionOutlines(projection, regionRoot, rootCodes);
  projection.labels
    .filter(
      ({ kind, region }) =>
        kind === "region" && rootCodes.has(region.code) && !region.mapContextOnly,
    )
    .forEach(({ point, region }) => {
      const sprite = createLabelSprite(region.name);
      const world = screenToWorld(point);
      sprite.position.set(world.x, world.y, globeSurfaceHeight(world) + LABEL_Z);
      regionRoot.add(sprite);
    });
}

function addCurvedRegionSurface(
  surface: ReliefSurface,
  root: THREE.Group,
  materials: AtlasRuntime["surfaceMaterials"],
  interactive: boolean,
  regionObjects: THREE.Object3D[],
  regionTargets: Map<string, InteractionTarget>,
  regionVisuals: Map<string, RegionVisual>,
  topZ: number,
  rootRegion: boolean,
) {
  const geometries = createRegionSurfaceGeometries(surface);
  const group = new THREE.Group();
  if (rootRegion) {
    geometries.forEach((geometry) => {
      const contactShadow = new THREE.Mesh(geometry.clone(), materials.shadow);
      contactShadow.position.set(9, -12, topZ - 2);
      contactShadow.renderOrder = 2;
      group.add(contactShadow);
    });
  }
  const topMeshes = geometries.map((geometry) => {
    const top = new THREE.Mesh(
      geometry,
      rootRegion ? materials.base : materials.hidden,
    );
    top.position.z = topZ;
    top.renderOrder = 3;
    group.add(top);
    if (interactive) {
      regionObjects.push(top);
      regionTargets.set(top.uuid, { kind: "REGION", region: surface.region });
    }
    return top;
  });
  root.add(group);
  regionVisuals.set(surface.region.code, {
    baseMaterial: rootRegion ? materials.base : materials.hidden,
    group,
    region: surface.region,
    topMeshes,
  });
}

function createRegionSurfaceGeometries(surface: ReliefSurface) {
  const geometries: THREE.ShapeGeometry[] = [];
  surface.polygons.forEach((polygon) => {
    const shape = regionShape(polygon);
    if (!shape) return;
    const geometry = new THREE.ShapeGeometry(shape);
    const positions = geometry.getAttribute("position");
    const uv: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      uv.push(
        (positions.getX(index) + STAGE_WIDTH / 2) / STAGE_WIDTH,
        (positions.getY(index) + STAGE_HEIGHT / 2) / STAGE_HEIGHT,
      );
    }
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometries.push(geometry);
  });
  return geometries;
}

function regionShape(polygon: ReliefPolygon) {
  const outer = polygon.rings.find(({ isHole }) => !isHole)?.points;
  if (!outer || outer.length < 3) return undefined;
  const shape = new THREE.Shape();
  drawRegionPath(shape, outer);
  polygon.rings
    .filter(({ isHole }) => isHole)
    .forEach(({ points }) => {
      if (points.length < 3) return;
      const hole = new THREE.Path();
      drawRegionPath(hole, points);
      shape.holes.push(hole);
    });
  return shape;
}

function drawRegionPath(path: THREE.Path, points: readonly ReliefPoint[]) {
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

function addRegionOutlines(
  projection: ReliefSceneProjection,
  root: THREE.Group,
  rootCodes: ReadonlySet<string>,
) {
  const surfaces = projection.features;
  surfaces.forEach((surface) =>
    surface.polygons.forEach((polygon) =>
      polygon.rings.forEach(({ points }) => {
        if (points.length < 2) return;
        const rootBoundary = rootCodes.has(surface.region.code);
        const material = new THREE.LineBasicMaterial({
          color: rootBoundary ? 0xfff0b8 : 0xf7e6ad,
          depthTest: false,
          depthWrite: false,
          opacity: rootBoundary ? 0.92 : 0.46,
          transparent: true,
        });
        const closed = [...points, points[0] as ReliefPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(
          closed.map((point) => {
            const world = screenToWorld(point);
            return new THREE.Vector3(
              world.x,
              world.y,
              globeSurfaceHeight(world) + (rootBoundary ? 9 : 12),
            );
          }),
        );
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 8;
        root.add(line);
      }),
    ),
  );
}

function applySelection(runtime: AtlasRuntime, hoveredCode = "") {
  runtime.regionVisuals.forEach((visual, code) => {
    const selected = code === runtime.props.selectedRegionCode;
    const hovered = code === hoveredCode;
    visual.group.position.z = hovered ? 10 : selected ? 6 : 0;
    visual.topMeshes.forEach((mesh) => {
      mesh.material = hovered
        ? runtime.surfaceMaterials.hover
        : selected
          ? runtime.surfaceMaterials.selected
          : visual.baseMaterial;
    });
  });
}

function applySurfaceMode(runtime: AtlasRuntime, mode: TerrainSurfaceMode) {
  const base = mode === "IMAGERY" ? 0.02 : mode === "SANDBOX" ? 0.48 : 0.2;
  const brightness = mode === "IMAGERY" ? 1.04 : mode === "SANDBOX" ? 1.14 : 1.1;
  setMaterialGrade(runtime.surfaceMaterials.base, base, brightness);
  setMaterialGrade(runtime.surfaceMaterials.hover, Math.min(base + 0.08, 0.56), 1.13);
  setMaterialGrade(runtime.surfaceMaterials.selected, Math.min(base + 0.1, 0.58), 1.14);
  runtime.host.dataset.surfaceMode = mode.toLowerCase();
}

function setMaterialGrade(
  material: THREE.ShaderMaterial,
  tintStrength: number,
  brightness: number,
) {
  if (material.uniforms.surfaceTintStrength)
    material.uniforms.surfaceTintStrength.value = tintStrength;
  if (material.uniforms.surfaceBrightness)
    material.uniforms.surfaceBrightness.value = brightness;
}

function applyCommand(runtime: AtlasRuntime, command: RealisticSceneCommand) {
  if (command.type === "ZOOM_IN") {
    runtime.satelliteDetailRevision = Math.min(3, runtime.satelliteDetailRevision + 1);
  }
  if (command.type === "ZOOM_OUT") {
    runtime.satelliteDetailRevision = Math.max(0, runtime.satelliteDetailRevision - 1);
  }
  if (command.type === "RESET") {
    runtime.satelliteDetailRevision = 0;
  }
  runtime.host.dataset.imageryDetailRevision = String(runtime.satelliteDetailRevision);
  runtime.render();
  if (
    command.type === "ZOOM_IN" ||
    command.type === "ZOOM_OUT" ||
    command.type === "RESET"
  )
    void refreshSatelliteTexture(runtime);
}

async function refreshSatelliteTexture(runtime: AtlasRuntime) {
  const bounds = runtime.projection.sourceBounds;
  const stageBounds = projectedBounds(runtime.projection);
  if (!bounds || !stageBounds) return;
  const revision = ++runtime.satelliteRevision;
  runtime.host.dataset.enhancementState = "loading";
  runtime.props.onEnhancementState?.("LOADING");
  try {
    const loaded = await loadSatelliteSurfaceTexture({
      bounds: sourceBounds(bounds),
      projectedBounds: stageBounds,
      requestedZoom:
        baseSatelliteZoom(runtime.props.features[0]?.region.level) +
        runtime.satelliteDetailRevision,
      stageHeight: STAGE_HEIGHT,
      stageWidth: STAGE_WIDTH,
    });
    if (runtime.destroyed || revision !== runtime.satelliteRevision) {
      loaded.texture.dispose();
      return;
    }
    const previous = runtime.texture;
    runtime.texture = loaded.texture;
    Object.values(runtime.surfaceMaterials).forEach((material) => {
      if (material instanceof THREE.ShaderMaterial && material.uniforms.terrainMap)
        material.uniforms.terrainMap.value = loaded.texture;
      material.needsUpdate = true;
    });
    previous.dispose();
    runtime.host.dataset.enhancementState = "ready";
    runtime.host.dataset.imagerySource = loaded.source;
    runtime.host.dataset.imageryZoom = String(loaded.zoom);
    runtime.host.dataset.imageryTileCount = String(loaded.tileCount);
    runtime.props.onEnhancementState?.("READY");
    runtime.render();
  } catch {
    if (runtime.destroyed || revision !== runtime.satelliteRevision) return;
    runtime.host.dataset.enhancementState = "degraded";
    runtime.props.onEnhancementState?.("DEGRADED");
  }
}

function baseSatelliteZoom(level: OverviewRegion["level"] | undefined) {
  if (level === "VILLAGE") return 13;
  if (level === "TOWNSHIP") return 11;
  if (level === "COUNTY") return 9;
  return 7;
}

function updateOperationalLayers(runtime: AtlasRuntime) {
  clearGroup(runtime.operationalRoot);
  runtime.operationalTargets.clear();
  runtime.operationalObjects = [];
  buildOperationalLines(runtime);
  buildOperationalMarkers(runtime);
  runtime.host.dataset.billboardCount = String(runtime.operationalObjects.length);
}

function buildOperationalMarkers(runtime: AtlasRuntime) {
  const { facilities, layers, selectedFacilityId, situation } = runtime.props;
  const storageMarkers: ReliefPoint[] = [];
  facilities.storageFacilities.forEach((facility) => {
    if (
      facility.longitude === null ||
      facility.latitude === null ||
      !layers[facility.relationType]
    )
      return;
    const point = projectCoordinate(runtime.projection, [
      facility.longitude,
      facility.latitude,
    ]);
    if (!point) return;
    const selected = facility.code === selectedFacilityId;
    if (!selected && !acceptProjectedMarker(point, storageMarkers, 24)) return;
    const color =
      facility.relationType === "OWNED"
        ? 0x37a66f
        : facility.relationType === "LEASED"
          ? 0xe1a52b
          : 0x858d91;
    addOperationalMarker(runtime, point, color, selected, {
      kind: "FACILITY",
      id: facility.code,
    });
  });
  if (layers.RAILWAY) {
    const railwayMarkers: ReliefPoint[] = [];
    facilities.railwayFacilities.forEach((facility) => {
      const point = projectCoordinate(runtime.projection, [
        facility.longitude,
        facility.latitude,
      ]);
      if (!point) return;
      const selected = facility.sourceId === selectedFacilityId;
      if (!selected && !acceptProjectedMarker(point, railwayMarkers, 34)) return;
      addOperationalMarker(runtime, point, 0xf5f5ec, selected, {
        kind: "FACILITY",
        id: facility.sourceId,
      });
    });
  }
  if (layers.WEATHER) {
    situation.weather.forEach((weather) => {
      const point = projectCoordinate(runtime.projection, [
        weather.longitude,
        weather.latitude,
      ]);
      if (!point) return;
      const region = findRegion(
        runtime.projection,
        weather.regionCode ?? weather.rootRegionCode,
      );
      addOperationalMarker(
        runtime,
        point,
        weather.precipitationMm && weather.precipitationMm > 0 ? 0x79d8ff : 0xf3f1df,
        false,
        region ? { kind: "REGION", region } : undefined,
        weather.precipitationMm && weather.precipitationMm > 0 ? "雨" : "云",
      );
    });
  }
  if (layers.INVENTORY) {
    const inventoryMarkers: ReliefPoint[] = [];
    situation.inventories.forEach((inventory) => {
      const point = projectCoordinate(runtime.projection, [
        inventory.longitude,
        inventory.latitude,
      ]);
      if (!point) return;
      if (!acceptProjectedMarker(point, inventoryMarkers, 30)) return;
      addOperationalMarker(runtime, point, 0x72c995, false);
    });
  }
}

function acceptProjectedMarker(
  point: ReliefPoint,
  accepted: ReliefPoint[],
  minimumDistance: number,
) {
  if (
    accepted.some(
      (candidate) =>
        Math.hypot(candidate.x - point.x, candidate.y - point.y) < minimumDistance,
    )
  )
    return false;
  accepted.push(point);
  return true;
}

function addOperationalMarker(
  runtime: AtlasRuntime,
  point: ReliefPoint,
  color: number,
  selected: boolean,
  target?: InteractionTarget,
  label?: string,
) {
  const world = screenToWorld(point);
  const markerGroup = new THREE.Group();
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(selected ? 6.4 : 5.1, 20),
    new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }),
  );
  const markerRing = new THREE.Mesh(
    new THREE.RingGeometry(selected ? 7.1 : 5.8, selected ? 9.2 : 7.5, 24),
    new THREE.MeshBasicMaterial({
      color: selected ? 0xffd766 : 0xf3f2e8,
      depthTest: false,
      depthWrite: false,
      opacity: 0.92,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  markerGroup.add(markerRing, marker);
  markerGroup.position.set(
    world.x,
    world.y,
    globeSurfaceHeight(world) + (selected ? 25 : 20),
  );
  markerGroup.renderOrder = 30;
  runtime.operationalRoot.add(markerGroup);
  runtime.operationalObjects.push(marker);
  if (target) runtime.operationalTargets.set(marker.uuid, target);
  if (label) {
    const sprite = createBadgeSprite(label, color);
    sprite.position.set(
      world.x,
      world.y - 15,
      globeSurfaceHeight({ x: world.x, y: world.y - 15 }) + 22,
    );
    runtime.operationalRoot.add(sprite);
  }
}

function buildOperationalLines(runtime: AtlasRuntime) {
  const { facilities, layers, situation } = runtime.props;
  if (layers.LOGISTICS) {
    situation.logisticsFlows.forEach((flow) => {
      addProjectedLine(
        runtime,
        [flow.originLongitude, flow.originLatitude],
        [flow.destinationLongitude, flow.destinationLatitude],
        0xf0b647,
      );
    });
  }
  if (layers.RAILWAY_ROUTE) {
    facilities.railwayRoutes.forEach((route) => {
      try {
        const geometry = JSON.parse(route.geometryGeoJson) as {
          coordinates?: readonly (readonly [number, number])[];
          type?: string;
        };
        if (geometry.type !== "LineString" || !geometry.coordinates) return;
        const points = geometry.coordinates
          .map((coordinate) => projectCoordinate(runtime.projection, coordinate))
          .filter((point): point is ReliefPoint => Boolean(point))
          .map((point) => {
            const world = screenToWorld(point);
            return new THREE.Vector3(world.x, world.y, globeSurfaceHeight(world) + 14);
          });
        if (points.length < 2) return;
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineDashedMaterial({
            color: 0xf4f4eb,
            dashSize: 7,
            gapSize: 5,
            opacity: 0.85,
            transparent: true,
          }),
        );
        line.computeLineDistances();
        runtime.operationalRoot.add(line);
      } catch {
        // Invalid public route geometry is omitted without affecting the scene.
      }
    });
  }
}

function addProjectedLine(
  runtime: AtlasRuntime,
  startCoordinate: readonly [number, number],
  endCoordinate: readonly [number, number],
  color: number,
) {
  const start = projectCoordinate(runtime.projection, startCoordinate);
  const end = projectCoordinate(runtime.projection, endCoordinate);
  if (!start || !end) return;
  const startWorld = screenToWorld(start);
  const endWorld = screenToWorld(end);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(
        startWorld.x,
        startWorld.y,
        globeSurfaceHeight(startWorld) + 14,
      ),
      new THREE.Vector3(endWorld.x, endWorld.y, globeSurfaceHeight(endWorld) + 14),
    ]),
    new THREE.LineDashedMaterial({
      color,
      dashSize: 10,
      gapSize: 6,
      opacity: 0.94,
      transparent: true,
    }),
  );
  line.computeLineDistances();
  runtime.operationalRoot.add(line);
}

function buildAnnotationObjects(runtime: AtlasRuntime) {
  clearGroup(runtime.annotationRoot);
  const annotation = runtime.props.annotation;
  const draft = runtime.props.annotationDraft;
  if (annotation?.type === "POINT") {
    const point = projectCoordinate(runtime.projection, [
      annotation.minLongitude,
      annotation.minLatitude,
    ]);
    if (point) addAnnotationPoint(runtime.annotationRoot, point);
  }
  if (annotation?.type === "RECTANGLE") {
    addAnnotationRectangle(runtime, [
      [annotation.minLongitude, annotation.minLatitude],
      [annotation.maxLongitude ?? annotation.minLongitude, annotation.minLatitude],
      [
        annotation.maxLongitude ?? annotation.minLongitude,
        annotation.maxLatitude ?? annotation.minLatitude,
      ],
      [annotation.minLongitude, annotation.maxLatitude ?? annotation.minLatitude],
    ]);
  }
  if (draft) {
    const point = projectCoordinate(runtime.projection, draft);
    if (point) addAnnotationPoint(runtime.annotationRoot, point);
  }
}

function addAnnotationPoint(root: THREE.Group, point: ReliefPoint) {
  const world = screenToWorld(point);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(9, 13, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd45f, side: THREE.DoubleSide }),
  );
  ring.position.set(world.x, world.y, globeSurfaceHeight(world) + 28);
  root.add(ring);
}

function addAnnotationRectangle(
  runtime: AtlasRuntime,
  coordinates: readonly (readonly [number, number])[],
) {
  const points = [...coordinates, coordinates[0]!]
    .map((coordinate) => projectCoordinate(runtime.projection, coordinate))
    .filter((point): point is ReliefPoint => Boolean(point))
    .map((point) => {
      const world = screenToWorld(point);
      return new THREE.Vector3(world.x, world.y, globeSurfaceHeight(world) + 28);
    });
  if (points.length < 4) return;
  runtime.annotationRoot.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xffd45f }),
    ),
  );
}

function annotationCoordinate(
  runtime: AtlasRuntime,
  event: MouseEvent,
): readonly [number, number] | undefined {
  const source = runtime.projection.sourceBounds;
  if (!source) return undefined;
  const bounds = runtime.renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector3(
    ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
    -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 + 1,
    0,
  ).unproject(runtime.camera);
  const screenX = pointer.x + STAGE_WIDTH / 2;
  const screenY = STAGE_HEIGHT / 2 - pointer.y;
  const projected = projectedBounds(runtime.projection);
  if (!projected || screenX < projected.minX || screenX > projected.maxX)
    return undefined;
  if (screenY < projected.minY || screenY > projected.maxY) return undefined;
  const longitude =
    source.minX +
    ((screenX - projected.minX) / Math.max(projected.maxX - projected.minX, 1)) *
      (source.maxX - source.minX);
  const latitude =
    source.maxY -
    ((screenY - projected.minY) / Math.max(projected.maxY - projected.minY, 1)) *
      (source.maxY - source.minY);
  return [longitude, latitude];
}

function projectCoordinate(
  projection: ReliefSceneProjection,
  coordinate: readonly [number, number],
): ReliefPoint | undefined {
  const bounds = projection.sourceBounds;
  if (!bounds) return undefined;
  const [longitude, latitude] = coordinate;
  if (
    longitude < bounds.minX ||
    longitude > bounds.maxX ||
    latitude < bounds.minY ||
    latitude > bounds.maxY
  )
    return undefined;
  const target = projectedBounds(projection);
  if (!target) return undefined;
  return {
    x:
      target.minX +
      ((longitude - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.000001)) *
        (target.maxX - target.minX),
    y:
      target.minY +
      ((bounds.maxY - latitude) / Math.max(bounds.maxY - bounds.minY, 0.000001)) *
        (target.maxY - target.minY),
  };
}

function findRegion(projection: ReliefSceneProjection, code: string) {
  return [
    ...projection.features,
    ...(projection.backdrop ? [projection.backdrop] : []),
  ].find(({ region }) => region.code === code)?.region;
}

function projectedBounds(
  projection: ReliefSceneProjection,
): ProjectedSurfaceBounds | undefined {
  const surfaces = projection.backdrop
    ? [projection.backdrop]
    : projection.features.length
      ? projection.features
      : [];
  const points = surfaces.flatMap(({ polygons }) =>
    polygons.flatMap(({ rings }) => rings.flatMap((ring) => ring.points)),
  );
  if (!points.length) return undefined;
  return {
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y)),
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
  };
}

function sourceBounds(bounds: NonNullable<ReliefSceneProjection["sourceBounds"]>) {
  return {
    maxLatitude: bounds.maxY,
    maxLongitude: bounds.maxX,
    minLatitude: bounds.minY,
    minLongitude: bounds.minX,
  } satisfies SatelliteSurfaceBounds;
}

function createFallbackTexture(bounds: ProjectedSurfaceBounds | undefined) {
  const canvas = document.createElement("canvas");
  canvas.width = STAGE_WIDTH;
  canvas.height = STAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (context && bounds) {
    const gradient = context.createLinearGradient(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    );
    gradient.addColorStop(0, "#738b65");
    gradient.addColorStop(0.5, "#526c4f");
    gradient.addColorStop(1, "#355547");
    context.fillStyle = gradient;
    context.fillRect(
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLabelSprite(text: string) {
  return createTextSprite(text, "#f7f2df", "rgba(12, 34, 29, .88)", 32, 1.9);
}

function createBadgeSprite(text: string, color: number) {
  const colour = `#${color.toString(16).padStart(6, "0")}`;
  return createTextSprite(text, "#ffffff", colour, 22, 0.6);
}

function createTextSprite(
  text: string,
  foreground: string,
  background: string,
  fontSize: number,
  scale: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 104;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `650 ${fontSize}px PingFang SC, Microsoft YaHei, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = Math.max(6, fontSize * 0.24);
    context.lineJoin = "round";
    context.strokeStyle = background;
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
    context.fillStyle = foreground;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ depthTest: false, map: texture, transparent: true }),
  );
  sprite.renderOrder = 40;
  sprite.scale.set(120 * scale, 32 * scale, 1);
  return sprite;
}

function screenToWorld(point: ReliefPoint) {
  return { x: point.x - STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 - point.y };
}

function clearGroup(group: THREE.Group) {
  [...group.children].forEach((child) => {
    child.traverse((object) => disposeObject(object));
    group.remove(child);
  });
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => disposeObject(object));
}

function disposeObject(object: THREE.Object3D) {
  const renderable = object as THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
  };
  renderable.geometry?.dispose();
  const materials = Array.isArray(renderable.material)
    ? renderable.material
    : renderable.material
      ? [renderable.material]
      : [];
  materials.forEach((material) => {
    const map = (material as THREE.SpriteMaterial).map;
    map?.dispose();
    material.dispose();
  });
}
