import "cesium/Build/Cesium/Widgets/widgets.css";
import "./realistic-operational-situation.css";

import * as CesiumRuntimeModule from "cesium";
import { useEffect, useRef } from "react";
import type * as Cesium from "cesium";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import { publicAssetUrl } from "../../../../shared/assets/publicAssetUrl";
import { flattenCoordinates, type MapFeature, type Position } from "./boundaryGeometry";
import {
  realisticSituationIcon,
  realisticWeatherIcon,
} from "./realisticSituationIcons";
import {
  altitudeDetailLevel,
  realisticCamera,
  situationFeatureId,
  SituationViewerLifecycle,
  type DepotLayerState,
  type GeographicBounds,
} from "./realisticSituationModel";

type CesiumRuntime = typeof CesiumRuntimeModule;

export interface RealisticSceneLayers extends DepotLayerState {
  ADMINISTRATIVE: boolean;
  INVENTORY: boolean;
  LOGISTICS: boolean;
  RAILWAY: boolean;
  RAILWAY_ROUTE: boolean;
  WEATHER: boolean;
}

export interface RealisticSceneCommand {
  id: number;
  tiltDegrees?: number;
  type: "ZOOM_IN" | "ZOOM_OUT" | "RESET" | "SET_TILT";
}

export interface RealisticOperationalSituationMapProps {
  backdrop?: MapFeature;
  bounds: GeographicBounds;
  command?: RealisticSceneCommand;
  facilities: OperationalFacilityCatalogue;
  features: readonly MapFeature[];
  layers: RealisticSceneLayers;
  onFacilitySelect: (id: string) => void;
  onReady?: () => void;
  onRegionDrill: (region: OverviewRegion) => void;
  onRegionSelect: (region: OverviewRegion) => void;
  selectedFacilityId?: string;
  selectedRegionCode?: string;
  situation: OperationalSituationCatalogue;
}

interface ActiveScene {
  billboards: Cesium.BillboardCollection;
  container: HTMLDivElement;
  destroy: () => void;
  lifecycle: SituationViewerLifecycle;
  points: Cesium.PointPrimitiveCollection;
  props: RealisticOperationalSituationMapProps;
  runtime: CesiumRuntime;
  viewer: Cesium.Viewer;
  weatherBillboards: Cesium.Billboard[];
  lastBoundsKey: string;
}

const SATELLITE_URL =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
const ELEVATION_URL =
  "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer";

export default function RealisticOperationalSituationMap(
  props: RealisticOperationalSituationMapProps,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  const sceneRef = useRef<ActiveScene | undefined>(undefined);

  useEffect(() => {
    propsRef.current = props;
    if (sceneRef.current) synchronizeScene(sceneRef.current, props);
  }, [props]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let createdScene: ActiveScene | undefined;
    try {
      const scene = createScene(container, propsRef.current);
      createdScene = scene;
      sceneRef.current = scene;
      synchronizeScene(scene, propsRef.current);
      propsRef.current.onReady?.();
    } catch {
      container.dataset.sceneState = "unavailable";
    }
    return () => {
      sceneRef.current = undefined;
      createdScene?.destroy();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !props.command) return;
    applyCommand(scene, props.command);
  }, [props.command]);

  return (
    <div
      aria-label="四区域写实三维公开态势地图"
      className="realistic-situation-scene"
      data-detail-level="PREFECTURE"
      data-dom-markers="0"
      ref={containerRef}
      role="img"
    />
  );
}

