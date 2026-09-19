import { vi } from "vitest";

import {
  calculateOperationalMapPadding,
  fitOperationalMap,
} from "./operationalMapViewport";

describe("calculateOperationalMapPadding", () => {
  it("keeps the complete map bounds inside the unobscured area", () => {
    const commandCenter = document.createElement("div");
    commandCenter.className = "overview-command-center";
    const container = document.createElement("div");
    const panel = document.createElement("aside");
    panel.className = "overview-data-mode";
    const tools = document.createElement("div");
    tools.className = "overview-command-tools";
    commandCenter.append(container, panel, tools);
    document.body.append(commandCenter);

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 800 },
      clientWidth: { configurable: true, value: 1200 },
    });
    container.getBoundingClientRect = () => domRect(0, 0, 1200, 800);
    panel.getBoundingClientRect = () => domRect(660, 88, 540, 688);
    tools.getBoundingClientRect = () => domRect(176, 102, 462, 42);

    expect(calculateOperationalMapPadding(container)).toEqual({
      bottom: 96,
      left: 54,
      right: 562,
      top: 160,
    });
  });
});

describe("fitOperationalMap", () => {
  it("applies a finite flat-bounds camera before adding pitch and constraints", () => {
    const center = { lng: 125.06, lat: 49.89 };
    const map = {
      cameraForBounds: vi.fn(() => ({ center, zoom: 5.4 })),
      jumpTo: vi.fn(),
      setMaxBounds: vi.fn(),
      setMinZoom: vi.fn(),
    };
    const bounds: [[number, number], [number, number]] = [
      [120.48, 46.22],
      [129.65, 53.56],
    ];
    const padding = { bottom: 54, left: 54, right: 54, top: 175 };

    fitOperationalMap(map, bounds, padding, 30);

    expect(map.cameraForBounds).toHaveBeenCalledWith(bounds, {
      bearing: 0,
      padding,
    });
    expect(map.jumpTo).toHaveBeenCalledWith({
      bearing: 0,
      center,
      pitch: 30,
      zoom: 5.4,
    });
    expect(map.setMinZoom).toHaveBeenLastCalledWith(5.15);
    expect(map.setMaxBounds).toHaveBeenLastCalledWith(bounds);
  });
});

function domRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    bottom: y + height,
    height,
    left: x,
    right: x + width,
    top: y,
    width,
    x,
    y,
    toJSON: () => ({}),
  };
}
