import * as THREE from "three";

export interface SatelliteSurfaceBounds {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}

export interface ProjectedSurfaceBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface SatelliteTilePlan {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  tileCount: number;
  zoom: number;
}

export interface LoadedSatelliteSurface {
  source: "ESRI_WORLD_IMAGERY";
  texture: THREE.CanvasTexture;
  tileCount: number;
  zoom: number;
}

const MAX_MERCATOR_LATITUDE = 85.05112878;
const canvasCache = new Map<string, Promise<HTMLCanvasElement>>();

export function tileCoordinate(longitude: number, latitude: number, zoom: number) {
  const scale = 2 ** zoom;
  const boundedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const radians = (boundedLatitude * Math.PI) / 180;
  const x = ((longitude + 180) / 360) * scale;
  const y =
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale;
  return {
    x: Math.max(0, Math.min(scale, x)),
    y: Math.max(0, Math.min(scale, y)),
  };
}

export function satelliteTilePlan(
  bounds: SatelliteSurfaceBounds,
  requestedZoom: number,
  maxTiles = 24,
): SatelliteTilePlan {
  let zoom = Math.max(1, Math.floor(requestedZoom));
  while (zoom > 1) {
    const plan = tilePlanAtZoom(bounds, zoom);
    if (plan.tileCount <= maxTiles) return plan;
    zoom -= 1;
  }
  return tilePlanAtZoom(bounds, zoom);
}

export async function loadSatelliteSurfaceTexture({
  bounds,
  maxTiles = 24,
  projectedBounds,
  requestedZoom,
  stageHeight,
  stageWidth,
}: {
  bounds: SatelliteSurfaceBounds;
  maxTiles?: number;
  projectedBounds: ProjectedSurfaceBounds;
  requestedZoom: number;
  stageHeight: number;
  stageWidth: number;
}): Promise<LoadedSatelliteSurface> {
  const plan = satelliteTilePlan(bounds, requestedZoom, maxTiles);
  const key = [
    bounds.minLongitude,
    bounds.minLatitude,
    bounds.maxLongitude,
    bounds.maxLatitude,
    projectedBounds.minX,
    projectedBounds.minY,
    projectedBounds.maxX,
    projectedBounds.maxY,
    stageWidth,
    stageHeight,
    plan.zoom,
  ].join(":");
  let canvasPromise = canvasCache.get(key);
  if (!canvasPromise) {
    canvasPromise = composeSatelliteCanvas(
      bounds,
      projectedBounds,
      stageWidth,
      stageHeight,
      plan,
    ).catch((error: unknown) => {
      canvasCache.delete(key);
      throw error;
    });
    canvasCache.set(key, canvasPromise);
  }
  const canvas = await canvasPromise;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return {
    source: "ESRI_WORLD_IMAGERY",
    texture,
    tileCount: plan.tileCount,
    zoom: plan.zoom,
  };
}

function tilePlanAtZoom(
  bounds: SatelliteSurfaceBounds,
  zoom: number,
): SatelliteTilePlan {
  const northWest = tileCoordinate(bounds.minLongitude, bounds.maxLatitude, zoom);
  const southEast = tileCoordinate(bounds.maxLongitude, bounds.minLatitude, zoom);
  const maximum = 2 ** zoom - 1;
  const minX = clampTile(Math.floor(northWest.x), maximum);
  const maxX = clampTile(Math.floor(southEast.x), maximum);
  const minY = clampTile(Math.floor(northWest.y), maximum);
  const maxY = clampTile(Math.floor(southEast.y), maximum);
  return {
    maxX,
    maxY,
    minX,
    minY,
    tileCount: (maxX - minX + 1) * (maxY - minY + 1),
    zoom,
  };
}

function clampTile(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, value));
}

async function composeSatelliteCanvas(
  bounds: SatelliteSurfaceBounds,
  projectedBounds: ProjectedSurfaceBounds,
  stageWidth: number,
  stageHeight: number,
  plan: SatelliteTilePlan,
) {
  const canvas = document.createElement("canvas");
  canvas.width = stageWidth;
  canvas.height = stageHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("satellite texture canvas is unavailable");
  const northWest = tileCoordinate(bounds.minLongitude, bounds.maxLatitude, plan.zoom);
  const southEast = tileCoordinate(bounds.maxLongitude, bounds.minLatitude, plan.zoom);
  const tileSpanX = Math.max(southEast.x - northWest.x, 0.000001);
  const tileSpanY = Math.max(southEast.y - northWest.y, 0.000001);
  const targetWidth = projectedBounds.maxX - projectedBounds.minX;
  const targetHeight = projectedBounds.maxY - projectedBounds.minY;
  const tiles: Promise<void>[] = [];
  for (let y = plan.minY; y <= plan.maxY; y += 1) {
    for (let x = plan.minX; x <= plan.maxX; x += 1) {
      tiles.push(
        loadImage(
          `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${plan.zoom}/${y}/${x}`,
        ).then((image) => {
          const drawX =
            projectedBounds.minX + ((x - northWest.x) / tileSpanX) * targetWidth;
          const drawY =
            projectedBounds.minY + ((y - northWest.y) / tileSpanY) * targetHeight;
          const drawWidth = (targetWidth / tileSpanX) * 1.002;
          const drawHeight = (targetHeight / tileSpanY) * 1.002;
          context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        }),
      );
    }
  }
  await Promise.all(tiles);
  return canvas;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeoutId = window.setTimeout(
      () => reject(new Error(`satellite tile timed out: ${source}`)),
      5_000,
    );
    image.crossOrigin = "anonymous";
    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error(`satellite tile failed: ${source}`));
    };
    image.src = source;
  });
}
