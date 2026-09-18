import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { MapAnnotationOverlay } from "./MapAnnotationOverlay";
import type { SaveMapAnnotation } from "../../application/ports/MapAnnotationRepository";

describe("MapAnnotationOverlay", () => {
  it("keeps the start action visible and opens the annotation sidebar when armed", async () => {
    const onArmedChange = vi.fn();
    render(
      <MapAnnotationOverlay
        active
        bounds={{
          minLongitude: 123,
          minLatitude: 47,
          maxLongitude: 125,
          maxLatitude: 49,
        }}
        repository={{
          current: () => Promise.resolve(undefined),
          save: vi.fn(),
          delete: vi.fn(),
        }}
        onArmedChange={onArmedChange}
      />,
    );

    const start = screen.getByRole("button", { name: "开始标注" });
    expect(start).toBeVisible();
    await userEvent.click(start);

    expect(screen.getByRole("dialog", { name: "标注经纬度" })).toBeVisible();
    expect(onArmedChange).toHaveBeenLastCalledWith(true);
  });

  it("keeps controls outside the map stacking context while drawing stays inside", async () => {
    const save = vi.fn();
    const { container, unmount } = render(
      <main className="overview-command-center">
        <section className="overview-command-map">
          <div className="overview-map-annotation-stage">
            <MapAnnotationOverlay
              active
              bounds={{
                minLongitude: 123,
                minLatitude: 47,
                maxLongitude: 125,
                maxLatitude: 49,
              }}
              repository={{
                current: () => Promise.resolve(undefined),
                save,
                delete: vi.fn(),
              }}
            />
          </div>
        </section>
      </main>,
    );
    const start = screen.getByRole("button", { name: "开始标注" });
    await waitFor(() => expect(start.closest(".overview-command-map")).toBeNull());
    expect(
      screen.getByTestId("map-annotation-surface").closest(".overview-command-map"),
    ).not.toBeNull();
    await userEvent.click(start);
    expect(
      screen
        .getByRole("dialog", { name: "标注经纬度" })
        .closest(".overview-command-map"),
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "放大地图" }));
    expect(save).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "浏览地图" }));
    expect(
      screen.queryByRole("dialog", { name: "标注经纬度" }),
    ).not.toBeInTheDocument();
    unmount();
    expect(container.querySelector(".overview-map-annotation-actions")).toBeNull();
  });

  it("locks the administrative scope captured when annotation is armed", async () => {
    const save = vi.fn((command) =>
      Promise.resolve({ ...command, version: 1, updatedAt: "2026-09-16T00:00:00Z" }),
    );
    const { rerender } = render(
      <MapAnnotationOverlay
        active
        bounds={{
          minLongitude: 123,
          minLatitude: 47,
          maxLongitude: 125,
          maxLatitude: 49,
        }}
        regionCode="230202"
        administrativeLevel="COUNTY"
        repository={{
          current: () => Promise.resolve(undefined),
          save,
          delete: vi.fn(),
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    rerender(
      <MapAnnotationOverlay
        active
        bounds={{
          minLongitude: 123,
          minLatitude: 47,
          maxLongitude: 125,
          maxLatitude: 49,
        }}
        regionCode="230202997001"
        administrativeLevel="VILLAGE"
        repository={{
          current: () => Promise.resolve(undefined),
          save,
          delete: vi.fn(),
        }}
      />,
    );
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
      }),
    });
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 100, pointerId: 1 });

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          regionCode: "230202",
          administrativeLevel: "COUNTY",
        }),
      ),
    );
  });

  it.each([
    [
      "successful save",
      () =>
        Promise.resolve({
          type: "POINT" as const,
          minLongitude: 124,
          minLatitude: 48,
          maxLongitude: 124,
          maxLatitude: 48,
          version: 1,
          updatedAt: "2026-09-16T00:00:00Z",
        }),
    ],
    ["failed save", () => Promise.reject(new Error("save failed"))],
  ])("releases the parent navigation lock after %s", async (_label, save) => {
    const onArmedChange = vi.fn();
    const navigate = vi.fn();
    function Harness() {
      const [navigationLocked, setNavigationLocked] = useState(false);
      return (
        <>
          <button disabled={navigationLocked} onClick={navigate} type="button">
            选择地区
          </button>
          <MapAnnotationOverlay
            active
            bounds={{
              minLongitude: 123,
              minLatitude: 47,
              maxLongitude: 125,
              maxLatitude: 49,
            }}
            repository={{
              current: () => Promise.resolve(undefined),
              save,
              delete: vi.fn(),
            }}
            onArmedChange={(next) => {
              onArmedChange(next);
              setNavigationLocked(next);
            }}
          />
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
      }),
    });
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 100, pointerId: 1 });

    await waitFor(() => expect(onArmedChange).toHaveBeenLastCalledWith(false));
    expect(screen.getByRole("button", { name: "开始标注" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "选择地区" }));
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("releases the parent navigation lock on cancel and armed unmount", async () => {
    const onArmedChange = vi.fn();
    const view = render(
      <MapAnnotationOverlay
        active
        bounds={{
          minLongitude: 123,
          minLatitude: 47,
          maxLongitude: 125,
          maxLatitude: 49,
        }}
        repository={{
          current: () => Promise.resolve(undefined),
          save: vi.fn(),
          delete: vi.fn(),
        }}
        onArmedChange={onArmedChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    await userEvent.click(screen.getByRole("button", { name: "浏览地图" }));
    expect(onArmedChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    view.unmount();
    expect(onArmedChange).toHaveBeenLastCalledWith(false);
  });

  it("pans, zooms, rotates, and resets only while browsing the annotation map", async () => {
    const mapClick = vi.fn();
    const save = vi.fn((command) =>
      Promise.resolve({ ...command, version: 2, updatedAt: "2026-09-18T00:00:00Z" }),
    );
    const { container } = render(
      <div className="overview-map-annotation-stage">
        <div className="overview-terrain-relief-map">
          <button type="button" onClick={mapClick}>
            地图地区
          </button>
        </div>
        <MapAnnotationOverlay
          active
          bounds={{
            minLongitude: 123,
            minLatitude: 47,
            maxLongitude: 125,
            maxLatitude: 49,
          }}
          repository={{
            current: () => Promise.resolve(undefined),
            save,
            delete: vi.fn(),
          }}
        />
      </div>,
    );
    const stage = container.querySelector<HTMLElement>(
      ".overview-map-annotation-stage",
    )!;
    const map = container.querySelector<HTMLElement>(".overview-terrain-relief-map")!;
    Object.defineProperties(map, {
      clientWidth: { value: 1200 },
      clientHeight: { value: 1080 },
      getBoundingClientRect: {
        value: () => ({
          left: 0,
          top: 0,
          width: 600,
          height: 540,
          right: 600,
          bottom: 540,
        }),
      },
    });
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperties(surface, {
      clientWidth: { value: 1200 },
      clientHeight: { value: 1080 },
      getBoundingClientRect: {
        value: () => ({
          left: 0,
          top: 0,
          width: 600,
          height: 540,
          right: 600,
          bottom: 540,
        }),
      },
    });

    fireEvent.pointerDown(map, {
      button: 0,
      clientX: 100,
      clientY: 120,
      pointerId: 7,
    });
    fireEvent.pointerMove(map, { clientX: 160, clientY: 150, pointerId: 7 });
    fireEvent.pointerUp(map, { clientX: 160, clientY: 150, pointerId: 7 });
    fireEvent.click(screen.getByRole("button", { name: "地图地区" }));
    await waitFor(() => {
      expect(stage.style.getPropertyValue("--annotation-map-pan-x")).toBe("120px");
      expect(stage.style.getPropertyValue("--annotation-map-pan-y")).toBe("60px");
    });
    expect(save).not.toHaveBeenCalled();
    expect(mapClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "地图地区" }));
    expect(mapClick).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "顺时针旋转地图" }));
    fireEvent.wheel(map, { deltaY: -100 });
    await waitFor(() => {
      expect(stage.style.getPropertyValue("--annotation-map-rotation")).toBe("15deg");
      expect(stage.style.getPropertyValue("--annotation-map-zoom")).toBe("1.1");
    });
    fireEvent.pointerDown(map, {
      button: 0,
      clientX: 180,
      clientY: 180,
      pointerId: 10,
    });
    fireEvent.pointerMove(map, { clientX: 240, clientY: 210, pointerId: 10 });
    fireEvent.pointerUp(map, { clientX: 240, clientY: 210, pointerId: 10 });
    await waitFor(() => {
      expect(stage.style.getPropertyValue("--annotation-map-pan-x")).toBe("240px");
      expect(stage.style.getPropertyValue("--annotation-map-pan-y")).toBe("120px");
    });

    await userEvent.click(screen.getByRole("button", { name: "复位地图视角" }));
    await waitFor(() => {
      expect(stage.style.getPropertyValue("--annotation-map-pan-x")).toBe("0px");
      expect(stage.style.getPropertyValue("--annotation-map-pan-y")).toBe("0px");
      expect(stage.style.getPropertyValue("--annotation-map-rotation")).toBe("0deg");
      expect(stage.style.getPropertyValue("--annotation-map-zoom")).toBe("1");
    });

    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    expect(screen.getByRole("button", { name: "顺时针旋转地图" })).toBeDisabled();
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 300,
      clientY: 320,
      pointerId: 8,
    });
    fireEvent.pointerUp(surface, { clientX: 300, clientY: 320, pointerId: 8 });
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(stage.style.getPropertyValue("--annotation-map-pan-x")).toBe("0px");
  });

  it("uses all four screen corners for a rectangle drawn on a rotated map", async () => {
    const save = vi.fn((command) =>
      Promise.resolve({ ...command, version: 2, updatedAt: "2026-09-18T00:00:00Z" }),
    );
    render(
      <div className="overview-map-annotation-stage">
        <div className="overview-terrain-relief-map" />
        <MapAnnotationOverlay
          active
          bounds={{
            minLongitude: 123,
            minLatitude: 47,
            maxLongitude: 125,
            maxLatitude: 49,
          }}
          repository={{
            current: () => Promise.resolve(undefined),
            save,
            delete: vi.fn(),
          }}
        />
      </div>,
    );
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperties(surface, {
      clientWidth: { value: 100 },
      clientHeight: { value: 100 },
      getBoundingClientRect: {
        value: () => ({
          left: 0,
          top: 0,
          width: 100,
          height: 100,
          right: 100,
          bottom: 100,
        }),
      },
    });
    const rotate = screen.getByRole("button", { name: "顺时针旋转地图" });
    await userEvent.click(rotate);
    await userEvent.click(rotate);
    await userEvent.click(rotate);
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 40,
      clientY: 40,
      pointerId: 9,
    });
    fireEvent.pointerMove(surface, { clientX: 60, clientY: 60, pointerId: 9 });
    fireEvent.pointerUp(surface, { clientX: 60, clientY: 60, pointerId: 9 });

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const command = save.mock.calls[0]?.[0] as SaveMapAnnotation;
    expect(command.type).toBe("RECTANGLE");
    expect(command.maxLongitude! - command.minLongitude).toBeGreaterThan(0.5);
    expect(command.maxLatitude! - command.minLatitude).toBeGreaterThan(0.5);
    const shape = await screen.findByLabelText("已保存矩形标注");
    expect(shape.style.transform).toBe("rotate(45deg)");
  });

  it("keeps navigation controls available when the WebGL map uses its fallback", async () => {
    const repository = {
      current: () => Promise.resolve(undefined),
      save: vi.fn(),
      delete: vi.fn(),
    };
    const { container, rerender } = render(
      <div className="overview-map-annotation-stage">
        <div className="overview-map-loading" />
        <MapAnnotationOverlay
          active
          bounds={{
            minLongitude: 123,
            minLatitude: 47,
            maxLongitude: 125,
            maxLatitude: 49,
          }}
          repository={repository}
        />
      </div>,
    );
    const stage = container.querySelector<HTMLElement>(
      ".overview-map-annotation-stage",
    )!;
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperties(surface, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
      getBoundingClientRect: {
        value: () => ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
        }),
      },
    });
    rerender(
      <div className="overview-map-annotation-stage">
        <div className="overview-map-fallback" />
        <MapAnnotationOverlay
          active
          bounds={{
            minLongitude: 123,
            minLatitude: 47,
            maxLongitude: 125,
            maxLatitude: 49,
          }}
          repository={repository}
        />
      </div>,
    );
    const fallback = container.querySelector<HTMLElement>(".overview-map-fallback")!;

    fireEvent.pointerDown(fallback, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 11,
    });
    fireEvent.pointerMove(fallback, { clientX: 140, clientY: 120, pointerId: 11 });
    fireEvent.pointerUp(fallback, { clientX: 140, clientY: 120, pointerId: 11 });
    await waitFor(() => {
      expect(stage.style.getPropertyValue("--annotation-map-pan-x")).toBe("40px");
      expect(stage.style.getPropertyValue("--annotation-map-pan-y")).toBe("20px");
    });
    await userEvent.click(screen.getByRole("button", { name: "顺时针旋转地图" }));
    expect(stage.style.getPropertyValue("--annotation-map-rotation")).toBe("15deg");
  });

  it("round-trips coordinates under zoom around the terrain element pivot with a noncentral frame", async () => {
    const save = vi.fn((command) =>
      Promise.resolve({ ...command, version: 2, updatedAt: "2026-09-16T00:00:00Z" }),
    );
    render(
      <div className="overview-map-annotation-stage">
        <div
          className="overview-terrain-relief-map"
          data-projection-source-min-x="123"
          data-projection-source-max-x="125"
          data-projection-source-min-y="47"
          data-projection-source-max-y="49"
          data-projection-frame-x="180"
          data-projection-frame-y="290"
          data-projection-frame-width="720"
          data-projection-frame-height="706"
        />
        <MapAnnotationOverlay
          active
          bounds={{
            minLongitude: 123,
            minLatitude: 47,
            maxLongitude: 125,
            maxLatitude: 49,
          }}
          repository={{
            current: () =>
              Promise.resolve({
                type: "POINT",
                minLongitude: 124.5,
                minLatitude: 48,
                maxLongitude: 124.5,
                maxLatitude: 48,
                version: 1,
                updatedAt: "2026-09-16T00:00:00Z",
              }),
            save,
            delete: vi.fn(),
          }}
        />
      </div>,
    );
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperties(surface, {
      clientWidth: { value: 1200 },
      clientHeight: { value: 1080 },
      getBoundingClientRect: {
        value: () => ({
          left: 0,
          top: 0,
          width: 1200,
          height: 1080,
          right: 1200,
          bottom: 1080,
        }),
      },
    });
    const marker = await screen.findByLabelText("已保存点标注");

    await userEvent.click(screen.getByRole("button", { name: "放大地图" }));
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    const x = Number.parseFloat(marker.style.left);
    const y = Number.parseFloat(marker.style.top);
    expect(x).toBeCloseTo(728.88, 2);
    expect(y).toBeCloseTo(649.2, 2);
    fireEvent.pointerDown(surface, { button: 0, clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: x, clientY: y, pointerId: 1 });

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0]?.[0] as SaveMapAnnotation).minLongitude).toBeCloseTo(
      124.5,
      6,
    );
    expect((save.mock.calls[0]?.[0] as SaveMapAnnotation).minLatitude).toBeCloseTo(
      48,
      6,
    );
    expect(
      marker
        .closest<HTMLElement>(".overview-map-annotation-stage")
        ?.style.getPropertyValue("--annotation-map-zoom"),
    ).toBe("1.2");
  });

  it.each(["POINT", "RECTANGLE"] as const)(
    "reprojects a saved %s after arm changes the committed sibling frame and again after cancel",
    async (type) => {
      const bounds = {
        minLongitude: 123,
        minLatitude: 47,
        maxLongitude: 125,
        maxLatitude: 49,
      };
      const annotation =
        type === "POINT"
          ? {
              type,
              minLongitude: 124.5,
              minLatitude: 48,
              maxLongitude: 124.5,
              maxLatitude: 48,
            }
          : {
              type,
              minLongitude: 123.5,
              minLatitude: 47.5,
              maxLongitude: 124.5,
              maxLatitude: 48.5,
            };
      function Harness() {
        const [armed, setArmed] = useState(false);
        return (
          <div className="overview-map-annotation-stage">
            <div
              className="overview-terrain-relief-map"
              data-projection-source-min-x="123"
              data-projection-source-max-x="125"
              data-projection-source-min-y="47"
              data-projection-source-max-y="49"
              data-projection-frame-x={armed ? "50" : "0"}
              data-projection-frame-y="0"
              data-projection-frame-width={armed ? "100" : "200"}
              data-projection-frame-height="200"
            />
            <MapAnnotationOverlay
              active
              bounds={bounds}
              repository={{
                current: () =>
                  Promise.resolve({
                    ...annotation,
                    version: 1,
                    updatedAt: "2026-09-16T00:00:00Z",
                  }),
                save: vi.fn(),
                delete: vi.fn(),
              }}
              onArmedChange={setArmed}
            />
          </div>
        );
      }
      render(<Harness />);
      const shape = await screen.findByLabelText(
        type === "POINT" ? "已保存点标注" : "已保存矩形标注",
      );
      const initialLeft = shape.style.left;
      const initialWidth = shape.style.width;

      await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
      await waitFor(() => expect(shape.style.left).not.toBe(initialLeft));
      if (type === "RECTANGLE") expect(shape.style.width).not.toBe(initialWidth);

      await userEvent.click(screen.getByRole("button", { name: "浏览地图" }));
      await waitFor(() => expect(shape.style.left).toBe(initialLeft));
      if (type === "RECTANGLE") expect(shape.style.width).toBe(initialWidth);
    },
  );

  it("reprojects a saved point after a terrain element resize and keeps inverse alignment", async () => {
    let resize: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const save = vi.fn((command) =>
      Promise.resolve({ ...command, version: 2, updatedAt: "2026-09-16T00:00:00Z" }),
    );
    try {
      render(
        <div className="overview-map-annotation-stage">
          <div
            className="overview-terrain-relief-map"
            data-projection-source-min-x="123"
            data-projection-source-max-x="125"
            data-projection-source-min-y="47"
            data-projection-source-max-y="49"
            data-projection-frame-x="180"
            data-projection-frame-y="290"
            data-projection-frame-width="720"
            data-projection-frame-height="706"
          />
          <MapAnnotationOverlay
            active
            bounds={{
              minLongitude: 123,
              minLatitude: 47,
              maxLongitude: 125,
              maxLatitude: 49,
            }}
            repository={{
              current: () =>
                Promise.resolve({
                  type: "POINT",
                  minLongitude: 124.5,
                  minLatitude: 48,
                  maxLongitude: 124.5,
                  maxLatitude: 48,
                  version: 1,
                  updatedAt: "2026-09-16T00:00:00Z",
                }),
              save,
              delete: vi.fn(),
            }}
          />
        </div>,
      );
      const surface = screen.getByTestId("map-annotation-surface");
      const map = document.querySelector<HTMLElement>(".overview-terrain-relief-map")!;
      Object.defineProperties(surface, {
        clientWidth: { configurable: true, value: 1200 },
        clientHeight: { configurable: true, value: 1080 },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            left: 0,
            top: 0,
            width: 1200,
            height: 1080,
            right: 1200,
            bottom: 1080,
          }),
        },
      });
      Object.defineProperties(map, {
        clientWidth: { configurable: true, value: 1200 },
        clientHeight: { configurable: true, value: 1080 },
      });
      const marker = await screen.findByLabelText("已保存点标注");
      await userEvent.click(screen.getByRole("button", { name: "放大地图" }));
      const before = marker.style.left;
      Object.defineProperty(map, "clientWidth", { configurable: true, value: 1000 });
      resize?.([], {} as ResizeObserver);
      await waitFor(() => expect(marker.style.left).not.toBe(before));

      await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
      const x = Number.parseFloat(marker.style.left);
      const y = Number.parseFloat(marker.style.top);
      fireEvent.pointerDown(surface, {
        button: 0,
        clientX: x,
        clientY: y,
        pointerId: 1,
      });
      fireEvent.pointerUp(surface, { clientX: x, clientY: y, pointerId: 1 });
      await waitFor(() => expect(save).toHaveBeenCalled());
      expect((save.mock.calls[0]?.[0] as SaveMapAnnotation).minLongitude).toBeCloseTo(
        124.5,
        6,
      );
      expect((save.mock.calls[0]?.[0] as SaveMapAnnotation).minLatitude).toBeCloseTo(
        48,
        6,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows coordinates only after pointer release and replaces the previous shape", async () => {
    const save = vi
      .fn()
      .mockImplementation((command) =>
        Promise.resolve({ ...command, version: 1, updatedAt: "2026-09-16T00:00:00Z" }),
      );
    render(
      <MapAnnotationOverlay
        active
        bounds={{
          minLongitude: 123,
          minLatitude: 47,
          maxLongitude: 125,
          maxLatitude: 49,
        }}
        repository={{
          current: () => Promise.resolve(undefined),
          save,
          delete: vi.fn(),
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
      }),
    });
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 20,
      clientY: 30,
      pointerId: 1,
    });
    fireEvent.pointerMove(surface, { clientX: 160, clientY: 170, pointerId: 1 });
    expect(screen.getByRole("dialog", { name: "标注经纬度" })).not.toHaveTextContent(
      "经度范围",
    );
    fireEvent.pointerUp(surface, { clientX: 160, clientY: 170, pointerId: 1 });
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ type: "RECTANGLE" })),
    );
    expect(screen.getByRole("dialog", { name: "标注经纬度" })).toHaveTextContent(
      "经度范围",
    );
  });

  it("does not render a persisted annotation outside the annotation tab", () => {
    render(
      <MapAnnotationOverlay
        active={false}
        bounds={{
          minLongitude: 123,
          minLatitude: 47,
          maxLongitude: 125,
          maxLatitude: 49,
        }}
        repository={{
          current: () =>
            Promise.resolve({
              type: "POINT",
              minLongitude: 124,
              minLatitude: 48,
              maxLongitude: 124,
              maxLatitude: 48,
              version: 0,
              updatedAt: "2026-09-16T00:00:00Z",
            }),
          save: vi.fn(),
          delete: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByTestId("map-annotation-surface")).not.toBeInTheDocument();
  });
});
