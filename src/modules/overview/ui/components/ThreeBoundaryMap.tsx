import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { useEffect, useRef } from "react";

import type { OverviewRegion } from "../../domain/overview";
import {
  flattenCoordinates,
  type MapFeature,
  type MapPointFeature,
  type OverviewMapCommand,
  type OverviewMapSelectionPoint,
  type Position,
} from "./boundaryGeometry";

interface RegionObjects {
  borderMaterials: (THREE.LineBasicMaterial | LineMaterial)[];
  contactShadows: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[];
  meshes: THREE.Mesh<THREE.ExtrudeGeometry, THREE.Material[]>[];
  marker: THREE.Group;
  sideMaterials: THREE.MeshPhysicalMaterial[];
  topMaterials: THREE.ShaderMaterial[];
}

interface PointObjects {
  baseColor: number;
  group: THREE.Group;
  hitTarget: THREE.Mesh;
  pointMaterial: THREE.MeshBasicMaterial;
}

const REGION_DEPTH = 0.42;
const REGION_SURFACE_Z = REGION_DEPTH + 0.035;

export default function ThreeBoundaryMap({
  backdrop,
  features,
  points,
  selectedCode,
  scopeLabel,
  onSelect,
  onDrill,
  onUnavailable,
  onReady,
  onSelectionPosition,
  command,
}: {
  backdrop?: MapFeature;
  features: readonly MapFeature[];
  points: readonly MapPointFeature[];
  selectedCode: string;
  scopeLabel?: string;
  onSelect: (region: OverviewRegion) => void;
  onDrill: (region: OverviewRegion) => void;
  onUnavailable: (reason: string) => void;
  onReady: () => void;
  onSelectionPosition?: (position: OverviewMapSelectionPoint | undefined) => void;
  command?: OverviewMapCommand;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onDrill, onSelect });
  const positionCallback = useRef(onSelectionPosition);
  const selected = useRef(selectedCode);
  const regionObjects = useRef(new Map<string, RegionObjects>());
  const pointObjects = useRef(new Map<string, PointObjects>());
  const sceneState = useRef<
    | {
        camera: THREE.PerspectiveCamera;
        controls: OrbitControls;
        group: THREE.Group;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    callbacks.current = { onDrill, onSelect };
  }, [onDrill, onSelect]);

  useEffect(() => {
    positionCallback.current = onSelectionPosition;
  }, [onSelectionPosition]);

  useEffect(() => {
    selected.current = selectedCode;
    applySelection(regionObjects.current, selectedCode);
    applyPointSelection(pointObjects.current, selectedCode);
  }, [selectedCode]);

  useEffect(() => {
    const state = sceneState.current;
    if (!state || !command) return;
    if (command.type === "ZOOM_IN") state.camera.position.multiplyScalar(0.86);
    if (command.type === "ZOOM_OUT") state.camera.position.multiplyScalar(1.16);
    if (command.type === "ROTATE")
      state.group.rotation.z -= THREE.MathUtils.degToRad(8);
    if (command.type === "RESET")
      resetCamera(state.camera, state.controls, state.group);
    state.controls.update();
  }, [command]);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let disposed = false;
    try {
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.replaceChildren(renderer.domElement);
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "行政区边界地图");
      host.dataset.overviewScene = "viewer-created";
      host.dataset.sceneVersion = "grounded-v17";

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x3993b1, 0.0028);
      const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.055;
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.minDistance = 12;
      controls.maxDistance = 32;
      controls.minPolarAngle = THREE.MathUtils.degToRad(16);
      controls.maxPolarAngle = THREE.MathUtils.degToRad(38);

      const group = new THREE.Group();
      scene.add(group);
      resetCamera(camera, controls, group);
      sceneState.current = { camera, controls, group };

      const terrainTexture = createTerrainTexture(renderer);
      const shadowCatcher = new THREE.Mesh(
        new THREE.PlaneGeometry(20.5, 17),
        new THREE.ShadowMaterial({
          color: 0x031b2c,
          opacity: 0.075,
          transparent: true,
        }),
      );
      shadowCatcher.position.z = -0.012;
      shadowCatcher.renderOrder = -1;
      shadowCatcher.receiveShadow = true;
      group.add(shadowCatcher);

      const ambient = new THREE.HemisphereLight(0xf0fdff, 0x176f8d, 2.1);
      scene.add(ambient);
      const keyLight = new THREE.DirectionalLight(0xf4fdff, 2.5);
      keyLight.position.set(-7, 16, -9);
      keyLight.castShadow = true;
      keyLight.shadow.bias = -0.00018;
      keyLight.shadow.normalBias = 0.016;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.left = -18;
      keyLight.shadow.camera.right = 18;
      keyLight.shadow.camera.top = 18;
      keyLight.shadow.camera.bottom = -18;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 48;
      scene.add(keyLight);
      const cyanLight = new THREE.PointLight(0x42e6ff, 15, 32, 1.55);
      cyanLight.position.set(2, 8, 1);
      scene.add(cyanLight);

      const projectionFeatures = backdrop ? [backdrop, ...features] : features;
      const projection = createProjection(projectionFeatures, points);
      const objects = new Map<string, RegionObjects>();
      const backdropObjects = backdrop
        ? createRegionObjects(backdrop, -1, projection, terrainTexture)
        : undefined;
      backdropObjects?.contactShadows.forEach((shadow) => group.add(shadow));
      backdropObjects?.meshes.forEach((mesh) => group.add(mesh));
      if (backdropObjects) backdropObjects.marker.visible = false;
      features.forEach((feature, featureIndex) => {
        const created = createRegionObjects(
          feature,
          featureIndex,
          projection,
          terrainTexture,
        );
        created.contactShadows.forEach((shadow) => group.add(shadow));
        created.meshes.forEach((mesh) => group.add(mesh));
        group.add(created.marker);
        objects.set(feature.region.code, created);
      });
      const locationObjects = new Map<string, PointObjects>();
      points.forEach((point, pointIndex) => {
        const created = createLocationPoint(
          point,
          pointIndex,
          projection,
          points.length <= 40,
        );
        group.add(created.group);
        locationObjects.set(point.region.code, created);
      });
      pointObjects.current = locationObjects;
      host.dataset.pointCount = String(locationObjects.size);
      if (scopeLabel) {
        const scopeLabelSprite = createLabel(scopeLabel);
        scopeLabelSprite.position.set(0, -0.25, 1.5);
        scopeLabelSprite.scale.set(3.55, 0.86, 1);
        group.add(scopeLabelSprite);
      }
      regionObjects.current = objects;
      applySelection(objects, selected.current);
      applyPointSelection(locationObjects, selected.current);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const regionAt = (event: PointerEvent) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(
          [
            ...[...objects.values()].flatMap((item) => item.meshes),
            ...[...locationObjects.values()].map((item) => item.hitTarget),
          ],
          false,
        )[0];
        return hit?.object.userData.region as OverviewRegion | undefined;
      };
      const click = (event: PointerEvent) => {
        const region = regionAt(event);
        if (region) callbacks.current.onSelect(region);
      };
      const doubleClick = (event: MouseEvent) => {
        const region = regionAt(event as PointerEvent);
        if (region) callbacks.current.onDrill(region);
      };
      renderer.domElement.addEventListener("pointerup", click);
      renderer.domElement.addEventListener("dblclick", doubleClick);

      const resize = new ResizeObserver(([entry]) => {
        if (!entry || disposed) return;
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        const stage = host.closest<HTMLElement>(".overview-command-center");
        const stageFraction = new THREE.Vector2(
          width / Math.max(stage?.clientWidth ?? width, 1),
          height / Math.max(stage?.clientHeight ?? height, 1),
        );
        updateSurfaceViewport(objects, backdropObjects, stageFraction);
      });
      resize.observe(host);

      const timer = new THREE.Timer();
      timer.connect(document);
      const projectedMarker = new THREE.Vector3();
      let lastSelectionPoint = "";
      let frame = 0;
      const render = (timestamp?: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(render);
        timer.update(timestamp);
        controls.update();
        const pulse = 1 + Math.sin(timer.getElapsed() * 2.1) * 0.08;
        const currentPulse =
          objects.get(selected.current)?.marker.getObjectByName("selectionPulse") ??
          locationObjects
            .get(selected.current)
            ?.group.getObjectByName("selectionPulse");
        if (currentPulse) currentPulse.scale.setScalar(pulse);
        renderer.render(scene, camera);
        const selectedMarker =
          objects.get(selected.current)?.marker ??
          locationObjects.get(selected.current)?.group;
        if (selectedMarker) {
          selectedMarker.getWorldPosition(projectedMarker);
          projectedMarker.project(camera);
          const bounds = renderer.domElement.getBoundingClientRect();
          const point = {
            height: window.innerHeight,
            width: window.innerWidth,
            x: Math.round(bounds.left + ((projectedMarker.x + 1) * bounds.width) / 2),
            y: Math.round(bounds.top + ((1 - projectedMarker.y) * bounds.height) / 2),
          };
          const pointKey = `${point.x}:${point.y}:${point.width}:${point.height}`;
          if (pointKey !== lastSelectionPoint) {
            lastSelectionPoint = pointKey;
            positionCallback.current?.(point);
          }
        } else if (lastSelectionPoint) {
          lastSelectionPoint = "";
          positionCallback.current?.(undefined);
        }
      };
      render();
      onReady();

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        timer.dispose();
        resize.disconnect();
        renderer.domElement.removeEventListener("pointerup", click);
        renderer.domElement.removeEventListener("dblclick", doubleClick);
        controls.dispose();
        for (const item of objects.values()) disposeRegionObjects(item);
        if (backdropObjects) disposeRegionObjects(backdropObjects);
        for (const item of locationObjects.values()) disposePointObjects(item);
        shadowCatcher.geometry.dispose();
        shadowCatcher.material.dispose();
        terrainTexture.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        regionObjects.current = new Map();
        pointObjects.current = new Map();
        sceneState.current = undefined;
        positionCallback.current?.(undefined);
        host.replaceChildren();
        delete host.dataset.pointCount;
        delete host.dataset.sceneVersion;
      };
    } catch (error) {
      onUnavailable(error instanceof Error ? error.message : "三维地图初始化失败");
    }
  }, [backdrop, features, onReady, onUnavailable, points, scopeLabel]);

  return (
    <div aria-label="行政区边界地图" className="overview-three-map" ref={container} />
  );
}

