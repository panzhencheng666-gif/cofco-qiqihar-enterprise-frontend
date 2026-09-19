import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadSvgMarkerImage,
  realisticSituationIcon,
  realisticWeatherIcon,
} from "./realisticSituationIcons";

function decodeDataUrl(value: string) {
  return decodeURIComponent(value.slice(value.indexOf(",") + 1));
}

describe("realistic situation icons", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["OWNED", "#198754", "自有库"],
    ["LEASED", "#d99a00", "租赁库"],
    ["HISTORICAL_LEASED", "#747b83", "历史租赁库"],
  ] as const)("renders %s as a distinct grain warehouse", (category, color, label) => {
    const svg = decodeDataUrl(realisticSituationIcon(category));
    expect(svg).toContain(color);
    expect(svg).toContain(label);
    expect(svg).toContain("粮库");
  });

  it("renders railway nodes as a white diesel locomotive", () => {
    const svg = decodeDataUrl(realisticSituationIcon("RAILWAY"));
    expect(svg).toContain("内燃机车");
    expect(svg).toContain("#ffffff");
  });

  it("derives weather imagery from the live weather code", () => {
    expect(decodeDataUrl(realisticWeatherIcon(63))).toContain("降雨");
    expect(decodeDataUrl(realisticWeatherIcon(73))).toContain("降雪");
    expect(decodeDataUrl(realisticWeatherIcon(1))).toContain("晴间多云");
  });

  it("decodes generated SVG markers through the browser image pipeline", async () => {
    let loadedSource = "";
    class LoadableImage {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      set src(value: string) {
        loadedSource = value;
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", LoadableImage);

    const image = await loadSvgMarkerImage(realisticSituationIcon("RAILWAY"));

    expect(image).toBeInstanceOf(LoadableImage);
    expect(loadedSource).toMatch(/^data:image\/svg\+xml/);
  });
});