function createScene(
  container: HTMLDivElement,
  initialProps: RealisticOperationalSituationMapProps,
): ActiveScene {
  const runtime = CesiumRuntimeModule;
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
    publicAssetUrl("Cesium");
  container.dataset.sceneState = "creating";
  const localImagery = runtime.ImageryLayer.fromProviderAsync(
    runtime.TileMapServiceImageryProvider.fromUrl(
      publicAssetUrl("Cesium/Assets/Textures/NaturalEarthII"),
      { maximumLevel: 2 },
    ),
  );
  const creditContainer = document.createElement("div");
  creditContainer.className = "realistic-situation-credits";
  container.append(creditContainer);
  const viewer = new runtime.Viewer(container, {
    animation: false,
    baseLayer: localImagery,
    baseLayerPicker: false,
    creditContainer,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    requestRenderMode: true,
    sceneModePicker: false,
    selectionIndicator: false,
    shouldAnimate: false,
    timeline: false,
  });
  viewer.scene.renderError.addEventListener((_scene, error: unknown) => {
    const message = renderErrorMessage(error);
    container.dataset.renderError = message;
    container.setAttribute("aria-description", message);
    container.dataset.sceneState = "render-error";
  });
  const lifecycle = new SituationViewerLifecycle();
  lifecycle.viewerCreated();
  const billboards = viewer.scene.primitives.add(
    new runtime.BillboardCollection({ scene: viewer.scene }),
  ) as Cesium.BillboardCollection;
  const points = viewer.scene.primitives.add(
    new runtime.PointPrimitiveCollection(),
  ) as Cesium.PointPrimitiveCollection;
  viewer.scene.backgroundColor = runtime.Color.fromCssColorString("#d5dde0");
  viewer.scene.globe.baseColor = runtime.Color.fromCssColorString("#7f948c");
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.fog.enabled = true;
  viewer.scene.highDynamicRange = true;
  viewer.scene.postProcessStages.fxaa.enabled = true;
  viewer.scene.screenSpaceCameraController.enableLook = false;
  viewer.scene.screenSpaceCameraController.enableTilt = false;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1_200;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 3_200_000;
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);
  container.dataset.sceneState = "local-ready";

  const scene: ActiveScene = {
    billboards,
    container,
    destroy: () => {},
    lastBoundsKey: "",
    lifecycle,
    points,
    props: initialProps,
    runtime,
    viewer,
    weatherBillboards: [],
  };

  const clickHandler = new runtime.ScreenSpaceEventHandler(viewer.scene.canvas);
  clickHandler.setInputAction(
    (movement: { position: Cesium.Cartesian2 }) =>
      handlePick(scene, movement.position, false),
    runtime.ScreenSpaceEventType.LEFT_CLICK,
  );
  clickHandler.setInputAction(
    (movement: { position: Cesium.Cartesian2 }) =>
      handlePick(scene, movement.position, true),
    runtime.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );
  let constraining = false;
  const constrainCamera = () => {
    if (constraining) return;
    const canvas = viewer.scene.canvas;
    const surface = viewer.camera.pickEllipsoid(
      new runtime.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
      viewer.scene.globe.ellipsoid,
    );
    if (!surface) return;
    const cartographic = runtime.Cartographic.fromCartesian(surface);
    const longitude = runtime.Math.toDegrees(cartographic.longitude);
    const latitude = runtime.Math.toDegrees(cartographic.latitude);
    const bounds = scene.props.bounds;
    const clampedLongitude = clamp(longitude, bounds.minLongitude, bounds.maxLongitude);
    const clampedLatitude = clamp(latitude, bounds.minLatitude, bounds.maxLatitude);
    scene.container.dataset.detailLevel = altitudeDetailLevel(
      viewer.camera.positionCartographic.height,
    );
    if (clampedLongitude === longitude && clampedLatitude === latitude) return;
    constraining = true;
    viewer.camera.flyTo({
      destination: runtime.Cartesian3.fromDegrees(
        clampedLongitude,
        clampedLatitude,
        viewer.camera.positionCartographic.height,
      ),
      duration: 0.25,
      orientation: {
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: 0,
      },
      complete: () => {
        constraining = false;
      },
      cancel: () => {
        constraining = false;
      },
    });
  };
  viewer.camera.moveEnd.addEventListener(constrainCamera);
  const weatherTimer = window.setInterval(() => {
    if (!scene.weatherBillboards.length) return;
    const pulse = 0.96 + Math.sin(Date.now() / 420) * 0.08;
    scene.weatherBillboards.forEach((billboard) => {
      billboard.scale = pulse;
    });
    viewer.scene.requestRender();
  }, 180);

  let destroyed = false;
  void enhanceRealism(scene, () => destroyed);
  scene.destroy = () => {
    destroyed = true;
    window.clearInterval(weatherTimer);
    viewer.camera.moveEnd.removeEventListener(constrainCamera);
    clickHandler.destroy();
    lifecycle.viewerDestroyed();
    if (!viewer.isDestroyed()) viewer.destroy();
  };
  return scene;
}

