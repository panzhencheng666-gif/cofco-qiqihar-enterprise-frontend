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
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED_IMAGERY")}>
        模拟卫星失败
      </button>
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED_TERRAIN")}>
        模拟地形失败
      </button>
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED_BASEMAP")}>
        模拟底图失败
      </button>
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED_ICONS")}>
        模拟图标失败
      </button>
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED_MULTIPLE")}>
        模拟多源失败
      </button>
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED_RENDERER")}>
        模拟渲染器失败
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
  it("identifies the live four-region scope instead of naming a last record", () => {
    renderSituationMap();
    expect(
      screen.getByText("实时总览 · 齐齐哈尔、呼伦贝尔、黑河、大兴安岭"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "返回实时总览" })).toBeDisabled();
  });
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

  it.each([
    ["模拟卫星失败", "卫星影像暂不可用，已保留行政边界和业务节点。"],
    ["模拟地形失败", "高程地形暂不可用，已保留卫星底图和业务节点。"],
    ["模拟底图失败", "道路与地名底图暂不可用，已保留行政边界和业务节点。"],
    ["模拟图标失败", "部分业务图标加载失败；地图数据与查询仍可使用。"],
    ["模拟多源失败", "多个在线地图源暂不可用，已保留本地底图、行政边界和业务节点。"],
    [
      "模拟渲染器失败",
      "地图渲染器初始化失败，当前无法显示地图；筛选条件和页面数据仍保留。",
    ],
  ])("reports the failed online enhancement for %s", async (button, notice) => {
    renderSituationMap();

    await userEvent.click(await screen.findByRole("button", { name: button }));

    expect(screen.getByText(notice)).toBeVisible();
  });

  it("explains how local and nearby railway markers differ", async () => {
    renderSituationMap();

    await userEvent.click(screen.getByRole("button", { name: "节点图层" }));

    expect(screen.getByText("境内 0 · 邻近 0（淡色环）")).toBeVisible();
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
