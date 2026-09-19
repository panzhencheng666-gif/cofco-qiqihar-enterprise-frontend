import { expect, it } from "vitest";
import { weatherSpriteKind } from "./weatherSpriteKind";
import type { WeatherObservation } from "../../domain/operationalSituation";
const weather = {
  observedAt: "2026-09-19T14:00:00Z",
  longitude: 123,
  latitude: 48,
  precipitationMm: 0,
  weatherCode: 0,
} as WeatherObservation;
it("uses a night symbol for clear nighttime observations", () => {
  expect(weatherSpriteKind(weather)).toBe("CLEAR_NIGHT");
  expect(weatherSpriteKind({ ...weather, observedAt: "2026-09-19T04:00:00Z" })).toBe(
    "CLEAR",
  );
});
it("does not infer sunshine from missing cloud and code fields", () => {
  expect(weatherSpriteKind({ ...weather, weatherCode: null })).toBe("UNKNOWN");
});