async function enhanceRealism(scene: ActiveScene, isDestroyed: () => boolean) {
  const { runtime, viewer, container } = scene;
  const results = await Promise.allSettled([
    runtime.ArcGisMapServerImageryProvider.fromUrl(SATELLITE_URL),
    runtime.ArcGISTiledElevationTerrainProvider.fromUrl(ELEVATION_URL),
  ]);
  if (isDestroyed() || viewer.isDestroyed()) return;
  const [imagery, terrain] = results;
  if (imagery.status === "fulfilled") {
    const layer = viewer.imageryLayers.addImageryProvider(imagery.value);
    layer.brightness = 0.94;
    layer.contrast = 1.06;
    layer.saturation = 0.92;
    container.dataset.imageryState = "satellite";
  } else {
    container.dataset.imageryState = "local-fallback";
  }
  if (terrain.status === "fulfilled") {
    viewer.terrainProvider = terrain.value;
    container.dataset.terrainState = "elevation";
  } else {
    container.dataset.terrainState = "ellipsoid-fallback";
  }
  viewer.scene.requestRender();
}

function synchronizeScene(
  scene: ActiveScene,
  props: RealisticOperationalSituationMapProps,
) {
  const { runtime, viewer, billboards, points } = scene;
  scene.props = props;
  viewer.entities.removeAll();
  billboards.removeAll();
  points.removeAll();
  scene.weatherBillboards = [];

  if (props.layers.ADMINISTRATIVE) addRegions(scene, props);
  addRoutes(scene, props);
  addMarkers(scene, props);

  const boundsKey = [
    props.bounds.minLongitude,
    props.bounds.minLatitude,
    props.bounds.maxLongitude,
    props.bounds.maxLatitude,
  ].join(":");
  if (boundsKey !== scene.lastBoundsKey) {
    scene.lastBoundsKey = boundsKey;
    flyToBounds(scene, props.bounds, currentLevel(props));
  }
  scene.lifecycle.dataSynchronized({
    billboardCount: billboards.length,
    domMarkerCount: 0,
  });
  const snapshot = scene.lifecycle.snapshot();
  scene.container.dataset.viewerCount = String(snapshot.activeViewerCount);
  scene.container.dataset.createdViewerCount = String(snapshot.createdViewerCount);
  scene.container.dataset.billboardCount = String(snapshot.billboardCount);
  scene.container.dataset.domMarkers = "0";
  viewer.scene.requestRender();
  void runtime;
}

