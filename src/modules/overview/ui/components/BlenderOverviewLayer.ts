import {
  AmbientLight,
  Camera,
  DirectionalLight,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from "maplibre-gl";

import {
  blenderRegionVisualState,
  type BlenderAtlasManifest,
} from "./blenderAtlasContract";

interface RendererAdapter {
  dispose(): void;
  render(scene: Scene, camera: Camera): void;
  resetState(): void;
}

interface BlenderOverviewLayerOptions {
  createRenderer?: (
    canvas: HTMLCanvasElement,
    context: WebGL2RenderingContext,
  ) => RendererAdapter;
  loadScene?: (asset: string, signal: AbortSignal) => Promise<Group>;
  manifest: BlenderAtlasManifest;
  onFailure?: (error: Error) => void;
  onReady?: () => void;
}

export interface BlenderOverviewController {
  dispose(): void;
  setEnabled(enabled: boolean): void;
  setHoveredRegion(code: string | undefined): void;
  setSelectedRegion(code: string | undefined): void;
  setVisibleRegionCodes(codes: readonly string[]): void;
}

export type BlenderOverviewLayer = CustomLayerInterface & BlenderOverviewController;

async function loadBlenderScene(asset: string, signal: AbortSignal): Promise<Group> {
  const response = await fetch(asset, { signal });
  if (!response.ok) throw new Error(`Blender atlas returned HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  signal.throwIfAborted();
  const basePath = asset.slice(0, asset.lastIndexOf("/") + 1);
  return (await new GLTFLoader().parseAsync(buffer, basePath)).scene;
}

function defaultRenderer(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
): RendererAdapter {
  const renderer = new WebGLRenderer({ antialias: true, canvas, context });
  renderer.autoClear = false;
  return renderer;
}

function materialsOf(item: Mesh): Material[] {
  return Array.isArray(item.material) ? item.material : [item.material];
}

function disposeObject(root: Object3D) {
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    item.geometry.dispose();
    materialsOf(item).forEach((material) => material.dispose());
  });
}

export function createBlenderOverviewLayer({
  createRenderer = defaultRenderer,
  loadScene = loadBlenderScene,
  manifest,
  onFailure,
  onReady,
}: BlenderOverviewLayerOptions): BlenderOverviewLayer {
  const scene = new Scene();
  scene.add(new AmbientLight(0xbfe9df, 1.7));
  const directional = new DirectionalLight(0xfff4d5, 2.4);
  directional.position.set(-0.4, 0.8, 1.2);
  scene.add(directional);
  const camera = new Camera();
  const mercatorOrigin = MercatorCoordinate.fromLngLat(
    { lng: manifest.origin[0], lat: manifest.origin[1] },
    0,
  );
  const scale = mercatorOrigin.meterInMercatorCoordinateUnits();
  const localTransform = new Matrix4()
    .makeTranslation(mercatorOrigin.x, mercatorOrigin.y, mercatorOrigin.z)
    .scale(new Vector3(scale, -scale, scale))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2));
  const abortController = new AbortController();
  let map: MapLibreMap | undefined;
  let renderer: RendererAdapter | undefined;
  let modelRoot: Group | undefined;
  let disposed = false;
  let started = false;
  let enabled = true;
  let selectedCode: string | undefined;
  let hoveredCode: string | undefined;
  let visibleCodes: Set<string> = new Set(manifest.regions.map(({ code }) => code));

  function updateVisualState() {
    if (!modelRoot) return;
    manifest.regions.forEach(({ code, objectName }) => {
      const item = modelRoot?.getObjectByName(objectName);
      if (!(item instanceof Mesh)) return;
      const state = blenderRegionVisualState(
        code,
        selectedCode,
        hoveredCode,
        enabled && visibleCodes.has(code),
      );
      item.visible = state.visible;
      item.position.y = state.raisedMeters;
      materialsOf(item).forEach((material) => {
        material.opacity = state.opacity;
        material.transparent = state.opacity < 1;
        if (material instanceof MeshStandardMaterial) {
          material.emissive.set("#78e7d2");
          material.emissiveIntensity = state.emissiveIntensity;
        }
        material.needsUpdate = true;
      });
    });
    map?.triggerRepaint();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    if (modelRoot) {
      scene.remove(modelRoot);
      disposeObject(modelRoot);
      modelRoot = undefined;
    }
    renderer?.dispose();
    renderer = undefined;
    map = undefined;
  }

  const layer: BlenderOverviewLayer = {
    id: "atlas-blender-enhancement",
    type: "custom",
    renderingMode: "3d",
    dispose,
    onAdd(nextMap, context) {
      if (disposed || started) return;
      started = true;
      map = nextMap;
      renderer = createRenderer(nextMap.getCanvas(), context);
      void loadScene(manifest.asset, abortController.signal)
        .then((root) => {
          if (disposed) {
            disposeObject(root);
            return;
          }
          modelRoot = root;
          scene.add(root);
          updateVisualState();
          onReady?.();
        })
        .catch((cause: unknown) => {
          if (disposed || abortController.signal.aborted) return;
          onFailure?.(
            cause instanceof Error ? cause : new Error("Blender atlas failed to load"),
          );
        });
    },
    onRemove() {
      dispose();
    },
    render(_context: WebGL2RenderingContext, options: CustomRenderMethodInput) {
      if (!renderer || !modelRoot || !enabled || disposed) return;
      camera.projectionMatrix
        .fromArray(options.modelViewProjectionMatrix as unknown as number[])
        .multiply(localTransform);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      updateVisualState();
    },
    setHoveredRegion(code) {
      hoveredCode = code;
      updateVisualState();
    },
    setSelectedRegion(code) {
      selectedCode = code;
      updateVisualState();
    },
    setVisibleRegionCodes(codes) {
      visibleCodes = new Set(codes);
      updateVisualState();
    },
  };
  return layer;
}
