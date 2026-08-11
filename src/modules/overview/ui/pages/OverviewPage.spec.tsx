import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import { OverviewPage } from "./OverviewPage";

describe("OverviewPage", () => {
  it("renders the approved cockpit layout from repository data without embedding preview values", async () => {
    const dashboard = vi.fn(() =>
      Promise.resolve({
        scope: {
          countyCount: 7,
          townshipCount: 18,
          villageCount: 246,
          reportingUnitCount: 9,
          approvedRecordCount: 31,
          latestUpdatedAt: "2026-08-03T09:45:00+08:00",
        },
        metrics: [
          {
            code: "PRODUCTION_CULTIVATED_AREA",
            name: "粮食播种面积",
            unitCode: "亩",
            value: "120000",
            sourceCount: 4,
          },
          {
            code: "PRODUCTION_ESTIMATED_OUTPUT",
            name: "粮食产量",
            unitCode: "公斤",
            value: "7654321",
            sourceCount: 4,
          },
          {
            code: "MARKET_AVERAGE_TRADE_PRICE",
            name: "平均成交价",
            unitCode: "元/吨",
            value: "2350",
            sourceCount: 3,
          },
        ],
        regionPath: [
          { code: "230200", label: "齐齐哈尔市" },
          { code: "230281", label: "讷河市" },
        ],
        priceTrend: [
          { periodLabel: "2026-07", value: "2310", sourceCount: 2 },
          { periodLabel: "2026-08", value: "2350", sourceCount: 1 },
        ],
        productStructure: [
          {
            productCode: "CORN",
            productName: "玉米",
            value: "7654321",
            unitCode: "公斤",
            sourceCount: 4,
          },
        ],
        regionActivity: [
          {
            regionCode: "230281",
            regionName: "讷河市",
            approvedCount: 8,
            totalCount: 10,
          },
        ],
        alerts: [
          {
            code: "RETURNED_RECORD",
            severity: "WARNING",
            regionName: "讷河市",
            message: "2条填报记录退回补充",
            occurredOn: "2026-08-03",
          },
        ],
        cultivatedAreaYoY: [
          {
            regionCode: "230281",
            regionName: "讷河市",
            currentValue: "120",
            previousValue: "110",
            unitCode: "亩",
            currentSourceCount: 2,
            previousSourceCount: 2,
          },
        ],
        outputYoY: [
          {
            regionCode: "230281",
            regionName: "讷河市",
            currentValue: "620",
            previousValue: "580",
            unitCode: "公斤",
            currentSourceCount: 2,
            previousSourceCount: 2,
          },
        ],
      }),
    );
    render(
      <OverviewPage
        repository={
          {
            mapScope: () => Promise.resolve(sampleMapScope),
            options: () => Promise.resolve(options),
            regions: () => Promise.resolve([sampleRegion]),
            locations: () => Promise.resolve([]),
            indicators: () => Promise.resolve([sampleIndicator]),
            dashboard,
          } as unknown as OverviewRepository
        }
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "齐齐哈尔粮食商情企业平台 / 总揽监测",
      }),
    ).toBeVisible();
    expect(await screen.findByText(/246个行政村/)).toBeVisible();
    expect(screen.getByText("120,000")).toBeVisible();
    expect(screen.getByText("2,350")).toBeVisible();
    expect(screen.queryByText("2,332")).not.toBeInTheDocument();
    expect(screen.queryByText("粮食商品量")).not.toBeInTheDocument();
    expect(screen.queryByText("品种A")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "各地区播种面积同比" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "各地区总产量同比" })).toBeVisible();
    await waitFor(() =>
      expect(dashboard).toHaveBeenCalledWith(
        expect.objectContaining({ productCode: "CORN", periodCode: "2026-Q3" }),
      ),
    );
  });

  it("removes the retired map toolbar while preserving the legend and region selector", async () => {
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    expect(await screen.findByRole("heading", { name: "图例" })).toBeVisible();
    expect(screen.getByText("选择地区")).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "三维地图控制" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "地图归位" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "放大地图" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "缩小地图" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复位地图" })).not.toBeInTheDocument();
  });

  it("keeps the map full-screen and opens only the sample-point drawer after a map click", async () => {
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([sampleIndicator]),
          dashboard: () =>
            Promise.resolve({
              ...emptyDashboard,
              scope: { ...emptyDashboard.scope, villageCount: 37 },
            }),
        }}
      />,
    );

    expect(await screen.findByRole("img", { name: "行政区边界地图" })).toBeVisible();
    expect(screen.getAllByText("暂无审核数据").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("complementary", { name: "所选地区样本点详情" }),
    ).not.toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "齐齐哈尔市，已核定 1 条" }));

    const drawer = await screen.findByRole("complementary", {
      name: "所选地区样本点详情",
    });
    expect(
      within(drawer).getByRole("heading", { name: "所选地区样本点详情" }),
    ).toBeVisible();
    expect(within(drawer).getByRole("heading", { name: "样本点分类" })).toBeVisible();
    expect(within(drawer).getByRole("heading", { name: "样本点列表" })).toBeVisible();
    expect(
      within(drawer).getByRole("heading", { name: "样本点业务信息" }),
    ).toBeVisible();
    expect(within(drawer).getByRole("link", { name: "查看样本点台账" })).toBeVisible();
    expect(
      within(drawer).getByRole("button", { name: "进入样本点监测" }),
    ).toBeVisible();
    expect(within(drawer).queryByText("区域层级数据")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("样本点数量")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("供需平衡")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "关闭地区详情" }));
    expect(
      screen.queryByRole("complementary", { name: "所选地区样本点详情" }),
    ).not.toBeInTheDocument();
  });

  it("shows unavailable sample-point state without inventing a zero aggregate", async () => {
    const samplePointRepository: OverviewSamplePointRepository = {
      aggregates: () => Promise.reject(new Error("formal aggregate unavailable")),
      list: () => Promise.reject(new Error("formal list unavailable")),
      icons: () => Promise.reject(new Error("formal icons unavailable")),
      detail: () => Promise.reject(new Error("formal detail unavailable")),
    };
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
        samplePointRepository={samplePointRepository}
      />,
    );

    const regionButton = await screen.findByRole("button", {
      name: "齐齐哈尔市，样本点聚合数据不可用",
    });
    await userEvent.setup().click(regionButton);

    expect(
      await screen.findByRole("complementary", { name: "所选地区样本点详情" }),
    ).toBeVisible();
    expect(await screen.findByText("样本点数据不可用")).toBeVisible();
    expect(
      await screen.findByText("样本点行政统计加载失败，请稍后重试。"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /齐齐哈尔市，已核定 0/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /齐齐哈尔市，样本点聚合数据不可用/ }),
    ).toBeVisible();
    expect(
      screen.queryByText("0", { selector: ".overview-sample-point-aggregate-marker" }),
    ).not.toBeInTheDocument();
  });

  it("does not load or render the retired region hierarchy inside the drawer", async () => {
    const locations = vi.fn<OverviewRepository["locations"]>(() => Promise.resolve([]));
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations,
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }));

    expect(
      await screen.findByRole("complementary", { name: "所选地区样本点详情" }),
    ).toBeVisible();
    expect(screen.queryByText("区域层级数据")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("搜索区县名称")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("搜索乡镇名称")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("搜索行政村名称")).not.toBeInTheDocument();
    expect(locations).not.toHaveBeenCalled();
  });

  it("keeps the geographic view primary and loads approved indicators for the selected region", async () => {
    const regions = vi.fn<OverviewRepository["regions"]>(() =>
      Promise.resolve([sampleRegion]),
    );
    const indicators = vi.fn<OverviewRepository["indicators"]>(() =>
      Promise.resolve([sampleIndicator]),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions,
          locations: () => Promise.resolve([]),
          indicators,
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );
    expect(await screen.findByRole("heading", { name: "粮食商情总览" })).toBeVisible();
    expect(await screen.findByRole("img", { name: "行政区边界地图" })).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "齐齐哈尔市，已核定 1 条" }));
    await waitFor(() =>
      expect(indicators).toHaveBeenCalledWith(
        expect.objectContaining({ regionCode: "230200" }),
      ),
    );
    expect(screen.getByRole("heading", { name: "样本点分类" })).toBeVisible();
    expect(screen.queryByText("核定播种面积")).not.toBeInTheDocument();
    await userEvent.setup().type(screen.getByLabelText("市场年度"), "2026/27");
    await waitFor(() =>
      expect(indicators).toHaveBeenLastCalledWith(
        expect.objectContaining({ marketingYear: "2026/27" }),
      ),
    );
  });

  it("keeps verified boundary geometry visible while formal periods are not configured", async () => {
    const regions = vi.fn<OverviewRepository["regions"]>(() =>
      Promise.resolve([sampleRegion]),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve({ products: options.products, periods: [] }),
          regions,
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );
    expect(await screen.findByRole("img", { name: "行政区边界地图" })).toBeVisible();
    expect(
      screen.getByText("尚未配置正式业务期间", { exact: false }),
    ).toBeInTheDocument();
    await waitFor(() => expect(regions).toHaveBeenCalledWith({ productCode: "CORN" }));
  });

  it("keeps Qiqihar, Heihe, and Hulunbuir available in the formal region selector", async () => {
    const qiqihar = sampleRegion;
    const heihe = { ...sampleRegion, code: "231100", name: "黑河市" };
    const hulunbuir = { ...sampleRegion, code: "150700", name: "呼伦贝尔市" };
    const qiqiharCounty = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) =>
      Promise.resolve(
        query.parentCode === "230200" ? [qiqiharCounty] : [qiqihar, heihe, hulunbuir],
      ),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions,
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    expect(await screen.findByRole("option", { name: "总体" })).toBeVisible();
    expect(screen.getByLabelText("区域范围")).toHaveValue("__OVERALL__");
    expect(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "黑河市，已核定 1 条" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "呼伦贝尔市，已核定 1 条" }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: "齐齐哈尔市" })).toBeVisible();
    expect(screen.getByRole("option", { name: "黑河市" })).toBeVisible();
    expect(screen.getByRole("option", { name: "呼伦贝尔市" })).toBeVisible();

    await userEvent.setup().selectOptions(screen.getByLabelText("区域范围"), "230200");
    expect(
      await screen.findByRole("button", { name: "拜泉县，已核定 1 条" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(regions).toHaveBeenCalledWith(
        expect.objectContaining({ parentCode: "230200" }),
      ),
    );
  });

  it("loads only the immediate administrative level for each presentation view", async () => {
    const locations = vi.fn<OverviewRepository["locations"]>(() => Promise.resolve([]));
    const county = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) =>
      Promise.resolve(query.parentCode === "230200" ? [county] : [sampleRegion]),
    );

    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions,
          locations,
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    ).toBeVisible();
    expect(locations).not.toHaveBeenCalled();

    fireEvent.doubleClick(
      screen.getByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    );
    expect(
      await screen.findByRole("button", { name: "拜泉县，已核定 1 条" }),
    ).toBeVisible();
    expect(locations).not.toHaveBeenCalled();

    fireEvent.doubleClick(screen.getByRole("button", { name: "拜泉县，已核定 1 条" }));
    await waitFor(() =>
      expect(regions).toHaveBeenCalledWith(
        expect.objectContaining({ parentCode: "230231" }),
      ),
    );
    expect(locations).not.toHaveBeenCalled();
  });

  it("renders source-attributed point locations without inventing township boundaries", async () => {
    const townshipPoint = {
      code: "230281999",
      name: "测试乡",
      parentCode: "230200",
      level: "TOWNSHIP" as const,
      approvedRecordCount: 0,
      locationGeoJson: JSON.stringify({ type: "Point", coordinates: [124.88, 48.48] }),
      locationReviewStatus: "DERIVED_FROM_VILLAGE_POINTS",
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) =>
      Promise.resolve(query.parentCode === "230200" ? [townshipPoint] : [sampleRegion]),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions,
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    );

    expect(
      await screen.findByRole("button", { name: "测试乡，位置由村点推导" }),
    ).toBeVisible();
    expect(
      screen.queryByText("当前范围尚无可显示的经核验行政区边界"),
    ).not.toBeInTheDocument();
  });

  it("loads immediate township records from the governed region endpoint", async () => {
    const county = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const governedPoint = {
      code: "230231100",
      name: "兴农镇",
      parentCode: "230231",
      level: "TOWNSHIP" as const,
      approvedRecordCount: 0,
      locationGeoJson: JSON.stringify({ type: "Point", coordinates: [126.08, 47.61] }),
      locationReviewStatus: "AUTO_MATCHED_PENDING_SPATIAL_QA",
    };
    const locations = vi.fn<OverviewRepository["locations"]>(() => Promise.resolve([]));
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: (query) => {
            if (!query.parentCode) return Promise.resolve([sampleRegion]);
            if (query.parentCode === "230200") return Promise.resolve([county]);
            return Promise.resolve([governedPoint]);
          },
          locations,
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    );
    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "拜泉县，已核定 1 条" }),
    );

    expect(
      await screen.findByRole("button", { name: "兴农镇，来源点位待空间校核" }),
    ).toBeVisible();
    expect(locations).not.toHaveBeenCalled();
  });

  it("drills through township into generated village boundary geometry", async () => {
    const county = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const township = {
      code: "230231100",
      name: "兴农镇",
      parentCode: "230231",
      level: "TOWNSHIP" as const,
      approvedRecordCount: 0,
      boundaryGeoJson: sampleRegion.boundaryGeoJson,
      locationGeoJson: JSON.stringify({ type: "Point", coordinates: [126.08, 47.61] }),
      locationReviewStatus: "DERIVED_FROM_VILLAGE_POINTS",
    };
    const village = {
      code: "230231100201",
      name: "众兴村",
      parentCode: "230231100",
      level: "VILLAGE" as const,
      approvedRecordCount: 0,
      boundaryGeoJson: sampleRegion.boundaryGeoJson,
      locationGeoJson: JSON.stringify({ type: "Point", coordinates: [126.1, 47.62] }),
      locationReviewStatus: "AUTO_MATCHED_PENDING_SPATIAL_QA",
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) => {
      if (!query.parentCode) return Promise.resolve([sampleRegion]);
      if (query.parentCode === "230200") return Promise.resolve([county]);
      if (query.parentCode === "230231") return Promise.resolve([township]);
      if (query.parentCode === "230231100") return Promise.resolve([village]);
      return Promise.resolve([]);
    });
    const locations = vi.fn<OverviewRepository["locations"]>(() => Promise.resolve([]));
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions,
          locations,
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    );

    const countyButton = await screen.findByRole("button", {
      name: "拜泉县，已核定 1 条",
    });
    fireEvent.doubleClick(countyButton);
    const townshipButton = await screen.findByRole("button", {
      name: "兴农镇，已核定 0 条",
    });
    fireEvent.doubleClick(townshipButton);
    await waitFor(() =>
      expect(regions).toHaveBeenCalledWith(
        expect.objectContaining({ parentCode: "230231100" }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "众兴村，已核定 0 条" }),
    ).toBeVisible();
    expect(locations).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole("button", { name: "返回上级" }));
    expect(
      await screen.findByRole("button", { name: "兴农镇，已核定 0 条" }),
    ).toBeVisible();

    await userEvent.setup().click(screen.getByRole("button", { name: "返回上级" }));
    expect(
      await screen.findByRole("button", { name: "拜泉县，已核定 1 条" }),
    ).toBeVisible();
  });

  it("automatically upgrades the real-feature fallback after map scope recovers", async () => {
    const mapScope = vi
      .fn<OverviewRepository["mapScope"]>()
      .mockRejectedValueOnce(new Error("temporary map-scope outage"))
      .mockResolvedValue(sampleMapScope);

    render(
      <OverviewPage
        repository={{
          mapScope,
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    expect(
      await screen.findByText("总体贴地底座正在恢复，现有真实行政区地图仍可正常使用。"),
    ).toBeVisible();
    await waitFor(() => expect(mapScope).toHaveBeenCalledTimes(2), { timeout: 1_500 });
    await waitFor(() =>
      expect(
        screen.queryByText("总体贴地底座正在恢复，现有真实行政区地图仍可正常使用。"),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps non-monitoring context fragments out of every interactive map level", async () => {
    const governedTownship = {
      ...sampleRegion,
      code: "230281103",
      name: "学田镇",
      level: "TOWNSHIP" as const,
      parentCode: "230281",
      approvedRecordCount: 0,
    };
    const contextFragment = {
      ...governedTownship,
      code: "context-xuetian-forest",
      name: "学田镇富源林场",
      mapContextOnly: true,
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) =>
      Promise.resolve(
        query.parentCode ? [governedTownship, contextFragment] : [sampleRegion],
      ),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions,
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    );

    expect(
      await screen.findByRole("button", { name: "学田镇，已核定 0 条" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "学田镇富源林场，已核定 0 条" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the real-region map available after all map scope retries fail", async () => {
    vi.useFakeTimers();
    const mapScope = vi
      .fn<OverviewRepository["mapScope"]>()
      .mockRejectedValue(new Error("map-scope unavailable"));
    try {
      render(
        <OverviewPage
          repository={{
            mapScope,
            options: () => Promise.resolve(options),
            regions: () => Promise.resolve([sampleRegion]),
            locations: () => Promise.resolve([]),
            indicators: () => Promise.resolve([]),
            dashboard: () => Promise.resolve(emptyDashboard),
          }}
        />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_600);
      });

      expect(mapScope).toHaveBeenCalledTimes(4);
      expect(
        screen.getByText(
          "总体贴地底座暂未加载，已使用真实行政区外壁保障地图完整显示。",
        ),
      ).toBeVisible();
      expect(screen.getByRole("img", { name: "行政区边界地图" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});

const options = {
  products: [{ code: "CORN", label: "玉米" }],
  periods: [
    {
      code: "2026-Q3",
      label: "2026年第三季度",
      startsOn: "2026-07-01",
      endsOn: "2026-09-30",
    },
  ],
} as const;
const emptyDashboard = {
  scope: {
    countyCount: 0,
    townshipCount: 0,
    villageCount: 0,
    reportingUnitCount: 0,
    approvedRecordCount: 0,
  },
  metrics: [],
  regionPath: [],
  priceTrend: [],
  productStructure: [],
  regionActivity: [],
  alerts: [],
  cultivatedAreaYoY: [],
  outputYoY: [],
} as const;
const sampleRegion = {
  code: "230200",
  name: "齐齐哈尔市",
  level: "PREFECTURE" as const,
  approvedRecordCount: 1,
  boundaryGeoJson: JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 47],
      ],
    ],
  }),
};
const sampleIndicator = {
  code: "PRODUCTION_CULTIVATED_AREA",
  name: "核定播种面积",
  unitCode: "亩",
  value: "10",
  sourceDomain: "PRODUCTION" as const,
  sourceCount: 1,
  sourcePath: "/api/v1/production-records",
};
const sampleMapScope = {
  scopeCode: "FORMAL_BUSINESS",
  name: "齐齐哈尔、黑河、呼伦贝尔正式业务范围",
  boundaryGeoJson: sampleRegion.boundaryGeoJson,
  sourceName: "platform.region",
  sourceRevision: "test-revision",
  sourceLicense: "INTERNAL_FORMAL_REGION_SOURCE",
  componentGeometryFingerprint: "test-fingerprint",
  refreshedAt: "2026-08-04T12:00:00+08:00",
};
