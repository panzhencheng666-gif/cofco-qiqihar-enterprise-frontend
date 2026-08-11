import "cesium/Build/Cesium/Widgets/widgets.css";
import * as CesiumRuntimeModule from "cesium";
import { useEffect, useRef } from "react";
import type * as Cesium from "cesium";

import type { OverviewRegion } from "../../domain/overview";
import {
  flattenCoordinates,
  type MapFeature,
  type OverviewMapCommand,
  type Position,
} from "./boundaryGeometry";

type CesiumRuntime = typeof CesiumRuntimeModule;
let terrainTexture: HTMLImageElement | undefined;

export default function CesiumBoundaryMap({
  features,
  selectedCode,
  onSelect,
  onDrill,
  onUnavailable,
  onReady,
  command,
}: {
  features: readonly MapFeature[];
  selectedCode: string;
  onSelect: (region: OverviewRegion) => void;
  onDrill: (region: OverviewRegion) => void;
  onUnavailable: (reason: string) => void;
  onReady: () => void;
  command?: OverviewMapCommand;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Cesium.Viewer | undefined>(undefined);
  const entitiesByRegion = useRef(new Map<string, Cesium.Entity[]>());
  const selectRegion = useRef(onSelect);
  const drillRegion = useRef(onDrill);
  const selectedRegion = useRef(selectedCode);

  useEffect(() => {
    selectRegion.current = onSelect;
    drillRegion.current = onDrill;
  }, [onDrill, onSelect]);

  useEffect(() => {
    selectedRegion.current = selectedCode;
    if (!viewer.current) return;
    applySelection(CesiumRuntimeModule, entitiesByRegion.current, selectedCode);
  }, [selectedCode]);

  useEffect(() => {
    const activeViewer = viewer.current;
    if (!activeViewer || !command) return;
    const distance = Math.max(
      activeViewer.camera.positionCartographic.height * 0.18,
      25000,
    );
    if (command.type === "ZOOM_IN") activeViewer.camera.zoomIn(distance);
    if (command.type === "ZOOM_OUT") activeViewer.camera.zoomOut(distance);
    if (command.type === "ROTATE")
      activeViewer.camera.rotateRight(CesiumRuntimeModule.Math.toRadians(12));
    if (command.type === "RESET")
      fitCamera(CesiumRuntimeModule, activeViewer, features);
  }, [command, features]);

  useEffect(() => {
    if (!container.current) return;
    let active = true;
    let cleanup: () => void = () => {};
    void createScene({
      container: container.current,
      features,
      onDrill: (region) => drillRegion.current(region),
      onSelect: (region) => selectRegion.current(region),
      onUnavailable,
    })
      .then((scene) => {
        if (!active) {
          scene.destroy();
          return;
        }
        viewer.current = scene.viewer;
        entitiesByRegion.current = scene.entitiesByRegion;
        cleanup = () => scene.destroy();
        applySelection(scene.runtime, scene.entitiesByRegion, selectedRegion.current);
        onReady();
      })
      .catch((error: unknown) => {
        if (!active) return;
        onUnavailable(error instanceof Error ? error.message : "三维场景初始化失败");
      });
    return () => {
      active = false;
      viewer.current = undefined;
      entitiesByRegion.current = new Map();
      cleanup();
    };
  }, [features, onReady, onUnavailable]);

  return (
    <div
      aria-label="行政区边界地图"
      role="img"
      className="overview-cesium-map"
      ref={container}
    />
  );
}

async function createScene({
  container,
  features,
  onSelect,
  onDrill,
  onUnavailable,
}: {
  container: HTMLDivElement;
  features: readonly MapFeature[];
  onSelect: (region: OverviewRegion) => void;
  onDrill: (region: OverviewRegion) => void;
  onUnavailable: (reason: string) => void;
}) {
  container.dataset.overviewScene = "loading-runtime";
  const runtime = await loadCesium();
  const texture = await loadTerrainTexture();
  container.dataset.overviewScene = "creating-viewer";
  const creditContainer = document.createElement("div");
  creditContainer.className = "overview-cesium-credits";
  container.append(creditContainer);
  const viewer = new runtime.Viewer(container, {
    animation: false,
    baseLayer: false,
    baseLayerPicker: false,
    contextOptions: {
      webgl: {
        alpha: true,
      },
    },
    creditContainer,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
  });
  container.dataset.overviewScene = "viewer-created";
  viewer.scene.backgroundColor = runtime.Color.TRANSPARENT;
  viewer.scene.globe.show = false;
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
  if (viewer.scene.sun) viewer.scene.sun.show = false;
  if (viewer.scene.moon) viewer.scene.moon.show = false;
  viewer.scene.screenSpaceCameraController.enableTilt = true;
  viewer.scene.screenSpaceCameraController.enableLook = false;
  viewer.scene.postProcessStages.fxaa.enabled = true;
  viewer.scene.highDynamicRange = true;
  viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);

  const entitiesByRegion = new Map<string, Cesium.Entity[]>();
  for (const feature of features) {
    const regionEntities = createRegionEntities(runtime, viewer, feature, texture);
    entitiesByRegion.set(feature.region.code, regionEntities);
  }
  fitCamera(runtime, viewer, features);

  const handler = new runtime.ScreenSpaceEventHandler(viewer.scene.canvas);
  const regionAt = (position: Cesium.Cartesian2) => {
    const picked = viewer.scene.pick(position) as { id?: unknown } | undefined;
    const id = picked?.id;
    if (!(id instanceof runtime.Entity)) return undefined;
    return features.find((feature) =>
      entitiesByRegion.get(feature.region.code)?.includes(id),
    )?.region;
  };
  handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
    const region = regionAt(movement.position);
    if (region) onSelect(region);
  }, runtime.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
    const region = regionAt(movement.position);
    if (region) onDrill(region);
  }, runtime.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  viewer.scene.canvas.addEventListener(
    "webglcontextlost",
    () => onUnavailable("WebGL 上下文已丢失"),
    { once: true },
  );

  return {
    runtime,
    viewer,
    entitiesByRegion,
    destroy() {
      handler.destroy();
      viewer.destroy();
    },
  };
}

