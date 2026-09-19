import type { OverviewRegion } from "../../domain/overview";

export type PublicRegionLevel = OverviewRegion["level"] | "ALL";
export function searchPublicRegions(
  regions: readonly OverviewRegion[],
  roots: readonly OverviewRegion[],
  query: string,
  level: PublicRegionLevel,
  limit = 50,
) {
  const byCode = new Map(regions.map((region) => [region.code, region]));
  roots.forEach((root) => byCode.set(root.code, root));
  const rootCodes = new Set(roots.map((root) => root.code));
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const matches: { region: OverviewRegion; path: string }[] = [];
  let total = 0;
  for (const region of byCode.values()) {
    if (level !== "ALL" && region.level !== level) continue;
    const names = [region.name];
    const seen = new Set([region.code]);
    let cursor: OverviewRegion | undefined = region;
    while (cursor && !rootCodes.has(cursor.code)) {
      cursor = cursor.parentCode ? byCode.get(cursor.parentCode) : undefined;
      if (!cursor || seen.has(cursor.code)) {
        cursor = undefined;
        break;
      }
      seen.add(cursor.code);
      names.unshift(cursor.name);
    }
    if (!cursor) continue;
    const path = names.join(" / ");
    if (!tokens.every((token) => path.toLocaleLowerCase("zh-CN").includes(token)))
      continue;
    total++;
    matches.push({ region, path });
  }
  const rank = (region: OverviewRegion) => {
    const name = region.name.toLocaleLowerCase("zh-CN");
    if (!normalized || name === normalized) return 0;
    if (name.startsWith(normalized)) return 1;
    if (tokens.every((token) => name.includes(token))) return 2;
    return 3;
  };
  matches.sort((a, b) => rank(a.region) - rank(b.region));
  return { matches: matches.slice(0, Math.max(0, limit)), total };
}
