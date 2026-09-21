import { describe, expect, it } from "vitest";

import {
  enhancementTimeoutMs,
  nextEnhancementStatus,
  type RemoteEnhancementId,
  type RemoteEnhancementStatus,
} from "./remoteMapEnhancement";

const ids: readonly RemoteEnhancementId[] = [
  "satellite",
  "terrain-dem",
  "hillshade-dem",
  "openmaptiles",
];

function initial(): RemoteEnhancementStatus {
  return { failed: new Set(), pending: new Set(ids) };
}

describe("remote map enhancement state", () => {
  it("uses bounded deadlines for every external source", () => {
    expect(enhancementTimeoutMs("satellite")).toBe(8000);
    expect(enhancementTimeoutMs("terrain-dem")).toBe(6000);
    expect(enhancementTimeoutMs("hillshade-dem")).toBe(6000);
    expect(enhancementTimeoutMs("openmaptiles")).toBe(8000);
  });

  it("tracks source readiness independently", () => {
    const result = nextEnhancementStatus(initial(), {
      id: "satellite",
      type: "READY",
    });

    expect(result.pending).not.toContain("satellite");
    expect(result.pending).toContain("openmaptiles");
    expect(result.failed).toEqual(new Set());
  });

  it("records failures idempotently and permits later recovery", () => {
    const failed = nextEnhancementStatus(initial(), {
      id: "satellite",
      type: "FAILED",
    });
    const repeated = nextEnhancementStatus(failed, {
      id: "satellite",
      type: "FAILED",
    });
    const recovered = nextEnhancementStatus(repeated, {
      id: "satellite",
      type: "READY",
    });

    expect(repeated.failed).toEqual(new Set(["satellite"]));
    expect(recovered.failed).toEqual(new Set());
    expect(recovered.pending).not.toContain("satellite");
  });
});
