import { describe, expect, it } from "vitest";

import {
  latestRadarFrame,
  liveRadarImageUrl,
  liveSatelliteExportUrl,
} from "./liveWeatherImagery";

describe("live weather imagery", () => {
  it("selects the newest real radar frame and preserves its observation time", () => {
    const frame = latestRadarFrame({
      generated: 20,
      host: "https://tilecache.example",
      radar: {
        past: [
          { time: 10, path: "/v2/radar/10" },
          { time: 20, path: "/v2/radar/20" },
        ],
      },
    });

    expect(frame).toEqual({
      host: "https://tilecache.example",
      observedAt: 20,
      path: "/v2/radar/20",
    });
  });

  it("builds regional satellite and live radar URLs from real coordinates", () => {
    const satellite = liveSatelliteExportUrl(123.92, 47.35);
    const radar = liveRadarImageUrl(
      { host: "https://tilecache.example", path: "/v2/radar/20", observedAt: 20 },
      123.92,
      47.35,
    );

    expect(satellite).toContain("World_Imagery/MapServer/export");
    expect(satellite).toContain("bbox=");
    expect(radar).toBe(
      "https://tilecache.example/v2/radar/20/512/6/47.35/123.92/2/1_1.png",
    );
  });
});
