import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MapFeature } from "./boundaryGeometry";
import { BoundaryMap } from "./BoundaryMap";

const terrainRuntime = vi.hoisted(() => ({
  onReady: undefined as (() => void) | undefined,
}));

vi.mock("./TerrainReliefBoundaryMap", () => ({
  default: ({ onReady }: { onReady: () => void }) => {
    terrainRuntime.onReady = onReady;
    return null;
  },
}));

const feature = (code: string): MapFeature => ({
  region: {
    approvedRecordCount: 0,
    code,
    level: "PREFECTURE",
    name: code,
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
    ],
  },
});

describe("BoundaryMap", () => {
  beforeEach(() => {
    terrainRuntime.onReady = undefined;
    vi.stubGlobal("ResizeObserver", class ResizeObserver {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as RenderingContext,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not accept passive coverage as a substitute for an administrative region", () => {
    const passiveCoverage: MapFeature = {
      region: {
        approvedRecordCount: 0,
        code: "CTX:RESIDUAL:230227",
        level: "TOWNSHIP",
        mapContextOnly: true,
        name: "其他区域",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
        ],
      },
    };

    render(
      <BoundaryMap
        features={[]}
        points={[]}
        selectedCode=""
        onDrill={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(/当前范围尚无可显示/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /其他区域/ })).not.toBeInTheDocument();
    expect(passiveCoverage.region.mapContextOnly).toBe(true);
  });

  it("announces production and market counts without a logistics category", () => {
    render(
      <BoundaryMap
        features={[feature("230200")]}
        onDrill={vi.fn()}
        onSelect={vi.fn()}
        points={[]}
        samplePointAggregates={[
          {
            regionCode: "230200",
            regionName: "齐齐哈尔市",
            regionLevel: "PREFECTURE",
            samplePointCount: 4,
            productionCount: 3,
            marketCount: 1,
            validCoordinateCount: 4,
            dataQualityIssueCount: 0,
            correctionSourceCount: 0,
            unresolvedSourceCount: 0,
          },
        ]}
        samplePointAggregateStatus="ready"
        selectedCode=""
      />,
    );

    const region = screen.getByRole("button", {
      name: "230200，已核定 4 个样本点，其中生产类 3 个、市场类 1 个",
    });
    expect(region).toBeVisible();
    expect(region).not.toHaveAccessibleName(/物流/);
  });

  it("keeps a local terrain placeholder over the initial and replacement scene until each first frame is ready", async () => {
    const common = {
      onDrill: vi.fn(),
      onSelect: vi.fn(),
      points: [],
      selectedCode: "",
    };
    const { rerender } = render(
      <BoundaryMap {...common} features={[feature("230200")]} />,
    );

    expect(await screen.findByText("正在完成地表首帧，请稍候")).toBeVisible();

    act(() => terrainRuntime.onReady?.());
    expect(screen.queryByText("正在完成地表首帧，请稍候")).not.toBeInTheDocument();

    rerender(<BoundaryMap {...common} features={[feature("231100")]} />);
    expect(screen.getByText("正在完成地表首帧，请稍候")).toBeVisible();

    act(() => terrainRuntime.onReady?.());
    expect(screen.queryByText("正在完成地表首帧，请稍候")).not.toBeInTheDocument();
  });
});
