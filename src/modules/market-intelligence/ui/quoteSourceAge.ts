/** Age since the supplier source timestamp, measured against the backend heartbeat clock. */
export function quoteSourceAgeSeconds(
  sourceAt: string,
  feedPublishedAt: string | null | undefined,
  feedAgeSeconds: number | null,
): number | null {
  if (feedAgeSeconds === null || !Number.isFinite(feedAgeSeconds) || feedAgeSeconds < 0)
    return null;
  const source = Date.parse(sourceAt);
  const published = Date.parse(feedPublishedAt ?? "");
  // A source time later than publication needs clock/provenance review.
  if (!Number.isFinite(source) || !Number.isFinite(published) || source > published)
    return null;
  return Math.floor((published - source) / 1000 + feedAgeSeconds);
}

export function formatQuoteSourceAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "待核验";
  const age = Math.floor(seconds);
  if (age >= 86_400)
    return `${Math.floor(age / 86_400)} 天 ${Math.floor((age % 86_400) / 3_600)} 小时`;
  if (age >= 3_600)
    return `${Math.floor(age / 3_600)} 小时 ${Math.floor((age % 3_600) / 60)} 分`;
  if (age >= 60) return `${Math.floor(age / 60)} 分 ${age % 60} 秒`;
  return `${age} 秒`;
}
