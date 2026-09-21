import { describe, expect, it } from "vitest";

import {
  publicSituationAtmosphere,
  publicSituationPitch,
  publicSituationProjection,
} from "./publicSituationViewport";

describe("public situation viewport", () => {
  it("uses a globe for the four-prefecture overview", () => {
    expect(publicSituationProjection("PREFECTURE")).toBe("globe");
    expect(publicSituationAtmosphere("PREFECTURE")).toBeGreaterThan(0.8);
    expect(publicSituationPitch("PREFECTURE", 30)).toBe(25);
  });

  it("uses a pitched detail map below prefecture level", () => {
    expect(publicSituationProjection("COUNTY")).toBe("mercator");
    expect(publicSituationProjection("TOWNSHIP")).toBe("mercator");
    expect(publicSituationProjection("VILLAGE")).toBe("mercator");
    expect(publicSituationPitch("COUNTY", 30)).toBe(60);
  });
});