function loadCesium(): Promise<CesiumRuntime> {
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/Cesium";
  return Promise.resolve(CesiumRuntimeModule);
}

async function loadTerrainTexture() {
  if (terrainTexture) return terrainTexture;
  const image = new Image();
  image.decoding = "async";
  image.src = "/overview/ice-terrain-relief.png";
  await image.decode();
  terrainTexture = image;
  return image;
}

function createRegionEntities(
  runtime: CesiumRuntime,
  viewer: Cesium.Viewer,
  feature: MapFeature,
  texture: HTMLImageElement,
) {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as Position[][]]
      : (feature.geometry.coordinates as Position[][][]);
  const entities = polygons.flatMap((rings, index) => {
    const hierarchy = toHierarchy(runtime, rings);
    const wallPositions = positionsFromRing(runtime, rings[0] ?? []);
    return [
      viewer.entities.add({
        id: `${feature.region.code}-${index}-wall`,
        wall: {
          maximumHeights: new Array(wallPositions.length).fill(7200),
          material: runtime.Color.fromCssColorString("#24577f").withAlpha(0.96),
          minimumHeights: new Array(wallPositions.length).fill(-52000),
          positions: wallPositions,
        },
      }),
      viewer.entities.add({
        id: `${feature.region.code}-${index}-top`,
        polygon: {
          arcType: runtime.ArcType.GEODESIC,
          height: 7200,
          hierarchy,
          material: iceMaterial(runtime, false, texture),
          outline: true,
          outlineColor: runtime.Color.fromCssColorString("#f8feff"),
          perPositionHeight: false,
        },
      }),
    ];
  });
  const [longitude, latitude] = featureCenter(feature);
  const markerHeight = 42000;
  entities.push(
    viewer.entities.add({
      id: `${feature.region.code}-marker`,
      position: runtime.Cartesian3.fromDegrees(longitude, latitude, markerHeight),
      point: {
        color: runtime.Color.fromCssColorString("#5fd6e6"),
        outlineColor: runtime.Color.WHITE,
        outlineWidth: 2,
        pixelSize: 8,
      },
      polyline: {
        positions: runtime.Cartesian3.fromDegreesArrayHeights([
          longitude,
          latitude,
          7300,
          longitude,
          latitude,
          markerHeight,
        ]),
        width: 2.5,
        material: new runtime.PolylineGlowMaterialProperty({
          color: runtime.Color.fromCssColorString("#55d4e8").withAlpha(0.94),
          glowPower: 0.32,
        }),
      },
      ellipse: {
        height: 7600,
        material: runtime.Color.fromCssColorString("#76e6ee").withAlpha(0.16),
        outline: true,
        outlineColor: runtime.Color.fromCssColorString("#ecffff").withAlpha(0.86),
        semiMajorAxis: 15500,
        semiMinorAxis: 15500,
      },
      label: {
        text: feature.region.name,
        show: false,
        pixelOffset: new runtime.Cartesian2(0, -22),
        fillColor: runtime.Color.fromCssColorString("#124a78"),
        outlineColor: runtime.Color.WHITE,
        outlineWidth: 4,
        style: runtime.LabelStyle.FILL_AND_OUTLINE,
        font: '600 15px "PingFang SC", sans-serif',
      },
    }),
  );
  return entities;
}

