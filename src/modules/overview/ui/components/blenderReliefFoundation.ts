import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Scene,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  blenderRegionVisualState,
  parseBlenderAtlasManifest,
  type BlenderAtlasManifest,
} from "./blenderAtlasContract";

const FOUR_REGION_CODES = new Set(["230200", "231100", "150700", "232700"]);
const FOUNDATION_TOP_Z = 1.4;
const FOUNDATION_Z_SCALE = 0.0075;
const FOOTPRINT_PADDING = 1.018;

export interface BlenderFoundationBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface BlenderReliefFoundationController {
  dispose(): void;
  setEnabled(enabled: boolean): void;
  setHoveredRegion(code: string | undefined): void;
  setSelectedRegion(code: string | undefined): void;
}

interface LoadBlenderReliefFoundationOptions {
  enabled: boolean;
  manifestUrl: string;
  scene: Scene | Group;
  selectedCode?: string;
  signal: AbortSignal;
  targetBounds: BlenderFoundationBounds;
}

type FoundationMesh = Mesh<BufferGeometry, Material | Material[]>;

function isFoundationMesh(item: Object3D): item is FoundationMesh {
  return item instanceof Mesh;
}

function materialsOf(mesh: FoundationMesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function disposeModel(root: Group) {
  root.traverse((item) => {
    if (!isFoundationMesh(item)) return;
    item.geometry.dispose();
    materialsOf(item).forEach((material) => material.dispose());
  });
}

function cloneFoundationMaterials(root: Group) {
  root.traverse((item) => {
    if (!isFoundationMesh(item)) return;
    const cloned = materialsOf(item).map((material) => {
      const color =
        "color" in material && material.color instanceof Color
          ? material.color
          : new Color("#164c45");
      return new MeshStandardMaterial({
        color,
        depthTest: true,
        depthWrite: false,
        emissive: new Color("#2ab9a5"),
        emissiveIntensity: 0.08,
        metalness: 0.24,
        opacity: 0.42,
        roughness: 0.46,
        transparent: true,
      });
    });
    materialsOf(item).forEach((material) => material.dispose());
    item.material = cloned.length === 1 ? cloned[0]! : cloned;
    item.renderOrder = 2;
  });
}

export function isFourRegionBlenderScope(codes: readonly string[]) {
  const governedCodes = new Set(codes.filter((code) => !code.startsWith("CTX:")));
  return (
    governedCodes.size === FOUR_REGION_CODES.size &&
    [...FOUR_REGION_CODES].every((code) => governedCodes.has(code))
  );
}

export function blenderFoundationTransform(
  modelBounds: Box3,
  targetBounds: BlenderFoundationBounds,
) {
  const modelSize = modelBounds.getSize(new Vector3());
  const modelCenter = modelBounds.getCenter(new Vector3());
  const targetWidth = Math.max(targetBounds.maxX - targetBounds.minX, 1);
  const targetHeight = Math.max(targetBounds.maxY - targetBounds.minY, 1);
  const scale = new Vector3(
    (targetWidth / Math.max(modelSize.x, 1)) * FOOTPRINT_PADDING,
    (targetHeight / Math.max(modelSize.y, 1)) * FOOTPRINT_PADDING,
    FOUNDATION_Z_SCALE,
  );
  const targetCenterX = (targetBounds.minX + targetBounds.maxX) / 2;
  const targetCenterY = (targetBounds.minY + targetBounds.maxY) / 2;
  const position = new Vector3(
    targetCenterX - modelCenter.x * scale.x,
    targetCenterY - modelCenter.y * scale.y,
    FOUNDATION_TOP_Z - modelBounds.max.z * scale.z,
  );
  return { position, scale } as const;
}

async function fetchManifest(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(`Blender atlas manifest returned HTTP ${response.status}`);
  return parseBlenderAtlasManifest(await response.json());
}

async function fetchModel(manifest: BlenderAtlasManifest, signal: AbortSignal) {
  const response = await fetch(manifest.asset, { signal });
  if (!response.ok) throw new Error(`Blender atlas returned HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  signal.throwIfAborted();
  const basePath = manifest.asset.slice(0, manifest.asset.lastIndexOf("/") + 1);
  return (await new GLTFLoader().parseAsync(buffer, basePath)).scene;
}

export async function loadBlenderReliefFoundation({
  enabled: initialEnabled,
  manifestUrl,
  scene,
  selectedCode: initialSelectedCode,
  signal,
  targetBounds,
}: LoadBlenderReliefFoundationOptions): Promise<BlenderReliefFoundationController> {
  const manifest = await fetchManifest(manifestUrl, signal);
  const model = await fetchModel(manifest, signal);
  signal.throwIfAborted();
  model.rotation.x = Math.PI / 2;
  model.updateMatrixWorld(true);
  const modelBounds = new Box3().setFromObject(model);
  if (modelBounds.isEmpty()) {
    disposeModel(model);
    throw new Error("Blender atlas contains no renderable geometry");
  }
  cloneFoundationMaterials(model);
  const container = new Group();
  container.name = "blender_sample_map_foundation";
  container.add(model);
  const transform = blenderFoundationTransform(modelBounds, targetBounds);
  container.position.copy(transform.position);
  container.scale.copy(transform.scale);
  scene.add(container);

  let enabled = initialEnabled;
  let hoveredCode: string | undefined;
  let selectedCode = initialSelectedCode;
  let disposed = false;

  const update = () => {
    container.visible = enabled;
    manifest.regions.forEach(({ code, objectName }) => {
      const item = model.getObjectByName(objectName);
      if (!item || !isFoundationMesh(item)) return;
      const state = blenderRegionVisualState(code, selectedCode, hoveredCode, enabled);
      materialsOf(item).forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) return;
        material.opacity = state.visible
          ? selectedCode && code !== selectedCode
            ? 0.28
            : state.opacity * 0.42
          : 0;
        material.emissiveIntensity = state.emissiveIntensity;
        material.needsUpdate = true;
      });
    });
  };
  update();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(container);
      disposeModel(model);
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      update();
    },
    setHoveredRegion(code) {
      hoveredCode = code;
      update();
    },
    setSelectedRegion(code) {
      selectedCode = code;
      update();
    },
  };
}