function createRegionObjects(
  feature: MapFeature,
  featureIndex: number,
  projection: (position: Position) => THREE.Vector2,
  terrainTexture: THREE.Texture,
): RegionObjects {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as Position[][]]
      : (feature.geometry.coordinates as Position[][][]);
  const topMaterials: THREE.ShaderMaterial[] = [];
  const sideMaterials: THREE.MeshPhysicalMaterial[] = [];
  const borderMaterials: (THREE.LineBasicMaterial | LineMaterial)[] = [];
  const contactShadows: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[] = [];
  const meshes = polygons.map((rings) => {
    const shape = ringShape(rings, projection);
    const contactShadow = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({
        color: 0x032f42,
        depthWrite: false,
        opacity: 0.012,
        transparent: true,
      }),
    );
    contactShadow.position.set(0, -0.006, -0.008);
    contactShadow.scale.set(1.002, 1.002, 1);
    contactShadow.renderOrder = -5;
    contactShadows.push(contactShadow);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      UVGenerator: overviewUvGenerator,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.024,
      bevelThickness: 0.026,
      curveSegments: 2,
      depth: REGION_DEPTH,
      steps: 1,
    });
    const top = createProjectedTerrainMaterial(terrainTexture);
    const side = new THREE.MeshPhysicalMaterial({
      color: 0x0a75b4,
      emissive: 0x088fd2,
      emissiveIntensity: 0.95,
      metalness: 0.04,
      roughness: 0.4,
      transparent: false,
    });
    topMaterials.push(top);
    sideMaterials.push(side);
    const mesh = new THREE.Mesh(geometry, [top, side]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.region = feature.region;
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xa7f1ff,
      transparent: true,
      opacity: 0.96,
    });
    borderMaterials.push(edgeMaterial);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 26),
      edgeMaterial,
    );
    mesh.add(edges);
    for (const ring of rings) {
      const positions = ring.flatMap((point) => {
        const projected = projection(point);
        return [projected.x, projected.y, REGION_SURFACE_Z];
      });
      const lineMaterial = new LineMaterial({
        color: 0xa8efff,
        depthTest: false,
        linewidth: 0.021,
        transparent: true,
        opacity: 0.98,
        worldUnits: true,
      });
      borderMaterials.push(lineMaterial);
      const boundary = new Line2(
        new LineGeometry().setPositions(positions),
        lineMaterial,
      );
      boundary.computeLineDistances();
      boundary.renderOrder = 10;
      mesh.add(boundary);
    }
    return mesh;
  });
  const marker = createMarker(
    projection(featureCenter(feature)),
    featureIndex,
    feature.region.name,
  );
  marker.visible = true;
  return {
    borderMaterials,
    contactShadows,
    marker,
    meshes,
    sideMaterials,
    topMaterials,
  };
}

