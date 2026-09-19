import { describe, expect, it, vi } from "vitest";

import { fitOperationalMap } from "./operationalMapViewport";

describe("fitOperationalMap", () => {
  it("keeps the governed bounds centered while allowing enough surrounding context", () => {
    const jumpTo =
      vi.fn<
        (options: { center: [number, number]; pitch: number; zoom: number }) => void
      >();
    const setMaxBounds = vi.fn();
    const map = {
      cameraForBounds: vi.fn(() => ({ center: [125, 50], zoom: 5.4 })),
      jumpTo,
      setMaxBounds,
      setMinZoom: vi.fn(),
    };

    fitOperationalMap(
      map as never,
      [
        [120, 46],
        [130, 54],
      ],
      { bottom: 96, left: 54, right: 54, top: 104 },
      45,
      -0.65,
    );

    expect(jumpTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [125, 50], pitch: 45 }),
    );
    expect(jumpTo.mock.calls[0]?.[0]?.zoom).toBeCloseTo(6.05);
    expect(setMaxBounds).toHaveBeenLastCalledWith([
      [100, 30],
      [150, 70],
    ]);
  });
});
