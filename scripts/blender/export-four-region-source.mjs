import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNED_REGIONS = [
  ["230200", "齐齐哈尔市"],
  ["231100", "黑河市"],
  ["150700", "呼伦贝尔市"],
  ["232700", "大兴安岭地区"],
];

export function normalizeRootRegions(payload, provenance) {
  const records = Array.isArray(payload?.data) ? payload.data : [];
  const byCode = new Map(
    records
      .filter(
        (record) =>
          record &&
          record.mapContextOnly !== true &&
          GOVERNED_REGIONS.some(([code]) => code === record.code),
      )
      .map((record) => [record.code, record]),
  );
  if (byCode.size !== GOVERNED_REGIONS.length) {
    throw new Error(
      `expected four governed regions, received ${byCode.size}: ${[...byCode.keys()].join(",")}`,
    );
  }

  const features = GOVERNED_REGIONS.map(([code, expectedName]) => {
    const record = byCode.get(code);
    if (record.level !== "PREFECTURE") {
      throw new Error(`invalid administrative level for ${code}: ${record.level}`);
    }
    if (record.name !== expectedName) {
      throw new Error(`invalid administrative name for ${code}: ${record.name}`);
    }

    let geometry;
    try {
      geometry = JSON.parse(record.boundaryGeoJson);
    } catch {
      throw new Error(`invalid boundary JSON for ${code}`);
    }
    if (
      !geometry ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") ||
      !Array.isArray(geometry.coordinates)
    ) {
      throw new Error(`invalid boundary geometry for ${code}`);
    }

    return {
      type: "Feature",
      properties: {
        code,
        level: record.level,
        name: record.name,
      },
      geometry,
    };
  });

  return {
    type: "FeatureCollection",
    ...(provenance ? { provenance } : {}),
    features,
  };
}

export function numericLoopbackOrigin(value) {
  const origin = new URL(value);
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    origin.port === "" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new Error("API origin must be an explicit numeric loopback HTTP origin");
  }
  return origin.origin;
}

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

async function fetchJson(url, actor) {
  const response = await fetch(url, { headers: { "X-Actor": actor } });
  if (!response.ok) throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const output = argumentValue("--output");
  if (!output) throw new Error("--output is required");
  const apiOrigin = numericLoopbackOrigin(
    argumentValue(
      "--api-origin",
      process.env.COFCO_OVERVIEW_API_PROXY_TARGET ?? "http://127.0.0.1:8090",
    ),
  );
  const actor = argumentValue("--actor", "wang-yang");
  const productCode = argumentValue("--product-code", "CORN");
  const year = argumentValue("--year", "2026");
  const regionUrl = new URL("/api/v1/overview/regions", apiOrigin);
  regionUrl.searchParams.set("productCode", productCode);
  regionUrl.searchParams.set("year", year);
  const scopeUrl = new URL("/api/v1/overview/map-scope", apiOrigin);
  const [regions, scope] = await Promise.all([
    fetchJson(regionUrl, actor),
    fetchJson(scopeUrl, actor),
  ]);
  const provenance = {
    componentGeometryFingerprint: scope?.data?.componentGeometryFingerprint,
    refreshedAt: scope?.data?.refreshedAt,
    sourceLicense: scope?.data?.sourceLicense,
    sourceName: scope?.data?.sourceName,
    sourceRevision: scope?.data?.sourceRevision,
  };
  if (Object.values(provenance).some((value) => typeof value !== "string" || !value)) {
    throw new Error("map-scope provenance is incomplete");
  }
  const collection = normalizeRootRegions(regions, provenance);
  const absoluteOutput = path.resolve(output);
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, `${JSON.stringify(collection)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({ output: absoluteOutput, regions: collection.features.map(({ properties }) => properties) })}\n`,
  );
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