const overviewUvGenerator: THREE.UVGenerator = {
  generateTopUV(_geometry, vertices, indexA, indexB, indexC) {
    return [indexA, indexB, indexC].map(
      (index) =>
        new THREE.Vector2(
          vertices[index * 3]! / 15.2 + 0.5,
          0.05 + (vertices[index * 3 + 1]! / 15.2 + 0.5) * 0.55,
        ),
    );
  },
  generateSideWallUV(_geometry, vertices, indexA, indexB, indexC, indexD) {
    return [indexA, indexB, indexC, indexD].map(
      (index) =>
        new THREE.Vector2(
          vertices[index * 3]! / 15.2 + 0.5,
          1 - vertices[index * 3 + 2]!,
        ),
    );
  },
};

function ringShape(
  rings: readonly Position[][],
  projection: (position: Position) => THREE.Vector2,
) {
  const shape = new THREE.Shape(rings[0]?.map(projection) ?? []);
  for (const hole of rings.slice(1))
    shape.holes.push(new THREE.Path(hole.map(projection)));
  return shape;
}

function createMarker(position: THREE.Vector2, index: number, regionName: string) {
  const marker = new THREE.Group();
  marker.position.set(position.x, position.y, REGION_SURFACE_Z);
  const color = index % 4 === 1 ? 0x83ecf2 : 0xb4fbff;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.015, 0.38, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 }),
  );
  stem.rotation.x = Math.PI / 2;
  stem.position.z = 0.19;
  stem.visible = false;
  marker.add(stem);
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    new THREE.MeshBasicMaterial({ color }),
  );
  point.position.z = 0.39;
  point.visible = false;
  marker.add(point);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.09, 0.115, 40),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.68,
    }),
  );
  ring.position.z = 0.03;
  ring.visible = false;
  marker.add(ring);

  const label = createLabel(regionName);
  label.position.set(0, 0, 0.63);
  marker.add(label);

  const selectionPulse = new THREE.Group();
  selectionPulse.name = "selectionPulse";
  selectionPulse.visible = false;
  const beamTexture = createBeamTexture();
  (
    [
      [-0.13, 1.85, 0.78],
      [-0.04, 2.7, 1],
      [0.055, 2.15, 0.88],
      [0.15, 1.55, 0.68],
    ] as const
  ).forEach(([x, height, opacity]) => {
    const beam = new THREE.Sprite(
      new THREE.SpriteMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xffd35c,
        depthTest: false,
        depthWrite: false,
        map: beamTexture,
        opacity,
        transparent: true,
      }),
    );
    beam.center.set(0.5, 0.04);
    beam.position.set(x, 0, 0.08);
    beam.scale.set(0.09, height, 1);
    beam.renderOrder = 40;
    selectionPulse.add(beam);
  });
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.31, 48),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xffe17b,
      depthWrite: false,
      opacity: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  halo.position.z = 0.04;
  selectionPulse.add(halo);
  const selectionLight = new THREE.PointLight(0xffc34f, 9, 5.4, 1.4);
  selectionLight.position.set(0, 0, 1.2);
  selectionPulse.add(selectionLight);
  marker.add(selectionPulse);
  return marker;
}

function createLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "600 42px PingFang SC, Microsoft YaHei, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(0, 49, 79, .95)";
    context.shadowBlur = 12;
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0, 65, 99, .8)";
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
    context.fillStyle = "#effdff";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      depthTest: false,
      map: texture,
      transparent: true,
    }),
  );
  sprite.renderOrder = 30;
  sprite.scale.set(2.28, 0.57, 1);
  return sprite;
}

function applySelection(
  objects: ReadonlyMap<string, RegionObjects>,
  selectedCode: string,
) {
  for (const [code, item] of objects) {
    const isSelected = code === selectedCode;
    item.topMaterials.forEach((material) => {
      (material.uniforms.surfaceTint?.value as THREE.Color | undefined)?.setHex(
        isSelected ? 0xffbd32 : 0x9fdbe5,
      );
      if (material.uniforms.tintStrength) {
        material.uniforms.tintStrength.value = isSelected ? 0.72 : 0.28;
      }
      if (material.uniforms.surfaceGlow) {
        material.uniforms.surfaceGlow.value = isSelected ? 0.2 : 0.025;
      }
    });
    item.sideMaterials.forEach((material) => {
      material.color.setHex(isSelected ? 0xd88917 : 0x168fc1);
      material.emissive.setHex(isSelected ? 0xffa11c : 0x0b6fa5);
      material.emissiveIntensity = isSelected ? 0.8 : 0.62;
      material.needsUpdate = true;
    });
    item.borderMaterials.forEach((material) => {
      material.color.setHex(
        isSelected ? 0xffe48a : material instanceof LineMaterial ? 0xa8efff : 0xa7f1ff,
      );
      material.needsUpdate = true;
    });
    item.meshes.forEach((mesh) => {
      mesh.position.z = isSelected ? 0.035 : 0;
    });
    const pulse = item.marker.getObjectByName("selectionPulse");
    if (pulse) pulse.visible = isSelected;
  }
}