function addRegions(scene: ActiveScene, props: RealisticOperationalSituationMapProps) {
  const { runtime, viewer } = scene;
  const features = [...(props.backdrop ? [props.backdrop] : []), ...props.features];
  const seen = new Set<string>();
  for (const feature of features) {
    if (seen.has(feature.region.code)) continue;
    seen.add(feature.region.code);
    const selected = feature.region.code === props.selectedRegionCode;
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as Position[][]]
        : (feature.geometry.coordinates as Position[][][]);
    polygons.forEach((rings, index) => {
      const [outer, ...holes] = rings;
      const outerPositions = positionsFromRing(runtime, outer ?? []);
      if (outerPositions.length < 3) return;
      viewer.entities.add({
        id: `region:${feature.region.code}:area:${index}`,
        polygon: {
          hierarchy: new runtime.PolygonHierarchy(
            outerPositions,
            holes.map(
              (hole) => new runtime.PolygonHierarchy(positionsFromRing(runtime, hole)),
            ),
          ),
          material: runtime.Color.fromCssColorString(
            selected ? "#d9a441" : "#f4f0df",
          ).withAlpha(selected ? 0.22 : 0.06),
        },
      });
      viewer.entities.add({
        id: `region:${feature.region.code}:outline:${index}`,
        polyline: {
          clampToGround: true,
          material: runtime.Color.fromCssColorString(
            selected ? "#f2b642" : "#f8f6ec",
          ).withAlpha(selected ? 1 : 0.88),
          positions: outerPositions,
          width: selected ? 3 : 1.5,
        },
      });
    });
    const [longitude, latitude] = featureCenter(feature);
    viewer.entities.add({
      id: `region:${feature.region.code}:label`,
      position: runtime.Cartesian3.fromDegrees(longitude, latitude, 160),
      label: {
        backgroundColor: runtime.Color.fromCssColorString("#17201d").withAlpha(0.58),
        backgroundPadding: new runtime.Cartesian2(8, 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: labelDistance(runtime, feature.region.level),
        fillColor: runtime.Color.WHITE,
        font: '600 15px "PingFang SC", "Microsoft YaHei", sans-serif',
        outlineColor: runtime.Color.fromCssColorString("#18241f"),
        outlineWidth: 3,
        pixelOffset: new runtime.Cartesian2(0, -9),
        showBackground: true,
        style: runtime.LabelStyle.FILL_AND_OUTLINE,
        text: feature.region.name,
      },
    });
  }
}

function addRoutes(scene: ActiveScene, props: RealisticOperationalSituationMapProps) {
  const { runtime, viewer } = scene;
  if (props.layers.RAILWAY_ROUTE) {
    for (const route of props.facilities.railwayRoutes) {
      for (const [index, coordinates] of routeCoordinates(
        route.geometryGeoJson,
      ).entries()) {
        viewer.entities.add({
          id: `rail-route:${route.id}:${index}`,
          polyline: {
            clampToGround: true,
            material: new runtime.PolylineDashMaterialProperty({
              color: runtime.Color.fromCssColorString("#f5f3ea").withAlpha(0.82),
              dashLength: 18,
            }),
            positions: runtime.Cartesian3.fromDegreesArray(
              coordinates.flatMap(([longitude, latitude]) => [longitude, latitude]),
            ),
            width: 2.2,
          },
        });
      }
    }
  }
  if (props.layers.LOGISTICS) {
    for (const flow of props.situation.logisticsFlows ?? []) {
      viewer.entities.add({
        id: `logistics:${flow.eventId}`,
        polyline: {
          arcType: runtime.ArcType.GEODESIC,
          material: new runtime.PolylineDashMaterialProperty({
            color: runtime.Color.fromCssColorString("#e69f2e").withAlpha(0.96),
            dashLength: 24,
          }),
          positions: runtime.Cartesian3.fromDegreesArray([
            flow.originLongitude,
            flow.originLatitude,
            flow.destinationLongitude,
            flow.destinationLatitude,
          ]),
          width: 3.2,
        },
      });
    }
  }
}

