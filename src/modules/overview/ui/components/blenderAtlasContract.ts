const GOVERNED_REGIONS = [
  ["230200", "齐齐哈尔市"],
  ["231100", "黑河市"],
  ["150700", "呼伦贝尔市"],
  ["232700", "大兴安岭地区"],
] as const;

export interface BlenderAtlasManifest {
  asset: string;
  bounds: readonly [number, number, number, number];
  generatedAt: string;
  origin: readonly [number, number];
  projection: "EPSG:3857_LOCAL_METRES";
  regions: readonly {
    code: (typeof GOVERNED_REGIONS)[number][0];
    name: string;
    objectName: string;
  }[];
  sourceName: string;
  sourceRevision: string;
  version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericTuple(value: unknown, length: number, label: string): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== length ||
    value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    throw new Error(`${label} must contain ${length} finite numbers`);
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${key} must be a non-empty string`);
  return value;
}

export function parseBlenderAtlasManifest(value: unknown): BlenderAtlasManifest {
  if (!isRecord(value)) throw new Error("Blender atlas manifest must be an object");
  if (value["version"] !== 1) throw new Error("Blender atlas version must be 1");
  if (value["projection"] !== "EPSG:3857_LOCAL_METRES")
    throw new Error("Blender atlas projection must be EPSG:3857_LOCAL_METRES");

  const asset = requiredString(value, "asset");
  if (
    !asset.startsWith("/overview-monitoring/overview/blender/") ||
    !asset.endsWith(".glb") ||
    asset.includes("..") ||
    asset.includes("://")
  ) {
    throw new Error("Blender atlas asset must be a same-origin overview asset");
  }

  const regionValues = value["regions"];
  if (!Array.isArray(regionValues))
    throw new Error("Blender atlas must contain four governed regions");
  const regions = regionValues.map((region) => {
    if (!isRecord(region))
      throw new Error("Blender atlas must contain four governed regions");
    return {
      code: requiredString(region, "code"),
      name: requiredString(region, "name"),
      objectName: requiredString(region, "objectName"),
    };
  });
  const byCode = new Map(regions.map((region) => [region.code, region]));
  if (
    regions.length !== GOVERNED_REGIONS.length ||
    byCode.size !== GOVERNED_REGIONS.length ||
    GOVERNED_REGIONS.some(
      ([code, name]) =>
        byCode.get(code)?.name !== name ||
        byCode.get(code)?.objectName !== `region_${code}`,
    )
  ) {
    throw new Error("Blender atlas must contain four governed regions");
  }

  const bounds = numericTuple(value["bounds"], 4, "bounds");
  if (bounds[0]! >= bounds[2]! || bounds[1]! >= bounds[3]!)
    throw new Error("Blender atlas bounds must have positive area");
  const origin = numericTuple(value["origin"], 2, "origin");

  return {
    asset,
    bounds: [bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!],
    generatedAt: requiredString(value, "generatedAt"),
    origin: [origin[0]!, origin[1]!],
    projection: "EPSG:3857_LOCAL_METRES",
    regions: GOVERNED_REGIONS.map(([code]) =>
      byCode.get(code)!,
    ) as BlenderAtlasManifest["regions"],
    sourceName: requiredString(value, "sourceName"),
    sourceRevision: requiredString(value, "sourceRevision"),
    version: 1,
  };
}

export function blenderRegionVisualState(
  code: string,
  selectedCode: string | undefined,
  hoveredCode: string | undefined,
  visible: boolean,
) {
  const selected = code === selectedCode;
  const hovered = !selected && code === hoveredCode;
  return {
    emissiveIntensity: selected ? 0.65 : hovered ? 0.32 : 0.08,
    opacity: visible ? (selectedCode && !selected ? 0.72 : 1) : 0,
    raisedMeters: selected ? 900 : hovered ? 320 : 0,
    visible,
  } as const;
}
