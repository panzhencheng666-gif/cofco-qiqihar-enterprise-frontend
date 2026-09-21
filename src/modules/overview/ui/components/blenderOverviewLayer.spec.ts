import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import type { BlenderAtlasManifest } from "./blenderAtlasContract";
import { createBlenderOverviewLayer } from "./BlenderOverviewLayer";

const manifest: BlenderAtlasManifest = {
  asset: "/overview-monitoring/overview/blender/four-region-atlas.glb",
  bounds: [120, 46, 130, 54],
  generatedAt: "2026-09-01T00:00:00Z",
  origin: [125, 50],
  projection: "EPSG:3857_LOCAL_METRES",
  regions: [
    { code: "230200", name: "齐齐哈尔市", objectName: "region_230200" },
    { code: "231100", name: "黑河市", objectName: "region_231100" },
    { code: "150700", name: "呼伦贝尔市", objectName: "region_150700" },
    { code: "232700", name: "大兴安岭地区", objectName: "region_232700" },
  ],
  sourceName: "source",
  sourceRevision: "revision",
  version: 1,
};

function model() {
  const root = new Group();
  manifest.regions.forEach(({ objectName }) => {
    const mesh = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: "#17685d" }),
    );
    mesh.name = objectName;
    root.add(mesh);
  });
  return root;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe("Blender overview custom layer", () => {
  it("applies queued visibility, hover, and selection after the GLB loads", async () => {
    const ready = deferred<void>();
    const scene = model();
    const repaint = vi.fn();
    const layer = createBlenderOverviewLayer({
      manifest,
      loadScene: async () => scene,
      createRenderer: () => ({
        dispose: vi.fn(),
        render: vi.fn(),
        resetState: vi.fn(),
      }),
      onReady: () => ready.resolve(),
    });
    layer.setVisibleRegionCodes(["230200", "231100"]);
    layer.setSelectedRegion("230200");
    layer.setHoveredRegion("231100");

    layer.onAdd?.(
      {
        getCanvas: () => document.createElement("canvas"),
        triggerRepaint: repaint,
      } as never,
      {} as WebGL2RenderingContext,
    );
    await ready.promise;

    const selected = scene.getObjectByName("region_230200") as Mesh;
    const hovered = scene.getObjectByName("region_231100") as Mesh;
    const hidden = scene.getObjectByName("region_150700") as Mesh;
    expect(selected.position.y).toBe(900);
    expect((selected.material as MeshStandardMaterial).emissiveIntensity).toBe(0.65);
    expect(hovered.position.y).toBe(320);
    expect(hidden.visible).toBe(false);
    expect(repaint).toHaveBeenCalled();
  });

  it("disposes geometry, materials, and renderer exactly once", async () => {
    const ready = deferred<void>();
    const scene = model();
    const geometry = (scene.children[0] as Mesh).geometry;
    const material = (scene.children[0] as Mesh).material as MeshStandardMaterial;
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const rendererDispose = vi.fn();
    const layer = createBlenderOverviewLayer({
      manifest,
      loadScene: async () => scene,
      createRenderer: () => ({
        dispose: rendererDispose,
        render: vi.fn(),
        resetState: vi.fn(),
      }),
      onReady: () => ready.resolve(),
    });
    const map = {
      getCanvas: () => document.createElement("canvas"),
      triggerRepaint: vi.fn(),
    } as never;
    layer.onAdd?.(map, {} as WebGL2RenderingContext);
    await ready.promise;

    layer.onRemove?.(map, {} as WebGL2RenderingContext);
    layer.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(rendererDispose).toHaveBeenCalledTimes(1);
  });
});
