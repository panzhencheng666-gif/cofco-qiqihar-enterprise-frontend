import type {
  OperationalSituationCatalogue,
  WeatherObservation,
} from "../../domain/operationalSituation";

const hasCondition = (row: WeatherObservation) =>
  row.weatherCode != null || row.cloudCoverPercent != null;
const regionCode = (row: WeatherObservation) => row.regionCode ?? row.rootRegionCode;
const CONDITION_OBSERVATION_LAG_MS = 90 * 60_000;

const conditionFreshEnoughFor = (
  candidate: WeatherObservation,
  original: WeatherObservation,
) => {
  const candidateTime = Date.parse(candidate.observedAt);
  const originalTime = Date.parse(original.observedAt);
  return (
    Number.isFinite(candidateTime) &&
    Number.isFinite(originalTime) &&
    candidateTime >= originalTime - CONDITION_OBSERVATION_LAG_MS
  );
};

export async function enrichPublicWeather(
  catalogue: OperationalSituationCatalogue,
  load: (regionCode: string) => Promise<OperationalSituationCatalogue>,
  signal?: AbortSignal,
): Promise<OperationalSituationCatalogue> {
  if (signal?.aborted) return catalogue;
  const codes = [
    ...new Set(catalogue.weather.filter((row) => !hasCondition(row)).map(regionCode)),
  ];
  if (!codes.length) return catalogue;
  const observations = new Map<string, readonly WeatherObservation[]>();
  let cursor = 0;
  async function worker() {
    while (!signal?.aborted && cursor < codes.length) {
      const code = codes[cursor++];
      if (code === undefined) return;
      try {
        const result = await load(code);
        if (signal?.aborted) return;
        observations.set(
          code,
          result.weather.filter((row) => regionCode(row) === code && hasCondition(row)),
        );
      } catch {
        // A failed region must not discard observations from other regions.
      }
    }
  }
  let abortListener: (() => void) | undefined;
  const aborted = new Promise<void>((resolve) => {
    abortListener = () => resolve();
    signal?.addEventListener("abort", abortListener, { once: true });
  });
  try {
    await Promise.race([Promise.all([worker(), worker()]), aborted]);
  } finally {
    if (abortListener) signal?.removeEventListener("abort", abortListener);
  }
  if (signal?.aborted) return catalogue;
  return {
    ...catalogue,
    weather: catalogue.weather.map((original) => {
      if (hasCondition(original)) return original;
      const replacement = observations
        .get(regionCode(original))
        ?.filter((row) => conditionFreshEnoughFor(row, original))
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
      return replacement ? { ...original, ...replacement } : original;
    }),
  };
}
