import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MapFeature } from "./boundaryGeometry";
import { BoundaryMap } from "./BoundaryMap";

const terrainRuntime = vi.hoisted(() => ({
  onReady: undefined as (() => void) | undefined,
  props: undefined as Record<string, unknown> | undefined,
}));

vi.mock("./TerrainReliefBoundaryMap", () => ({
  default: (props: Record<string, unknown> & { onReady: () => void }) => {
    terrainRuntime.onReady = props.onReady;
    terrainRuntime.props = props;
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
    terrainRuntime.props = undefined;
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

  it("forwards one controlled sample-point selection to the terrain map", () => {
    const onSamplePointSelect = vi.fn();
    const icon = {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      iconKey: "farmer",
      types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
      longitude: 123.5,
      latitude: 47.5,
      dataQualityReason: null,
    };

    render(
      <BoundaryMap
        features={[feature("230200")]}
        onDrill={vi.fn()}
        onSamplePointSelect={onSamplePointSelect}
        onSelect={vi.fn()}
        points={[]}
        samplePointIcons={[icon]}
        selectedCode=""
        selectedSamplePointId={icon.samplePointId}
      />,
    );

    expect(terrainRuntime.props).toMatchObject({
      onSamplePointSelect,
      selectedSamplePointId: icon.samplePointId,
    });
    (
      terrainRuntime.props?.onSamplePointSelect as
        ((samplePointId: string) => void) | undefined
    )?.(icon.samplePointId);
    expect(onSamplePointSelect).toHaveBeenCalledWith(icon.samplePointId);
  });

  it("announces informational network markers without empty-action buttons", () => {
    render(
      <BoundaryMap
        features={[feature("230200")]}
        onDrill={vi.fn()}
        onSelect={vi.fn()}
        points={[]}
        samplePointIcons={[
          {
            samplePointId: "design-coverage:230202997001",
            name: "契约测试村设计覆盖",
            iconKey: "design-reference",
            layerType: "DESIGN_COVERAGE_BADGE",
            anchorRegionCode: "230202997001",
            types: [],
            longitude: 123.5,
            latitude: 47.5,
            dataQualityReason: null,
          },
          {
            samplePointId: "regional-actual:COUNTY:230202",
            name: "龙沙区区域级现有样本（2个）",
            iconKey: "regional-actual",
            layerType: "REGIONAL_ACTUAL_BADGE",
            anchorRegionCode: "230202997",
            representedRegionCode: "230202",
            representedRegionName: "龙沙区",
            representedRegionLevel: "COUNTY",
            aggregateCount: 2,
            types: [],
            longitude: null,
            latitude: null,
            dataQualityReason: "MISSING_COORDINATE",
          },
          {
            samplePointId: "design-exact:230202997001",
            name: "契约测试村设计样本点精确位置",
            iconKey: "design-reference",
            layerType: "DESIGN_EXACT_LOCATION",
            villageRegionCode: "230202997001",
            types: [],
            longitude: 123.5,
            latitude: 47.5,
            dataQualityReason: null,
          },
        ]}
        selectedCode=""
      />,
    );

    act(() => {
      (terrainRuntime.props?.onUnavailable as ((reason: string) => void) | undefined)?.(
        "test fallback",
      );
    });

    expect(
      screen.getByRole("img", {
        name: /契约测试村设计覆盖，行政村展示分区覆盖徽标/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /龙沙区区域级现有样本（2个），仅确认到区县/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /契约测试村设计样本点精确位置，已审核设计样本点精确位置/,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /契约测试村设计覆盖/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /龙沙区区域级现有样本/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /设计样本点精确位置/ }),
    ).not.toBeInTheDocument();
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