function iceMaterial(
  runtime: CesiumRuntime,
  selected: boolean,
  texture = terrainTexture,
) {
  return new runtime.ImageMaterialProperty({
    image: texture ?? "/overview/ice-terrain-relief.png",
    repeat: new runtime.Cartesian2(1.45, 1.45),
    color: runtime.Color.fromCssColorString(selected ? "#64ded5" : "#ffffff"),
    transparent: false,
  });
}

function featureCenter(feature: MapFeature): Position {
  const points = flattenCoordinates(feature.geometry);
  if (!points.length) return [0, 0];
  const totals = points.reduce(
    (sum, [longitude, latitude]) => [sum[0] + longitude, sum[1] + latitude],
    [0, 0] as Position,
  );
  return [totals[0] / points.length, totals[1] / points.length];
}

function toHierarchy(runtime: CesiumRuntime, rings: readonly Position[][]) {
  const [outer, ...holes] = rings;
  return new runtime.PolygonHierarchy(
    positionsFromRing(runtime, outer ?? []),
    holes.map((hole) => new runtime.PolygonHierarchy(positionsFromRing(runtime, hole))),
  );
}

function positionsFromRing(runtime: CesiumRuntime, ring: readonly Position[]) {
  return runtime.Cartesian3.fromDegreesArray(
    ring.flatMap(([longitude, latitude]) => [longitude, latitude]),
  );
}

function fitCamera(
  runtime: CesiumRuntime,
  viewer: Cesium.Viewer,
  features: readonly MapFeature[],
) {
  const points = flattenCoordinatesForCamera(runtime, features);
  if (!points.length) return;
  const sphere = runtime.BoundingSphere.fromPoints(points);
  viewer.camera.flyToBoundingSphere(sphere, {
    duration: 0,
    offset: new runtime.HeadingPitchRange(
      runtime.Math.toRadians(-18),
      runtime.Math.toRadians(-50),
      sphere.radius * 2.36,
    ),
  });
}

function flattenCoordinatesForCamera(
  runtime: CesiumRuntime,
  features: readonly MapFeature[],
) {
  return features.flatMap(({ geometry }) =>
    flattenCoordinates(geometry).map(([longitude, latitude]) =>
      runtime.Cartesian3.fromDegrees(longitude, latitude, 7300),
    ),
  );
}

function applySelection(
  runtime: CesiumRuntime,
  entitiesByRegion: ReadonlyMap<string, readonly Cesium.Entity[]>,
  selectedCode: string,
) {
  for (const [code, entities] of entitiesByRegion) {
    const selected = code === selectedCode;
    for (const entity of entities) {
      const id = String(entity.id);
      if (entity.polygon && id.endsWith("-base")) {
        entity.polygon.material = new runtime.ColorMaterialProperty(
          runtime.Color.fromCssColorString(selected ? "#159e9b" : "#356f9b").withAlpha(
            selected ? 0.86 : 0.84,
          ),
        );
      }
      if (entity.wall) {
        entity.wall.material = new runtime.ColorMaterialProperty(
          runtime.Color.fromCssColorString(selected ? "#167a82" : "#24577f").withAlpha(
            selected ? 0.96 : 0.96,
          ),
        );
      }
      if (entity.polygon && id.endsWith("-top")) {
        entity.polygon.height = new runtime.ConstantProperty(selected ? 7600 : 7200);
        entity.polygon.material = iceMaterial(runtime, selected);
        entity.polygon.outlineColor = new runtime.ConstantProperty(
          runtime.Color.fromCssColorString(selected ? "#ffffff" : "#e8faff"),
        );
      }
      if (entity.point) {
        entity.point.pixelSize = new runtime.ConstantProperty(selected ? 13 : 8);
        entity.point.color = new runtime.ConstantProperty(
          runtime.Color.fromCssColorString(selected ? "#26d6c3" : "#5cbbdb"),
        );
      }
      if (entity.label) entity.label.show = new runtime.ConstantProperty(selected);
    }
  }
}
