import { calculateOperationalMapPadding } from "./operationalMapViewport";

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
      bottom: 54,
      left: 54,
      right: 562,
      top: 160,
    });
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