function addMarkers(scene: ActiveScene, props: RealisticOperationalSituationMapProps) {
  const { runtime, billboards, points } = scene;
  for (const facility of props.facilities.storageFacilities) {
    if (
      facility.longitude === null ||
      facility.latitude === null ||
      !props.layers[facility.relationType]
    )
      continue;
    billboards.add({
      id: {
        featureId: situationFeatureId(facility.relationType, facility.code),
        facilityId: facility.code,
        kind: facility.relationType,
      },
      image: realisticSituationIcon(facility.relationType),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: runtime.HeightReference.CLAMP_TO_GROUND,
      position: runtime.Cartesian3.fromDegrees(facility.longitude, facility.latitude),
      scale: facility.code === props.selectedFacilityId ? 0.92 : 0.68,
      scaleByDistance: new runtime.NearFarScalar(15_000, 1.05, 1_500_000, 0.45),
      verticalOrigin: runtime.VerticalOrigin.BOTTOM,
    });
  }
  if (props.layers.RAILWAY) {
    for (const facility of props.facilities.railwayFacilities) {
      billboards.add({
        id: {
          featureId: situationFeatureId("RAILWAY", facility.sourceId),
          facilityId: facility.sourceId,
          kind: "RAILWAY",
        },
        image: realisticSituationIcon("RAILWAY"),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: runtime.HeightReference.CLAMP_TO_GROUND,
        position: runtime.Cartesian3.fromDegrees(facility.longitude, facility.latitude),
        distanceDisplayCondition: new runtime.DistanceDisplayCondition(0, 900_000),
        scale: facility.sourceId === props.selectedFacilityId ? 0.9 : 0.62,
        scaleByDistance: new runtime.NearFarScalar(12_000, 1, 1_800_000, 0.36),
        verticalOrigin: runtime.VerticalOrigin.BOTTOM,
      });
    }
  }
  if (props.layers.WEATHER) {
    for (const weather of props.situation.weather) {
      const marker = billboards.add({
        id: {
          featureId: situationFeatureId(
            "WEATHER",
            weather.regionCode ?? weather.rootRegionCode,
          ),
          kind: "WEATHER",
          regionCode: weather.regionCode ?? weather.rootRegionCode,
        },
        image: realisticWeatherIcon(weather.weatherCode),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: runtime.HeightReference.CLAMP_TO_GROUND,
        position: runtime.Cartesian3.fromDegrees(weather.longitude, weather.latitude),
        scale: 0.96,
        scaleByDistance: new runtime.NearFarScalar(20_000, 1.05, 2_000_000, 0.48),
        verticalOrigin: runtime.VerticalOrigin.BOTTOM,
      });
      scene.weatherBillboards.push(marker);
    }
  }
  if (props.layers.INVENTORY) {
    for (const inventory of props.situation.inventories ?? []) {
      points.add({
        color: runtime.Color.fromCssColorString("#4c9a73"),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: {
          featureId: situationFeatureId(
            "INVENTORY",
            `${inventory.regionCode}:${inventory.productCode}`,
          ),
          kind: "INVENTORY",
          regionCode: inventory.regionCode,
        },
        outlineColor: runtime.Color.WHITE,
        outlineWidth: 2,
        pixelSize: 10,
        position: runtime.Cartesian3.fromDegrees(
          inventory.longitude,
          inventory.latitude,
        ),
        scaleByDistance: new runtime.NearFarScalar(20_000, 1.2, 1_500_000, 0.45),
      });
    }
  }
}

function handlePick(scene: ActiveScene, position: Cesium.Cartesian2, drill: boolean) {
  const picked = scene.viewer.scene.pick(position) as { id?: unknown } | undefined;
  const id = picked?.id;
  if (id instanceof scene.runtime.Entity) {
    const match = /^region:([^:]+):/.exec(String(id.id));
    if (!match) return;
    const region = regionFeatures(scene.props).find(
      (feature) => feature.region.code === match[1],
    )?.region;
    if (!region) return;
    if (drill && region.level !== "VILLAGE") scene.props.onRegionDrill(region);
    else scene.props.onRegionSelect(region);
    return;
  }
  if (!id || typeof id !== "object") return;
  const feature = id as { facilityId?: unknown; regionCode?: unknown };
  if (typeof feature.facilityId === "string")
    scene.props.onFacilitySelect(feature.facilityId);
  if (typeof feature.regionCode === "string") {
    const region = regionFeatures(scene.props).find(
      (item) => item.region.code === feature.regionCode,
    )?.region;
    if (region) scene.props.onRegionSelect(region);
  }
}

