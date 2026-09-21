import { describe, expect, it } from "vitest";

import type { WeatherObservation } from "../../domain/operationalSituation";
import {
  liveWeatherEvidence,
  liveWeatherHeadline,
  liveWeatherKind,
  weatherObservationFresh,
} from "./liveWeatherPresentation";

const observation = {
  rootRegionCode: "230200",
  regionName: "齐齐哈尔市",
  longitude: 123.92,
  latitude: 47.35,
  observedAt: "2026-09-19T02:00:00Z",
  meanTemperatureC: 18,
  precipitationMm: 2.4,
  soilMoisturePercent: 31,
  risk: "关注连续降雨",
  assessment: "当前存在降水。",
  sourceName: "Open-Meteo",
  sourceUrl: "https://open-meteo.com/",
  fetchedAt: "2026-09-19T02:01:00Z",
} satisfies WeatherObservation;

describe("live weather presentation", () => {
  it("does not present stale, invalid or future observations as current", () => {
    const now = Date.parse("2026-09-19T03:00:00Z");
    expect(weatherObservationFresh(observation.observedAt, now)).toBe(true);
    expect(weatherObservationFresh("2026-09-19T00:00:00Z", now)).toBe(false);
    expect(weatherObservationFresh("invalid", now)).toBe(false);
    expect(weatherObservationFresh("2026-09-20T00:00:00Z", now)).toBe(false);
  });
  it("derives rain visuals and evidence from the actual observation", () => {
    expect(liveWeatherKind(observation)).toBe("RAIN");
    expect(liveWeatherHeadline("泰来县", observation)).toBe("泰来县降雨影响提示");
    expect(liveWeatherEvidence(observation)).toContain("实时降雨");
  });

  it("prefers WMO weather codes when the backend supplies one", () => {
    expect(liveWeatherKind({ ...observation, weatherCode: 95 })).toBe("STORM");
    expect(liveWeatherKind({ ...observation, weatherCode: 75 })).toBe("SNOW");
    expect(liveWeatherKind({ ...observation, weatherCode: 80 })).toBe("RAIN");
    expect(liveWeatherKind({ ...observation, weatherCode: 82 })).toBe("RAIN");
  });
  it("does not turn a rain risk statement into observed rain when precipitation is zero", () => {
    expect(
      liveWeatherKind({
        ...observation,
        precipitationMm: 0,
        cloudCoverPercent: 20,
        risk: "未触发降雨风险",
      }),
    ).toBe("CLEAR");
  });
});
