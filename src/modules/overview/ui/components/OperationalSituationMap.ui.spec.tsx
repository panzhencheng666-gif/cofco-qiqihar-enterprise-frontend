import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./FourRegionTerrainAtlas", () => ({
  default: ({
    onEnhancementState,
    surfaceMode,
  }: {
    onEnhancementState?: (state: string) => void;
    surfaceMode?: string;
  }) => (
    <div data-surface-mode={surfaceMode} data-testid="four-region-atlas">
      <button type="button" onClick={() => onEnhancementState?.("DEGRADED")}>
        模拟增强失败
      </button>
    </div>
  ),
}));

import { OperationalSituationMap } from "./OperationalSituationMap";

describe("OperationalSituationMap public-only controls", () => {
  it("switches material modes inside the same map without duplicate controls", async () => {
    const { container } = renderSituationMap();

    const atlas = await screen.findByTestId("four-region-atlas");
    expect(atlas).toHaveAttribute("data-surface-mode", "FUSION");
    expect(screen.getAllByRole("button", { name: "地图标注" })).toHaveLength(1);
    expect(screen.getByRole("group", { name: "地表显示" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "沙盘" }));
    await waitFor(() => expect(atlas).toHaveAttribute("data-surface-mode", "SANDBOX"));
    await userEvent.click(screen.getByRole("button", { name: "实景" }));
    await waitFor(() => expect(atlas).toHaveAttribute("data-surface-mode", "IMAGERY"));

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
      screen.getByText("在线卫星影像暂不可用，四区域球体、边界与业务图层仍可操作。"),
    ).toBeVisible();
  });
});

function renderSituationMap() {
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
    />,
  );
}
