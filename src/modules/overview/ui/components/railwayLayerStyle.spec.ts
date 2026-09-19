import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { expect, it } from "vitest";
import { FACILITY_ICON_SIZE } from "./fourRegionTerrainStyle";

it("accepts the actual facility zoom expression instead of dropping all stations", () => {
  const errors = validateStyleMin({
    version: 8,
    sources: {
      stations: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      {
        id: "stations",
        type: "symbol",
        source: "stations",
        layout: { "icon-image": "railway", "icon-size": FACILITY_ICON_SIZE },
      },
    ],
  });
  expect(errors.map((error) => error.message)).toEqual([]);
});
