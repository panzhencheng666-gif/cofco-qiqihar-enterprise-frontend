import { describe, expect, it } from "vitest";

import {
  REALISTIC_ROOT_BOUNDS,
  altitudeDetailLevel,
  focusDepotCategory,
  realisticCamera,
  situationFeatureId,
  SituationViewerLifecycle,
} from "./realisticSituationModel";

describe("realistic situation model", () => {
  it("focuses each depot category independently", () => {
    expect(focusDepotCategory("OWNED")).toEqual({
      OWNED: true,
      LEASED: false,
      HISTORICAL_LEASED: false,
    });
    expect(focusDepotCategory("LEASED")).toEqual({
      OWNED: false,
      LEASED: true,
      HISTORICAL_LEASED: false,
    });
    expect(focusDepotCategory("HISTORICAL_LEASED")).toEqual({
      OWNED: false,
      LEASED: false,
      HISTORICAL_LEASED: true,
    });
  });

  it("moves through administrative detail as camera altitude falls", () => {
    expect(altitudeDetailLevel(1_900_000)).toBe("PREFECTURE");
    expect(altitudeDetailLevel(550_000)).toBe("COUNTY");
    expect(altitudeDetailLevel(120_000)).toBe("TOWNSHIP");
    expect(altitudeDetailLevel(24_000)).toBe("VILLAGE");
  });

  it("frames all four operating regions from the root camera", () => {
    const camera = realisticCamera(REALISTIC_ROOT_BOUNDS, "PREFECTURE");
    expect(camera.longitude).toBeGreaterThan(122);
    expect(camera.longitude).toBeLessThan(126);
    expect(camera.latitude).toBeGreaterThan(47);
    expect(camera.latitude).toBeLessThan(51);
    expect(camera.height).toBeGreaterThanOrEqual(1_700_000);
    expect(camera.pitchDegrees).toBeLessThan(0);
  });

  it("uses stable feature identities across refreshes", () => {
    expect(situationFeatureId("RAILWAY", "node-8")).toBe("RAILWAY:node-8");
    expect(situationFeatureId("OWNED", "store-1")).toBe("OWNED:store-1");
  });

  it("tracks one canvas viewer without DOM markers", () => {
    const lifecycle = new SituationViewerLifecycle();
    lifecycle.viewerCreated();
    lifecycle.dataSynchronized({ billboardCount: 143, domMarkerCount: 0 });
    lifecycle.dataSynchronized({ billboardCount: 144, domMarkerCount: 0 });
    expect(lifecycle.snapshot()).toEqual({
      activeViewerCount: 1,
      billboardCount: 144,
      createdViewerCount: 1,
      domMarkerCount: 0,
    });
  });
});

