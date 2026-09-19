import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WeatherObservation } from "../../domain/operationalSituation";
import { RealisticWeatherScene } from "./RealisticWeatherScene";

const weather: WeatherObservation = {
  rootRegionCode: "230200",
  regionCode: "230200",
  regionName: "齐齐哈尔市",
  longitude: 123.92,
  latitude: 47.35,
  observedAt: "2026-09-19T06:00:00Z",
  meanTemperatureC: 16.2,
  precipitationMm: 0.2,
  soilMoisturePercent: 35.8,
  windSpeedKph: 12,
  weatherCode: 61,
  risk: "需要关注",
  assessment: "短时降雨",
  sourceName: "Open-Meteo",
  sourceUrl: "https://open-meteo.com/",
  fetchedAt: "2026-09-19T06:01:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("RealisticWeatherScene", () => {
  it("uses a real regional satellite image and the newest live radar frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          generated: 20,
          host: "https://tilecache.example",
          radar: { past: [{ time: 20, path: "/v2/radar/20" }] },
        }),
      }),
    );

    const { container } = render(
      <RealisticWeatherScene areaName="齐齐哈尔市" weather={weather} />,
    );

    const satellite = container.querySelector<HTMLImageElement>(
      "img.realistic-weather-scene__satellite",
    );
    expect(satellite?.src).toContain("World_Imagery/MapServer/export");
    await waitFor(() =>
      expect(
        container.querySelector<HTMLImageElement>("img.realistic-weather-scene__radar")
          ?.src,
      ).toContain("tilecache.example/v2/radar/20/512/6/47.35/123.92"),
    );
    expect(screen.getByText(/雷达观测/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("command-terrain-v2.webp");
  });

  it("labels the live radar as unavailable instead of showing a fake animation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<RealisticWeatherScene areaName="齐齐哈尔市" weather={weather} />);

    expect(await screen.findByText("实时雷达不可用")).toBeInTheDocument();
    expect(screen.queryByText("雷达观测")).not.toBeInTheDocument();
  });
});
