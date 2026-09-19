export interface RadarMapsResponse {
  generated?: number;
  host?: string;
  radar?: {
    past?: readonly { path?: string; time?: number }[];
  };
}

export interface LiveRadarFrame {
  host: string;
  observedAt: number;
  path: string;
}

export function latestRadarFrame(
  response: RadarMapsResponse,
): LiveRadarFrame | undefined {
  const host = response.host;
  const newest = [...(response.radar?.past ?? [])]
    .filter(
      (frame): frame is { path: string; time: number } =>
        typeof frame.path === "string" && typeof frame.time === "number",
    )
    .sort((left, right) => right.time - left.time)[0];
  if (!host || !newest) return undefined;
  return { host, observedAt: newest.time, path: newest.path };
}

export function liveRadarImageUrl(
  frame: LiveRadarFrame,
  longitude: number,
  latitude: number,
) {
  return `${frame.host}${frame.path}/512/6/${latitude}/${longitude}/2/1_1.png`;
}

export function liveSatelliteExportUrl(longitude: number, latitude: number) {
  const longitudeRadius = 1.55;
  const latitudeRadius = 0.9;
  const bbox = [
    longitude - longitudeRadius,
    latitude - latitudeRadius,
    longitude + longitudeRadius,
    latitude + latitudeRadius,
  ].join(",");
  const parameters = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    format: "jpg",
    f: "image",
    imageSR: "4326",
    size: "960,540",
  });
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${parameters}`;
}
