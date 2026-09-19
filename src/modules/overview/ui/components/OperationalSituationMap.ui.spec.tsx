import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { SaveMapAnnotation } from "../../application/ports/MapAnnotationRepository";

vi.mock("./FourRegionTerrainAtlas", () => ({
  default: ({
    onEnhancementState,
    surfaceMode,
    onAnnotationPosition,
    onAnnotationRectangle,
  }: {
    onEnhancementState?: (state: string) => void;
    surfaceMode?: string;
    onAnnotationPosition?: (lng: number, lat: number) => void;
    onAnnotationRectangle?: (
      start: readonly [number, number],
      end: readonly [number, number],
    ) => void;
  }) => (
    <div data-surface-mode={surfaceMode} data-testid="four-region-atlas">
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED")}>
        模拟增强失败
      </button>
      <button onClick={() => onAnnotationPosition?.(123.123456, 48.654321)}>
        模拟标点
      </button>
      <button onClick={() => onAnnotationRectangle?.([124, 49], [123, 48])}>
        模拟拖拽框选
      </button>
    </div>
  ),
}));

import { OperationalSituationMap } from "./OperationalSituationMap";

describe("OperationalSituationMap public-only controls", () => {
  it("shows saved coordinates and accepts drag rectangles without mode buttons", async () => {
    const save = vi.fn((value: SaveMapAnnotation) =>
      Promise.resolve({
        ...value,
        maxLongitude: value.maxLongitude ?? value.minLongitude,
        maxLatitude: value.maxLatitude ?? value.minLatitude,
        version: 1,
        updatedAt: "2026-09-19T12:00:00Z",
      }),
    );
    renderSituationMap({
      annotationActive: true,
      annotationRepository: {
        current: () => Promise.resolve(undefined),
        save,
        delete: () => Promise.resolve(true),
      },
    });
    expect(screen.queryByRole("button", { name: "范围标注" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "模拟标点" }));
    expect(await screen.findByText(/123.123456/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "模拟拖拽框选" }));
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "RECTANGLE",
        minLongitude: 123,
        minLatitude: 48,
        maxLongitude: 124,
        maxLatitude: 49,
      }),
    );
    expect(await screen.findByText(/124.000000/)).toBeVisible();
  });
  it("keeps one fusion renderer without redundant material controls", async () => {
    const { container } = renderSituationMap();

    const atlas = await screen.findByTestId("four-region-atlas");
    expect(atlas).toHaveAttribute("data-surface-mode", "IMAGERY");
    expect(screen.getAllByRole("button", { name: "地图标注" })).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "地表显示" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "沙盘" })).not.toBeInTheDocument();

    expect(
      container.querySelectorAll(".realistic-situation-control-stack"),
    ).toHaveLength(1);
    expect(container.querySelectorAll(".realistic-situation-lower-rail")).toHaveLength(
      1,
    );
  });

  it("keeps the local four-region map usable when online enhancements fail", async () => {
    renderSituationMap();

    await userEvent.click(await screen.findByRole("button", { name: "模拟增强失败" }));

    expect(
      screen.getByText(
        "在线卫星影像暂不可用，已降级为地形底图；地区搜索与业务图层仍可操作。",
      ),
    ).toBeVisible();
  });
});

function renderSituationMap(
  overrides: Partial<ComponentProps<typeof OperationalSituationMap>> = {},
) {
  return render(
    <OperationalSituationMap
      bounds={{
        minLongitude: 119.8,
        minLatitude: 43.3,
        maxLongitude: 127.4,
        maxLatitude: 53.6,
      }}
      facilities={{
        regionCode: null,
        productCode: null,
        asOf: "2026-09-19",
        storageCategories: [],
        storageFacilities: [],
        railwayFacilities: [],
        railwayLines: [],
        railwayRoutes: [],
        sources: [],
      }}
      features={[]}
      rootFeatures={[]}
      onAnnotationToggle={vi.fn()}
      onFacilitySelect={vi.fn()}
      onRegionDrill={vi.fn()}
      onRegionSelect={vi.fn()}
      onReturnToParent={vi.fn()}
      situation={{
        generatedAt: "2026-09-19T06:00:00Z",
        weather: [],
        publicEvents: [],
        policyEvents: [],
        logisticsFlows: [],
        inventories: [],
        sources: [],
      }}
      {...overrides}
    />,
  );
}
