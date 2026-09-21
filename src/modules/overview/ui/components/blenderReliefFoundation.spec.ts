import { Box3, Group, Vector3 } from "three";

import {
  blenderFoundationTransform,
  isFourRegionBlenderScope,
} from "./blenderReliefFoundation";

describe("Blender sample-map foundation", () => {
  it("activates only for the governed four-region overview", () => {
    expect(isFourRegionBlenderScope(["230200", "231100", "150700", "232700"])).toBe(
      true,
    );
    expect(isFourRegionBlenderScope(["230200", "230202"])).toBe(false);
    expect(
      isFourRegionBlenderScope([
        "230200",
        "231100",
        "150700",
        "232700",
        "CTX:RESIDUAL:230200",
      ]),
    ).toBe(true);
  });

  it("fits a rotated Blender model behind the projected authoritative surface", () => {
    const model = new Group();
    const transform = blenderFoundationTransform(
      new Box3(new Vector3(-500, -700, 0), new Vector3(500, 700, 1200)),
      { maxX: 620, maxY: 280, minX: -580, minY: -260 },
    );

    model.position.copy(transform.position);
    model.scale.copy(transform.scale);

    expect(transform.position.z).toBeLessThan(0);
    expect(transform.scale.x).toBeGreaterThan(1);
    expect(transform.scale.y).toBeGreaterThan(0);
    expect(transform.scale.z).toBeLessThan(0.02);
  });
});
