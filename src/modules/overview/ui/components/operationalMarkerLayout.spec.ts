import { describe, expect, it } from "vitest";

import { layoutOperationalMarkers } from "./operationalMarkerLayout";

describe("operational marker layout", () => {
  it("returns every input id exactly once at distinct display centers", () => {
    const markers = Array.from({ length: 160 }, (_, index) => ({
      id: `node-${index}`,
      x: 400,
      y: 300,
    }));

    const result = layoutOperationalMarkers(markers, {
      gapPx: 14,
      viewportWidth: 1000,
      viewportHeight: 700,
      marginPx: 7,
    });

    expect(result.map(({ id }) => id).sort()).toEqual(
      markers.map(({ id }) => id).sort(),
    );
    expect(new Set(result.map(({ x, y }) => `${x}:${y}`))).toHaveLength(160);
  });

  it("is deterministic regardless of input order", () => {
    const markers = [
      { id: "rail-2", x: 100, y: 100 },
      { id: "owned-1", x: 100, y: 100 },
    ];
    const options = {
      gapPx: 18,
      viewportWidth: 400,
      viewportHeight: 300,
      marginPx: 9,
    };

    expect(layoutOperationalMarkers(markers, options)).toEqual(
      layoutOperationalMarkers([...markers].reverse(), options),
    );
  });

  it("preserves anchors and keeps display centers inside the viewport", () => {
    const result = layoutOperationalMarkers(
      [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 1, y: 1 },
      ],
      { gapPx: 20, viewportWidth: 100, viewportHeight: 80, marginPx: 10 },
    );

    expect(result.every(({ anchorX, anchorY }) => anchorX === 1 && anchorY === 1)).toBe(
      true,
    );
    expect(result.every(({ x, y }) => x >= 10 && x <= 90 && y >= 10 && y <= 70)).toBe(
      true,
    );
  });

  it("rejects unusable layout inputs instead of dropping nodes", () => {
    expect(() =>
      layoutOperationalMarkers([{ id: "bad", x: Number.NaN, y: 0 }], {
        gapPx: 14,
        viewportWidth: 100,
        viewportHeight: 100,
        marginPx: 7,
      }),
    ).toThrow("finite");
  });
});
