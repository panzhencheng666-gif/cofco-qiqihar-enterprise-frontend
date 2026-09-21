import { expect, it, vi } from "vitest";
import type {
  OperationalSituationCatalogue,
  WeatherObservation,
} from "../../domain/operationalSituation";
import { enrichPublicWeather } from "./publicWeatherRefresh";

const weather = (code: string): WeatherObservation => ({
  rootRegionCode: code,
  regionName: code,
  longitude: 125,
  latitude: 48,
  observedAt: "2026-09-19T12:00:00Z",
  meanTemperatureC: 12,
  precipitationMm: 0,
  soilMoisturePercent: null,
  risk: "",
  assessment: "",
  sourceName: "天气来源",
  sourceUrl: "https://example.com",
  fetchedAt: "2026-09-19T12:10:00Z",
});
const catalogue = (
  rows: readonly WeatherObservation[],
): OperationalSituationCatalogue => ({
  generatedAt: "2026-09-19T12:00:00Z",
  weather: rows,
  publicEvents: [],
  policyEvents: [],
  logisticsFlows: [],
  inventories: [],
  sources: [],
});

it("deduplicates missing region loads, accepts zero weather codes and preserves other catalogue data", async () => {
  const original = catalogue([
    weather("1"),
    weather("1"),
    { ...weather("2"), cloudCoverPercent: 0 },
  ]);
  const load = vi.fn(() =>
    Promise.resolve(catalogue([{ ...weather("1"), weatherCode: 0 }])),
  );
  const result = await enrichPublicWeather(original, load);
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.weather.map((row) => row.weatherCode)).toEqual([0, 0, undefined]);
  expect(result.publicEvents).toBe(original.publicEvents);
  expect(result.logisticsFlows).toBe(original.logisticsFlows);
  expect(result.sources).toBe(original.sources);
  expect(result.generatedAt).toBe(original.generatedAt);
});

it("matches regionCode ahead of root and rejects older, unrelated and empty observations", async () => {
  const original = catalogue([
    { ...weather("1"), regionCode: "11" },
    weather("2"),
    weather("3"),
  ]);
  const load = vi.fn((code: string) =>
    Promise.resolve(
      catalogue(
        code === "11"
          ? [
              { ...weather("1"), regionCode: "12", weatherCode: 5 },
              { ...weather("1"), regionCode: "11", weatherCode: 7 },
            ]
          : code === "2"
            ? [{ ...weather("2"), observedAt: "2026-09-18T12:00:00Z", weatherCode: 1 }]
            : [weather("3")],
      ),
    ),
  );
  const result = await enrichPublicWeather(original, load);
  expect(load).toHaveBeenCalledWith("11");
  expect(result.weather).toHaveLength(3);
  expect(result.weather[0]?.weatherCode).toBe(7);
  expect(result.weather[1]).toBe(original.weather[1]);
  expect(result.weather[2]).toBe(original.weather[2]);
});

it("accepts a condition observation from the preceding hourly weather slot", async () => {
  const original = catalogue([{ ...weather("1"), observedAt: "2026-09-19T12:15:00Z" }]);
  const load = vi.fn(() =>
    Promise.resolve(
      catalogue([
        {
          ...weather("1"),
          observedAt: "2026-09-19T12:00:00Z",
          weatherCode: 2,
          cloudCoverPercent: 55,
        },
      ]),
    ),
  );

  const result = await enrichPublicWeather(original, load);

  expect(result.weather[0]?.weatherCode).toBe(2);
  expect(result.weather[0]?.cloudCoverPercent).toBe(55);
  expect(result.weather[0]?.observedAt).toBe("2026-09-19T12:00:00Z");
});

it("keeps partial failures and uses at most two concurrent requests", async () => {
  let running = 0;
  let peak = 0;
  const load = async (code: string) => {
    running++;
    peak = Math.max(peak, running);
    await Promise.resolve();
    running--;
    if (code === "2") throw new Error("offline");
    return catalogue([{ ...weather(code), cloudCoverPercent: 60 }]);
  };
  const original = catalogue([weather("1"), weather("2"), weather("3"), weather("4")]);
  const result = await enrichPublicWeather(original, load);
  expect(peak).toBe(2);
  expect(result.weather[1]).toBe(original.weather[1]);
  expect(result.weather[3]?.cloudCoverPercent).toBe(60);
});

it("returns on abort without waiting for pending loads or starting more", async () => {
  const controller = new AbortController();
  const load = vi.fn(() => new Promise<OperationalSituationCatalogue>(() => undefined));
  const original = catalogue([weather("1"), weather("2"), weather("3")]);
  const pending = enrichPublicWeather(original, load, controller.signal);
  expect(load).toHaveBeenCalledTimes(2);
  controller.abort();
  expect(await pending).toBe(original);
  expect(load).toHaveBeenCalledTimes(2);
});
