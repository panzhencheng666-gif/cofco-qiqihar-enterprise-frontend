import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapAnnotationOverlay } from "./MapAnnotationOverlay";

describe("MapAnnotationOverlay", () => {
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
    expect(
      screen.queryByRole("dialog", { name: "标注经纬度" }),
    ).not.toBeInTheDocument();
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
