import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapAnnotationOverlay } from "./MapAnnotationOverlay";

describe("MapAnnotationOverlay", () => {
  it("keeps the start action visible and opens the annotation sidebar when armed", async () => {
    const onArmedChange = vi.fn();
    render(
      <MapAnnotationOverlay
        active
        bounds={{ minLongitude: 123, minLatitude: 47, maxLongitude: 125, maxLatitude: 49 }}
        repository={{ current: () => Promise.resolve(undefined), save: vi.fn(), delete: vi.fn() }}
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
        bounds={{ minLongitude: 123, minLatitude: 47, maxLongitude: 125, maxLatitude: 49 }}
        regionCode="230202"
        administrativeLevel="COUNTY"
        repository={{ current: () => Promise.resolve(undefined), save, delete: vi.fn() }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "开始标注" }));
    rerender(
      <MapAnnotationOverlay
        active
        bounds={{ minLongitude: 123, minLatitude: 47, maxLongitude: 125, maxLatitude: 49 }}
        regionCode="230202997001"
        administrativeLevel="VILLAGE"
        repository={{ current: () => Promise.resolve(undefined), save, delete: vi.fn() }}
      />,
    );
    const surface = screen.getByTestId("map-annotation-surface");
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 }),
    });
    fireEvent.pointerDown(surface, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 100, pointerId: 1 });

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ regionCode: "230202", administrativeLevel: "COUNTY" }),
      ),
    );
  });

  it("uses the same zoomed projection for the map and persisted annotations", async () => {
    render(
      <div className="overview-map-annotation-stage">
        <div
          className="overview-terrain-relief-map"
          data-projection-source-min-x="123"
          data-projection-source-max-x="125"
          data-projection-source-min-y="47"
          data-projection-source-max-y="49"
          data-projection-frame-x="0"
          data-projection-frame-y="0"
          data-projection-frame-width="200"
          data-projection-frame-height="200"
        />
        <MapAnnotationOverlay
          active
          bounds={{ minLongitude: 123, minLatitude: 47, maxLongitude: 125, maxLatitude: 49 }}
          repository={{
            current: () => Promise.resolve({
              type: "POINT",
              minLongitude: 124.5,
              minLatitude: 48,
              maxLongitude: 124.5,
              maxLatitude: 48,
              version: 1,
              updatedAt: "2026-09-16T00:00:00Z",
            }),
            save: vi.fn(),
            delete: vi.fn(),
          }}
        />
      </div>,
    );
    const marker = await screen.findByLabelText("已保存点标注");
    const before = Number.parseFloat(marker.style.left);

    await userEvent.click(screen.getByRole("button", { name: "放大地图" }));

    expect(Number.parseFloat(marker.style.left)).toBeGreaterThan(before);
    expect(
      marker.closest<HTMLElement>(".overview-map-annotation-stage")?.style.getPropertyValue(
        "--annotation-map-zoom",
      ),
    ).toBe("1.2");
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
