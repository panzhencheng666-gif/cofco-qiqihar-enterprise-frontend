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