function createLocationPoint(
  point: MapPointFeature,
  index: number,
  projection: (position: Position) => THREE.Vector2,
  showLabel: boolean,
): PointObjects {
  const position = projection(point.position);
  const group = new THREE.Group();
  group.position.set(position.x, position.y, REGION_SURFACE_Z);
  const isVillage = point.region.level === "VILLAGE";
  const compact = isVillage || !showLabel;
  const nonAdministrativeMatch =
    point.region.locationReviewStatus === "EXACT_NAME_NON_ADMIN_POINT_PENDING_REVIEW";
  const color = nonAdministrativeMatch
    ? 0xffc75a
    : index % 3 === 0
      ? 0xb9fbff
      : 0x72e8f5;
  const pointMaterial = new THREE.MeshBasicMaterial({
    blending: compact ? THREE.AdditiveBlending : THREE.NormalBlending,
    color,
    depthTest: !compact,
    depthWrite: !compact,
    opacity: 0.96,
    transparent: compact,
  });
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(compact ? 0.018 : 0.095, 18, 12),
    pointMaterial,
  );
  core.position.z = compact ? 0.045 : 0.28;
  core.renderOrder = compact ? 20 : 0;
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(compact ? 0.024 : 0.15, compact ? 0.03 : 0.19, 36),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthTest: !compact,
      depthWrite: false,
      opacity: compact ? 0.44 : 0.82,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  ring.position.z = 0.04;
  group.add(ring);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(compact ? 0.055 : 0.32, 40),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthTest: !compact,
      depthWrite: false,
      opacity: compact ? 0.05 : 0.16,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  halo.position.z = 0.025;
  group.add(halo);
  if (!isVillage && showLabel) {
    const label = createLabel(point.region.name);
    label.position.set(0, 0, 0.72);
    label.scale.set(1.82, 0.46, 1);
    group.add(label);
  }
  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(compact ? 0.055 : 0.3, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitTarget.position.z = 0.3;
  hitTarget.userData.region = point.region;
  group.add(hitTarget);
  const selectionPulse = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.34, 44),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xffdc66,
      depthWrite: false,
      opacity: 0.95,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  selectionPulse.name = "selectionPulse";
  selectionPulse.position.z = 0.055;
  selectionPulse.visible = false;
  group.add(selectionPulse);
  return { baseColor: color, group, hitTarget, pointMaterial };
}

function applyPointSelection(
  objects: ReadonlyMap<string, PointObjects>,
  selectedCode: string,
) {
  for (const [code, item] of objects) {
    const isSelected = code === selectedCode;
    item.pointMaterial.color.setHex(isSelected ? 0xffd45c : item.baseColor);
    const pulse = item.group.getObjectByName("selectionPulse");
    if (pulse) pulse.visible = isSelected;
  }
}

function createProjection(
  features: readonly MapFeature[],
  pointFeatures: readonly MapPointFeature[],
) {
  const boundaryPositions = features.flatMap((feature) =>
    flattenCoordinates(feature.geometry),
  );
  const positions = boundaryPositions.length
    ? boundaryPositions
    : pointFeatures.map((feature) => feature.position);
  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  const centerLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const longitudeFactor = Math.cos(THREE.MathUtils.degToRad(centerLatitude));
  const width = (Math.max(...longitudes) - Math.min(...longitudes)) * longitudeFactor;
  const height = Math.max(...latitudes) - Math.min(...latitudes);
  const scale = 15.2 / Math.max(width, height, 0.025);
  return ([longitude, latitude]: Position) =>
    new THREE.Vector2(
      (longitude - centerLongitude) * longitudeFactor * scale,
      (latitude - centerLatitude) * scale,
    );
}

function featureCenter(feature: MapFeature): Position {
  const points = flattenCoordinates(feature.geometry);
  const totals = points.reduce(
    (sum, [longitude, latitude]) => [sum[0] + longitude, sum[1] + latitude],
    [0, 0] as Position,
  );
  return [totals[0] / points.length, totals[1] / points.length];
}

function resetCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  group: THREE.Group,
) {
  camera.position.set(0, 26, 16);
  camera.up.set(0, 1, 0);
  controls.target.set(0, 0, -0.3);
  group.position.set(0.15, 0, -2.2);
  group.rotation.set(THREE.MathUtils.degToRad(-90), 0, THREE.MathUtils.degToRad(-3));
  group.scale.set(1.04, 0.64, 1);
  controls.update();
}

function createTerrainTexture(renderer: THREE.WebGLRenderer) {
  const texture = new THREE.TextureLoader().load("/overview/command-terrain-v2.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createProjectedTerrainMaterial(texture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    fragmentShader: `
      uniform sampler2D terrainMap;
      uniform vec2 stageFraction;
      uniform vec3 surfaceTint;
      uniform float tintStrength;
      uniform float surfaceGlow;
      varying vec2 groundUv;
      varying vec3 surfaceNormal;

      void main() {
        vec2 sampleUv = clamp(groundUv * stageFraction, vec2(0.002), vec2(0.998));
        vec3 terrain = texture2D(terrainMap, sampleUv).rgb;
        vec3 tintedTerrain = terrain * surfaceTint * 1.18;
        float diffuse = 0.9 + max(dot(normalize(surfaceNormal), normalize(vec3(-0.2, 0.6, 1.0))), 0.0) * 0.1;
        vec3 surface = mix(terrain, tintedTerrain, tintStrength) * diffuse;
        surface += surfaceTint * surfaceGlow;
        surface = pow(clamp(surface, 0.0, 1.0), vec3(1.0 / 2.2));
        gl_FragColor = vec4(surface, 1.0);
      }
    `,
    uniforms: {
      terrainMap: { value: texture },
      stageFraction: { value: new THREE.Vector2(1, 1) },
      surfaceTint: { value: new THREE.Color(0x9fdbe5) },
      tintStrength: { value: 0.28 },
      surfaceGlow: { value: 0.025 },
    },
    toneMapped: false,
    vertexShader: `
      varying vec2 groundUv;
      varying vec3 surfaceNormal;

      void main() {
        vec4 groundPosition = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
        groundUv = groundPosition.xy / groundPosition.w * 0.5 + 0.5;
        surfaceNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
}

function updateSurfaceViewport(
  objects: ReadonlyMap<string, RegionObjects>,
  backdrop: RegionObjects | undefined,
  stageFraction: THREE.Vector2,
) {
  const regions = backdrop ? [backdrop, ...objects.values()] : [...objects.values()];
  for (const item of regions) {
    for (const material of item.topMaterials) {
      (material.uniforms.stageFraction?.value as THREE.Vector2 | undefined)?.copy(
        stageFraction,
      );
    }
  }
}

function createBeamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const horizontal = context.createLinearGradient(0, 0, 48, 0);
    horizontal.addColorStop(0, "rgba(255,191,48,0)");
    horizontal.addColorStop(0.5, "rgba(255,245,177,.96)");
    horizontal.addColorStop(1, "rgba(255,191,48,0)");
    context.fillStyle = horizontal;
    context.fillRect(0, 0, 48, 512);
    context.globalCompositeOperation = "destination-in";
    const vertical = context.createLinearGradient(0, 0, 0, 512);
    vertical.addColorStop(0, "rgba(255,255,255,0)");
    vertical.addColorStop(0.48, "rgba(255,255,255,.22)");
    vertical.addColorStop(1, "rgba(255,255,255,1)");
    context.fillStyle = vertical;
    context.fillRect(0, 0, 48, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function disposeRegionObjects(item: RegionObjects) {
  for (const shadow of item.contactShadows) {
    shadow.geometry.dispose();
    shadow.material.dispose();
  }
  for (const mesh of item.meshes) {
    mesh.geometry.dispose();
    mesh.material.forEach((material) => material.dispose());
    mesh.traverse((object) => {
      if (object instanceof THREE.Line) {
        disposeRenderableObject(object);
      }
    });
  }
  item.marker.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      disposeRenderableObject(object);
    }
    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
    }
  });
}

function disposePointObjects(item: PointObjects) {
  item.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      disposeRenderableObject(object);
    }
    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
    }
  });
}

function disposeRenderableObject(object: THREE.Object3D) {
  const renderable = object as THREE.Object3D & {
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
  };
  renderable.geometry.dispose();
  const materials = Array.isArray(renderable.material)
    ? renderable.material
    : [renderable.material];
  materials.forEach((material) => material.dispose());
}
