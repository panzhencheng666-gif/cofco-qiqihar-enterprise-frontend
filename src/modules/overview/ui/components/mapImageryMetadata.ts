export interface MapImageryMetadata {
  provider: string;
  attribution: string;
  updateCadence: string;
  imageryPeriod: string;
  acquisitionFrom: string | null;
  acquisitionTo: string | null;
  commercialConfigured: boolean;
  automaticWeeklyPeriod: boolean;
  syncedAt: string | null;
  spatialResolutionMeters: number | null;
  cloudCoveragePercent: number | null;
  status: string;
  sourceProductIds: string[];
  truthStatement: string;
}

const UNVERSIONED_TILE_URL = "/api/v1/overview/map-imagery/tiles/{z}/{x}/{y}";
const RELEASE_VERSION = /^\d{4}-(?:W\d{2}|\d{2})$/;

export function satelliteTileUrl(version?: string): string {
  return version && RELEASE_VERSION.test(version)
    ? `${UNVERSIONED_TILE_URL}?version=${encodeURIComponent(version)}`
    : UNVERSIONED_TILE_URL;
}

export function imageryLabel(metadata: MapImageryMetadata): string {
  const resolution = metadata.spatialResolutionMeters
    ? ` · ${metadata.spatialResolutionMeters}米`
    : "";
  const acquisition =
    metadata.acquisitionFrom && metadata.acquisitionTo
      ? ` · 采集 ${formatDate(metadata.acquisitionFrom)}至${formatDate(metadata.acquisitionTo)}`
      : " · 历史影像";
  const cadence = metadata.updateCadence === "WEEKLY"
    ? " · 每周一同步"
    : metadata.updateCadence === "MONTHLY" ? " · 每月更新" : "";
  const zoomNotice = metadata.updateCadence === "MONTHLY"
    ? " · 14级以上放大后为历史底图，清晰度随地区变化"
    : "";
  return `${metadata.provider}${resolution}${acquisition}${cadence}${zoomNotice}`;
}

export function imageryWarning(metadata: MapImageryMetadata): string | undefined {
  if (metadata.status === "STALE") return metadata.updateCadence === "MONTHLY"
    ? "本月同步未成功，当前沿用上一成功版本。"
    : "本周同步未成功，当前沿用上一成功版本。";
  if (metadata.status === "FALLBACK") return "当前显示历史影像，不代表近期地表现状。";
  return undefined;
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}年${match[2]}月${match[3]}日` : value;
}