function applyCommand(scene: ActiveScene, command: RealisticSceneCommand) {
  const { runtime, viewer } = scene;
  const distance = Math.max(viewer.camera.positionCartographic.height * 0.34, 4_000);
  if (command.type === "ZOOM_IN") viewer.camera.zoomIn(distance);
  if (command.type === "ZOOM_OUT") viewer.camera.zoomOut(distance);
  if (command.type === "RESET")
    flyToBounds(scene, scene.props.bounds, currentLevel(scene.props));
  if (command.type === "SET_TILT" && command.tiltDegrees !== undefined) {
    const surface = viewer.camera.pickEllipsoid(
      new runtime.Cartesian2(
        viewer.scene.canvas.clientWidth / 2,
        viewer.scene.canvas.clientHeight / 2,
      ),
      viewer.scene.globe.ellipsoid,
    );
    if (surface)
      viewer.camera.lookAt(
        surface,
        new runtime.HeadingPitchRange(
          0,
          runtime.Math.toRadians(-command.tiltDegrees),
          viewer.camera.positionCartographic.height,
        ),
      );
  }
  viewer.scene.requestRender();
}

function flyToBounds(
  scene: ActiveScene,
  bounds: GeographicBounds,
  level: OverviewRegion["level"] | undefined,
) {
  const target = realisticCamera(bounds, level);
  const points = [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.minLongitude, bounds.maxLatitude],
    [bounds.maxLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
    [target.longitude, target.latitude],
  ].map(([longitude, latitude]) =>
    scene.runtime.Cartesian3.fromDegrees(longitude ?? 0, latitude ?? 0, 0),
  );
  const sphere = scene.runtime.BoundingSphere.fromPoints(points);
  scene.viewer.camera.flyToBoundingSphere(sphere, {
    duration: scene.lastBoundsKey ? 0.65 : 0,
    offset: new scene.runtime.HeadingPitchRange(
      scene.runtime.Math.toRadians(target.headingDegrees),
      scene.runtime.Math.toRadians(target.pitchDegrees),
      Math.max(target.height, sphere.radius * 1.35),
    ),
  });
}

function currentLevel(props: RealisticOperationalSituationMapProps) {
  return props.features[0]?.region.level ?? props.backdrop?.region.level;
}

function regionFeatures(props: RealisticOperationalSituationMapProps) {
  return [...(props.backdrop ? [props.backdrop] : []), ...props.features];
}

function positionsFromRing(runtime: CesiumRuntime, ring: readonly Position[]) {
  return runtime.Cartesian3.fromDegreesArray(
    ring.flatMap(([longitude, latitude]) => [longitude, latitude]),
  );
}

function featureCenter(feature: MapFeature): Position {
  const points = flattenCoordinates(feature.geometry);
  if (!points.length) return [0, 0];
  const [longitude, latitude] = points.reduce(
    ([sumLongitude, sumLatitude], [pointLongitude, pointLatitude]) => [
      sumLongitude + pointLongitude,
      sumLatitude + pointLatitude,
    ],
    [0, 0],
  );
  return [longitude / points.length, latitude / points.length];
}

function labelDistance(runtime: CesiumRuntime, level: OverviewRegion["level"]) {
  const far =
    level === "PREFECTURE"
      ? 3_200_000
      : level === "COUNTY"
        ? 1_000_000
        : level === "TOWNSHIP"
          ? 320_000
          : 90_000;
  return new runtime.DistanceDisplayCondition(0, far);
}

function routeCoordinates(geometryGeoJson: string): Position[][] {
  try {
    const geometry = JSON.parse(geometryGeoJson) as {
      coordinates?: unknown;
      type?: unknown;
    };
    if (geometry.type === "LineString" && validLine(geometry.coordinates))
      return [geometry.coordinates];
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates))
      return geometry.coordinates.filter(validLine);
  } catch {
    return [];
  }
  return [];
}

function validLine(value: unknown): value is Position[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (coordinate) =>
        Array.isArray(coordinate) &&
        typeof coordinate[0] === "number" &&
        typeof coordinate[1] === "number",
    )
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function renderErrorMessage(error: unknown) {
  if (error instanceof Error)
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  if (error !== null && typeof error === "object") {
    const entries = Object.getOwnPropertyNames(error).map((key) => [
      key,
      String((error as Record<string, unknown>)[key]),
    ]);
    return JSON.stringify(Object.fromEntries(entries));
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
