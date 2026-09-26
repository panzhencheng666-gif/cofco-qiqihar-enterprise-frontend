import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Three from "three";
import TerrainReliefBoundaryMap from "./TerrainReliefBoundaryMap";
import type { MapFeature, MapPointFeature } from "./boundaryGeometry";

const gpu = vi.hoisted(() => ({ created: vi.fn(), disposed: vi.fn() }));
// jsdom has no GPU. Keep real projection, React effects and region interaction.
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof Three>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      capabilities = { getMaxAnisotropy: () => 1 };
      constructor() {
        gpu.created();
      }
      setPixelRatio() {}
      setSize() {}
      render() {}
      forceContextLoss() {}
      dispose() {
        gpu.disposed();
      }
    },
  };
});

const feature: MapFeature = {
  region: {
    code: "230200",
    name: "齐齐哈尔市",
    level: "PREFECTURE",
    approvedRecordCount: 329,
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 48],
        [123, 47],
      ],
    ],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("relief statistics refresh", () => {
  it("retains the renderer while labels and selection/drill use the latest counts", () => {
    vi.useFakeTimers();
    const props = {
      points: [],
      selectedCode: "",
      onReady: vi.fn(),
      onUnavailable: vi.fn(),
      onSelect: vi.fn(),
      onDrill: vi.fn(),
    };
    const view = render(<TerrainReliefBoundaryMap {...props} features={[feature]} />);
    expect(screen.getByRole("button", { name: /已核定 329/ })).toBeInTheDocument();
    const initialCreates = gpu.created.mock.calls.length;
    const initialDisposals = gpu.disposed.mock.calls.length;
    for (const count of [null, 0, 417]) {
      const updated = {
        ...feature,
        region: { ...feature.region, approvedRecordCount: count },
      };
      view.rerender(<TerrainReliefBoundaryMap {...props} features={[updated]} />);
      const label = screen.getByRole("button", {
        name: count === null ? /年度业务统计加载中/ : new RegExp(`已核定 ${count}`),
      });
      fireEvent.click(label);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(props.onSelect).toHaveBeenLastCalledWith(updated.region);
      fireEvent.doubleClick(label);
      expect(props.onDrill).toHaveBeenLastCalledWith(updated.region);
      expect(gpu.created).toHaveBeenCalledTimes(initialCreates);
      expect(gpu.disposed).toHaveBeenCalledTimes(initialDisposals);
    }
  });

  it("resolves selection from a retained village point to the current region", () => {
    vi.useFakeTimers();
    const point: MapPointFeature = {
      position: [123.5, 47.5],
      region: {
        code: "village",
        name: "测试村",
        level: "VILLAGE",
        approvedRecordCount: 1,
      },
    };
    const props = {
      features: [feature],
      selectedCode: "",
      onReady: vi.fn(),
      onUnavailable: vi.fn(),
      onSelect: vi.fn(),
      onDrill: vi.fn(),
    };
    const view = render(<TerrainReliefBoundaryMap {...props} points={[point]} />);
    const updated = { ...point, region: { ...point.region, approvedRecordCount: 9 } };
    view.rerender(<TerrainReliefBoundaryMap {...props} points={[updated]} />);
    const hit = view.container.querySelector(".overview-relief-point-hit");
    expect(hit).not.toBeNull();
    fireEvent.click(hit!);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(props.onSelect).toHaveBeenLastCalledWith(updated.region);
  });

  it("rebuilds when geometry changes", () => {
    const props = {
      points: [],
      selectedCode: "",
      onReady: vi.fn(),
      onUnavailable: vi.fn(),
      onSelect: vi.fn(),
      onDrill: vi.fn(),
    };
    const view = render(<TerrainReliefBoundaryMap {...props} features={[feature]} />);
    const initialCreates = gpu.created.mock.calls.length;
    const changed: MapFeature = {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [122, 47],
            [124, 47],
            [124, 48],
            [122, 48],
            [122, 47],
          ],
        ],
      },
    };
    view.rerender(<TerrainReliefBoundaryMap {...props} features={[changed]} />);
    expect(gpu.created).toHaveBeenCalledTimes(initialCreates + 1);
  });
});
