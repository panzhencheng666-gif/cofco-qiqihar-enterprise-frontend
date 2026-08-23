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
import type {
  OverviewRealtimeCallbacks,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";
import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewRegion } from "../../domain/overview";
import { OverviewPage } from "./OverviewPage";
import { HttpContractError, HttpError } from "../../../../shared/api/HttpClient";

describe("OverviewPage", () => {
  it("leaves perpetual loading and allows retry when the options request stalls", async () => {
    vi.useFakeTimers();
    const optionsRequest = vi
      .fn<OverviewRepository["options"]>()
      .mockImplementationOnce(() => new Promise<never>(() => undefined))
      .mockResolvedValueOnce(options);
    try {
      render(
        <OverviewPage
          repository={{
            mapScope: () => Promise.resolve(sampleMapScope),
            options: optionsRequest,
            regions: () => Promise.resolve([sampleRegion]),
            locations: () => Promise.resolve([]),
            indicators: () => Promise.resolve([]),
            dashboard: () => Promise.resolve(emptyDashboard),
          }}
        />,
      );

      expect(screen.getByText("正在读取粮食商情业务数据")).toBeVisible();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(screen.getByText("总览筛选条件加载失败，请稍后重试。")).toHaveAttribute(
        "role",
        "alert",
      );
      expect(screen.queryByText("正在读取粮食商情业务数据")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
        await Promise.resolve();
      });

      expect(optionsRequest).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("combobox", { name: "产品" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders an explicit failure instead of perpetual loading when options fail", async () => {
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.reject(new Error("options unavailable")),
          regions: () => Promise.resolve([]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    expect(
      await screen.findByText("总览筛选条件加载失败，请稍后重试。"),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText("正在读取粮食商情业务数据")).not.toBeInTheDocument();
  });

  it("identifies an indicator contract mismatch with its trace instead of suggesting a retry", async () => {
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () =>
            Promise.reject(
              new HttpContractError({
                endpoint: "/api/v1/overview/indicators",
                expectedContractVersion: "overview-audit-v2",
                receivedContractVersion: null,
                traceId: "trace-def-101",
              }),
            ),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }));

    expect(
      await screen.findByText(
        "指标数据契约版本不匹配，当前验收后端可能仍为旧版本。追踪号：trace-def-101。请停止验收并同步重启后端服务。",
      ),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/核定指标加载失败，请稍后重试/)).not.toBeInTheDocument();
  });

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
            auditSources: [],
            calculationVersion: "OVERVIEW_METRIC_V1",
            code: "PRODUCTION_CULTIVATED_AREA",
            coverageScope: "region=230200;product=CORN;year=2026",
            coverageStatus: "AVAILABLE",
            dataCutoff: "2026-08-11T00:00:00Z",
            formula: "SUM(cultivated_area_mu)",
            name: "粮食播种面积",
            sourcePath: "/api/v1/production-records",
            sourceRelation: "production.production_record",
            unitCode: "亩",
            value: "120000",
            sourceCount: 4,
          },
          {
            auditSources: [],
            calculationVersion: "OVERVIEW_METRIC_V1",
            code: "PRODUCTION_ESTIMATED_OUTPUT",
            coverageScope: "region=230200;product=CORN;year=2026",
            coverageStatus: "AVAILABLE",
            dataCutoff: "2026-08-11T00:00:00Z",
            formula: "SUM(estimated_output_kg)",
            name: "粮食产量",
            sourcePath: "/api/v1/production-records",
            sourceRelation: "production.production_record",
            unitCode: "公斤",
            value: "7654321",
            sourceCount: 4,
          },
          {
            auditSources: [],
            calculationVersion: "OVERVIEW_METRIC_V1",
            code: "MARKET_AVERAGE_PURCHASE_PRICE",
            coverageScope: "region=230200;product=CORN;year=2026",
            coverageStatus: "AVAILABLE",
            dataCutoff: "2026-08-11T00:00:00Z",
            formula: "AVG(purchase_base_price)",
            name: "平均收购价",
            sourcePath: "/api/v1/market-records",
            sourceRelation: "market.market_record",
            unitCode: "元/吨",
            value: "2350",
            sourceCount: 3,
          },
          {
            auditSources: [],
            calculationVersion: "OVERVIEW_METRIC_V1",
            code: "MARKET_AVERAGE_SALE_PRICE",
            coverageScope: "region=230200;product=CORN;year=2026",
            coverageStatus: "AVAILABLE",
            dataCutoff: "2026-08-11T00:00:00Z",
            formula: "AVG(sale_base_price)",
            name: "平均销售价",
            sourcePath: "/api/v1/market-records",
            sourceRelation: "market.market_record",
            unitCode: "元/吨",
            value: "2450",
            sourceCount: 3,
          },
        ],
        businessTables: [
          {
            code: "PRODUCTION",
            title: "产情监测表",
            coverageStatus: "AVAILABLE",
            columns: [{ code: "PROD_AREA_MU", label: "种植面积", unitCode: "亩" }],
            rows: [
              {
                regionCode: "230281",
                regionName: "讷河市",
                sourceCount: 4,
                latestApprovedAt: "2026年08月11日 08:00:00",
                completenessStatus: "COMPLETE",
                values: { PROD_AREA_MU: { value: "120000", sourceCount: 4 } },
              },
            ],
          },
          {
            code: "MARKET",
            title: "市场监测表",
            coverageStatus: "NO_APPROVED_SOURCES",
            columns: [],
            rows: [],
          },
          {
            code: "LOGISTICS",
            title: "物流监测表",
            coverageStatus: "NO_APPROVED_SOURCES",
            columns: [],
            rows: [],
          },
          {
            code: "SUPPLY",
            title: "供需平衡表",
            coverageStatus: "NO_APPROVED_SOURCES",
            columns: [],
            rows: [],
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
    expect(screen.getByText("2,450")).toBeVisible();
    expect(screen.queryByText("2,332")).not.toBeInTheDocument();
    expect(screen.queryByText("粮食商品量")).not.toBeInTheDocument();
    expect(screen.queryByText("品种A")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "业务目录联动数据表" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "产情监测表" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "市场监测表" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "物流监测表" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "供需平衡表" })).not.toBeInTheDocument();
    expect(screen.queryByText("近12月价格趋势")).not.toBeInTheDocument();
    expect(screen.queryByText("各地区播种面积同比")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(dashboard).toHaveBeenCalledWith(
        expect.objectContaining({ productCode: "CORN", year: 2026 }),
      ),
    );
  });

  it("clears the prior year instead of displaying stale values when the selected year fails", async () => {
    const dashboard = vi.fn<OverviewRepository["dashboard"]>(({ year }) =>
      year === 2026
        ? Promise.resolve({
            ...emptyDashboard,
            metrics: [
              {
                auditSources: [],
                calculationVersion: "OVERVIEW_METRIC_V1",
                code: "PRODUCTION_CULTIVATED_AREA",
                coverageScope: "region=230200;product=CORN;year=2026",
                coverageStatus: "AVAILABLE",
                dataCutoff: "2026-08-11T00:00:00Z",
                formula: "SUM(cultivated_area_mu)",
                name: "粮食播种面积",
                sourcePath: "/api/v1/production-records",
                sourceRelation: "production.production_record",
                sourceCount: 1,
                unitCode: "亩",
                value: "120",
              },
            ],
          })
        : Promise.reject(new Error("annual dashboard unavailable")),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: () => Promise.resolve([sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard,
        }}
      />,
    );

    expect(await screen.findByText("120")).toBeVisible();
    await userEvent.setup().selectOptions(screen.getByLabelText("年度"), "2025");

    expect(
      await screen.findByText("总揽业务聚合数据加载失败，请稍后重试。"),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText("120")).not.toBeInTheDocument();
    expect(screen.getAllByText("暂无审核数据").length).toBeGreaterThan(0);
  });

  it("distinguishes region authorization failures from invalid filters and empty data", async () => {
    const baseRepository = {
      mapScope: () => Promise.resolve(sampleMapScope),
      options: () => Promise.resolve(options),
      regions: () => Promise.resolve([sampleRegion]),
      locations: () => Promise.resolve([]),
      indicators: () => Promise.resolve([]),
    };
    const denied = render(
      <OverviewPage
        repository={{
          ...baseRepository,
          dashboard: () => Promise.reject(new HttpError(403, "denied")),
        }}
      />,
    );

    expect(
      await screen.findByText(
        "当前账号无权查看该地区的核定业务数据，请返回已授权地区或联系权限管理员。",
      ),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/检查筛选条件/u)).not.toBeInTheDocument();
    denied.unmount();

    const invalid = render(
      <OverviewPage
        repository={{
          ...baseRepository,
          dashboard: () => Promise.reject(new HttpError(400, "invalid")),
        }}
      />,
    );
    expect(
      await screen.findByText("当前总揽筛选条件无效，请重新选择地区、产品和年度。"),
    ).toHaveAttribute("role", "alert");
    invalid.unmount();

    render(
      <OverviewPage
        repository={{
          ...baseRepository,
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
      />,
    );
    expect((await screen.findAllByText("暂无审核数据")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/无权查看|筛选条件无效/u)).not.toBeInTheDocument();
  });

  it("does not retain prior-year region counts or hide a region failure behind dashboard success", async () => {
    const regions = vi.fn<OverviewRepository["regions"]>(({ year }) =>
      year === 2026
        ? Promise.resolve([sampleRegion])
        : Promise.reject(new Error("annual regions unavailable")),
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

    expect(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    ).toBeVisible();
    await userEvent.setup().selectOptions(screen.getByLabelText("年度"), "2025");

    expect(
      await screen.findByText("总览正式地区范围加载失败，请重试。"),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.queryByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("总览正式地区范围加载失败，请重试。")).toBeVisible(),
    );
  });

  it("marks annual region counts stale while a matching realtime refresh fails", async () => {
    let realtimeCallbacks: OverviewRealtimeCallbacks | undefined;
    const realtimeStream: OverviewRealtimeStream = {
      subscribe: (callbacks) => {
        realtimeCallbacks = callbacks;
        return () => undefined;
      },
    };
    const regions = vi
      .fn<OverviewRepository["regions"]>()
      .mockResolvedValueOnce([sampleRegion])
      .mockRejectedValueOnce(new Error("realtime annual regions unavailable"));
    render(
      <OverviewPage
        realtimeStream={realtimeStream}
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

    expect(
      await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    ).toBeVisible();
    act(() =>
      realtimeCallbacks?.onBusinessChange({
        productCode: "CORN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      }),
    );

    expect(
      await screen.findByText("总览正式地区范围加载失败，请重试。"),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByRole("button", { name: "齐齐哈尔市，年度业务统计加载中" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "齐齐哈尔市，已核定 1 条" }),
    ).not.toBeInTheDocument();
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
      .click(await screen.findByRole("button", { name: "齐齐哈尔市，已核定 1 条" }));

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
      comparison: () => Promise.reject(new Error("formal comparison unavailable")),
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

  it("loads the prefecture sample-point drawer without requesting concrete icons", async () => {
    const list = vi.fn<OverviewSamplePointRepository["list"]>(() =>
      Promise.resolve(samplePointList),
    );
    const icons = vi.fn<OverviewSamplePointRepository["icons"]>(() =>
      Promise.resolve(samplePointIcons),
    );
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
        samplePointRepository={{
          aggregates: () =>
            Promise.resolve([
              {
                regionCode: sampleRegion.code,
                regionName: sampleRegion.name,
                regionLevel: "PREFECTURE",
                samplePointCount: 1,
                productionCount: 1,
                marketCount: 0,
                validCoordinateCount: 1,
                dataQualityIssueCount: 0,
                correctionSourceCount: 0,
                unresolvedSourceCount: 0,
              },
            ]),
          comparison: () => Promise.resolve(emptySampleNetworkComparison),
          list,
          icons,
          detail: () => Promise.resolve(samplePointDetail),
        }}
      />,
    );

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "齐齐哈尔市，已核定 1 个样本点，其中生产类 1 个、市场类 0 个",
      }),
    );

    expect(await screen.findByRole("button", { name: "产情类 1" })).toBeVisible();
    expect(screen.queryByText("样本点数据不可用")).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({
      productCode: "CORN",
      regionCode: "230200",
      year: 2026,
    });

    await userEvent.click(screen.getByRole("button", { name: "产情类 1" }));
    expect(await screen.findByText("同一跨产品样本点")).toBeVisible();
    expect(icons).not.toHaveBeenCalled();
  });

  it("shows aggregates only for prefectures and counties across all five map levels", async () => {
    const county = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const township = {
      ...sampleRegion,
      code: "230231100",
      name: "兴农镇",
      level: "TOWNSHIP" as const,
      parentCode: "230231",
    };
    const village = {
      ...sampleRegion,
      code: "230231100201",
      name: "众兴村",
      level: "VILLAGE" as const,
      parentCode: "230231100",
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) => {
      if (!query.parentCode) return Promise.resolve([sampleRegion]);
      if (query.parentCode === "230200") return Promise.resolve([county]);
      if (query.parentCode === "230231") return Promise.resolve([township]);
      if (query.parentCode === "230231100") return Promise.resolve([village]);
      return Promise.resolve([]);
    });
    const aggregates = vi.fn<OverviewSamplePointRepository["aggregates"]>((query) => {
      if (!query.parentCode) {
        return Promise.resolve([
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
        ]);
      }
      const child =
        query.parentCode === "230200"
          ? { region: county, count: 3 }
          : query.parentCode === "230231"
            ? { region: township, count: 2 }
            : { region: village, count: 1 };
      return Promise.resolve([
        {
          regionCode: child.region.code,
          regionName: child.region.name,
          regionLevel: child.region.level,
          samplePointCount: child.count,
          productionCount: child.count,
          marketCount: 0,
          validCoordinateCount: child.count,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
        },
      ]);
    });

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
        samplePointRepository={{
          aggregates,
          comparison: () => Promise.resolve(emptySampleNetworkComparison),
          list: () => Promise.resolve(samplePointList),
          icons: () => Promise.resolve([]),
          detail: () => Promise.reject(new Error("not selected")),
        }}
      />,
    );

    fireEvent.doubleClick(
      await screen.findByRole("button", {
        name: "齐齐哈尔市，已核定 4 个样本点，其中生产类 3 个、市场类 1 个",
      }),
    );
    fireEvent.doubleClick(
      await screen.findByRole("button", {
        name: "拜泉县，已核定 3 个样本点，其中生产类 3 个、市场类 0 个",
      }),
    );
    const mapRegion = screen.getByLabelText("粮食商情总览地图");
    fireEvent.doubleClick(
      await within(mapRegion).findByRole("button", { name: "兴农镇" }),
    );
    expect(
      await within(mapRegion).findByRole("button", { name: "众兴村" }),
    ).toBeVisible();
    expect(aggregates).toHaveBeenCalledTimes(2);
    expect(aggregates).toHaveBeenNthCalledWith(1, {
      productCode: "CORN",
      year: 2026,
    });
    expect(aggregates).toHaveBeenNthCalledWith(2, {
      parentCode: "230200",
      productCode: "CORN",
      year: 2026,
    });
    expect(
      screen.queryByText("1", { selector: ".overview-sample-point-aggregate-marker" }),
    ).not.toBeInTheDocument();
  });

  it("keeps county maps aggregate-only while list selection remains inspectable", async () => {
    const county = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const detail = vi.fn<OverviewSamplePointRepository["detail"]>(() =>
      Promise.resolve(samplePointDetail),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () => Promise.resolve(options),
          regions: (query) =>
            Promise.resolve(query.parentCode === "230200" ? [county] : [sampleRegion]),
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
        samplePointRepository={{
          aggregates: (query) =>
            Promise.resolve([
              {
                regionCode: query.parentCode ? county.code : sampleRegion.code,
                regionName: query.parentCode ? county.name : sampleRegion.name,
                regionLevel: query.parentCode ? "COUNTY" : "PREFECTURE",
                samplePointCount: 1,
                productionCount: 1,
                marketCount: 0,
                validCoordinateCount: 1,
                dataQualityIssueCount: 0,
                correctionSourceCount: 0,
                unresolvedSourceCount: 0,
              },
            ]),
          comparison: () => Promise.resolve(emptySampleNetworkComparison),
          list: () => Promise.resolve(samplePointList),
          icons: () => Promise.resolve(samplePointIcons),
          detail,
        }}
      />,
    );

    await screen.findByRole("option", { name: "齐齐哈尔市" });
    await userEvent.setup().selectOptions(screen.getByLabelText("区域范围"), "230200");
    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "拜泉县，已核定 1 个样本点，其中生产类 1 个、市场类 0 个",
      }),
    );
    expect(
      await within(screen.getByLabelText("粮食商情总览地图")).findByRole("button", {
        name: "拜泉县",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("1", { selector: ".overview-sample-point-aggregate-marker" }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "产情类 1" }));

    expect(
      screen.queryByRole("button", {
        name: "同一跨产品样本点，农户，点击查看样本点详情",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByLabelText("样本点列表")).getByRole("button", {
        name: /同一跨产品样本点/,
      }),
    );
    await waitFor(() =>
      expect(detail).toHaveBeenCalledWith({
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        regionCode: "230231",
        samplePointId: "94000000-0000-0000-0000-000000000001",
        year: 2026,
      }),
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "关闭地区详情" }));
    expect(
      screen.queryByRole("button", {
        name: "同一跨产品样本点，农户，点击查看样本点详情",
      }),
    ).not.toBeInTheDocument();

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "拜泉县，已核定 1 个样本点，其中生产类 1 个、市场类 0 个",
      }),
    );
    expect(screen.getByText("请选择分类后查看 1 个样本点")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "同一跨产品样本点，农户，点击查看样本点详情",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps the drawer open but resets and reloads sample data for the new product", async () => {
    const county = {
      ...sampleRegion,
      code: "230231",
      name: "拜泉县",
      level: "COUNTY" as const,
      parentCode: "230200",
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) => {
      if (query.productCode === "SOYBEAN") {
        return new Promise<readonly OverviewRegion[]>(() => undefined);
      }
      return Promise.resolve(query.parentCode === "230200" ? [county] : [sampleRegion]);
    });
    const list = vi.fn<OverviewSamplePointRepository["list"]>(() =>
      Promise.resolve(samplePointList),
    );
    const icons = vi.fn<OverviewSamplePointRepository["icons"]>(() =>
      Promise.resolve(samplePointIcons),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () =>
            Promise.resolve({
              ...options,
              products: [...options.products, { code: "SOYBEAN", label: "大豆" }],
            }),
          regions,
          locations: () => Promise.resolve([]),
          indicators: () => Promise.resolve([]),
          dashboard: () => Promise.resolve(emptyDashboard),
        }}
        samplePointRepository={{
          aggregates: (query) =>
            Promise.resolve([
              {
                regionCode: query.parentCode ? county.code : sampleRegion.code,
                regionName: query.parentCode ? county.name : sampleRegion.name,
                regionLevel: query.parentCode ? "COUNTY" : "PREFECTURE",
                samplePointCount: 1,
                productionCount: 1,
                marketCount: 0,
                validCoordinateCount: 1,
                dataQualityIssueCount: 0,
                correctionSourceCount: 0,
                unresolvedSourceCount: 0,
              },
            ]),
          comparison: () => Promise.resolve(emptySampleNetworkComparison),
          list,
          icons,
          detail: () => Promise.resolve(samplePointDetail),
        }}
      />,
    );

    await screen.findByRole("option", { name: "齐齐哈尔市" });
    await userEvent.setup().selectOptions(screen.getByLabelText("区域范围"), "230200");
    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "拜泉县，已核定 1 个样本点，其中生产类 1 个、市场类 0 个",
      }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.type(screen.getByLabelText("搜索样本点"), "跨产品");
    expect(
      within(screen.getByLabelText("样本点列表")).getByRole("button", {
        name: /同一跨产品样本点/,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "同一跨产品样本点，农户，点击查看样本点详情",
      }),
    ).not.toBeInTheDocument();
    const listCalls = list.mock.calls.length;
    const iconCalls = icons.mock.calls.length;

    await userEvent.setup().selectOptions(screen.getByLabelText("产品"), "SOYBEAN");

    expect(
      screen.getByRole("complementary", { name: "所选地区样本点详情" }),
    ).toBeVisible();
    expect(screen.getByLabelText("搜索样本点")).toHaveValue("");
    expect(screen.getByText("请选择分类后查看 1 个样本点")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "同一跨产品样本点，农户，点击查看样本点详情",
      }),
    ).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(listCalls + 1);
    expect(list).toHaveBeenLastCalledWith({
      productCode: "SOYBEAN",
      regionCode: "230231",
      year: 2026,
    });
    expect(icons).toHaveBeenCalledTimes(iconCalls);
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
    await userEvent.setup().selectOptions(screen.getByLabelText("年度"), "2025");
    await waitFor(() =>
      expect(indicators).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: 2025 }),
      ),
    );
  });

  it("loads reference administrative regions without requesting business data when approved years are unavailable", async () => {
    const prefecture = { ...sampleRegion, approvedRecordCount: 0 };
    const county = {
      ...sampleRegion,
      approvedRecordCount: 0,
      code: "230208",
      level: "COUNTY" as const,
      name: "梅里斯达斡尔族区",
      parentCode: prefecture.code,
    };
    const township = {
      ...sampleRegion,
      approvedRecordCount: 0,
      code: "230208101",
      level: "TOWNSHIP" as const,
      name: "雅尔塞镇",
      parentCode: county.code,
    };
    const village = {
      ...sampleRegion,
      approvedRecordCount: 0,
      code: "230208101001",
      level: "VILLAGE" as const,
      name: "音钦村",
      parentCode: township.code,
    };
    const regions = vi.fn<OverviewRepository["regions"]>((query) => {
      if (query.parentCode === prefecture.code) return Promise.resolve([county]);
      if (query.parentCode === county.code) return Promise.resolve([township]);
      if (query.parentCode === township.code) return Promise.resolve([village]);
      return Promise.resolve([prefecture]);
    });
    const indicators = vi.fn<OverviewRepository["indicators"]>(() =>
      Promise.resolve([]),
    );
    const dashboard = vi.fn<OverviewRepository["dashboard"]>(() =>
      Promise.resolve(emptyDashboard),
    );
    const aggregates = vi.fn<OverviewSamplePointRepository["aggregates"]>(() =>
      Promise.resolve([]),
    );
    render(
      <OverviewPage
        repository={{
          mapScope: () => Promise.resolve(sampleMapScope),
          options: () =>
            Promise.resolve({
              products: options.products,
              periods: options.periods,
              years: [],
            }),
          regions,
          locations: () => Promise.resolve([]),
          indicators,
          dashboard,
        }}
        samplePointRepository={{
          aggregates,
          comparison: () => Promise.resolve(emptySampleNetworkComparison),
          detail: () => Promise.resolve(samplePointDetail),
          icons: () => Promise.resolve([]),
          list: () => Promise.resolve(samplePointList),
        }}
      />,
    );
    expect(await screen.findByRole("img", { name: "行政区边界地图" })).toBeVisible();
    expect(
      screen.getByText("尚无审核正式年度数据", { exact: false }),
    ).toBeInTheDocument();
    const map = screen.getByLabelText("粮食商情总览地图");
    fireEvent.doubleClick(
      await within(map).findByRole("button", { name: "齐齐哈尔市" }),
    );
    fireEvent.doubleClick(
      await within(map).findByRole("button", {
        name: "梅里斯达斡尔族区",
      }),
    );
    fireEvent.doubleClick(await within(map).findByRole("button", { name: "雅尔塞镇" }));
    expect(await within(map).findByRole("button", { name: "音钦村" })).toBeVisible();
    expect(regions).toHaveBeenCalledWith({
      periodCode: "2026-Q3",
      productCode: "CORN",
    });
    expect(regions).toHaveBeenCalledWith({
      parentCode: prefecture.code,
      periodCode: "2026-Q3",
      productCode: "CORN",
    });
    expect(regions).toHaveBeenCalledWith({
      parentCode: county.code,
      periodCode: "2026-Q3",
      productCode: "CORN",
    });
    expect(regions).toHaveBeenCalledWith({
      parentCode: township.code,
      periodCode: "2026-Q3",
      productCode: "CORN",
    });
    expect(
      regions.mock.calls.every(
        ([query]) => query.periodCode === "2026-Q3" && query.year === undefined,
      ),
    ).toBe(true);
    expect(indicators).not.toHaveBeenCalled();
    expect(dashboard).not.toHaveBeenCalled();
    expect(aggregates).not.toHaveBeenCalled();
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
    const dashboard = vi.fn<OverviewRepository["dashboard"]>(() =>
      Promise.resolve(emptyDashboard),
    );
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
          dashboard,
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
    await waitFor(() =>
      expect(dashboard).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230200",
        year: 2026,
      }),
    );
    expect(locations).not.toHaveBeenCalled();

    fireEvent.doubleClick(screen.getByRole("button", { name: "拜泉县，已核定 1 条" }));
    await waitFor(() =>
      expect(regions).toHaveBeenCalledWith(
        expect.objectContaining({ parentCode: "230231" }),
      ),
    );
    await waitFor(() =>
      expect(dashboard).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230231",
        year: 2026,
      }),
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
  years: [2026, 2025],
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
  businessTables: [],
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
  calculationVersion: "OVERVIEW_METRIC_V1",
  code: "PRODUCTION_CULTIVATED_AREA",
  coverageScope: "region=230200;product=CORN;year=2026;descendants=included",
  coverageStatus: "AVAILABLE" as const,
  dataCutoff: "2026-08-11T00:00:00Z",
  formula: "SUM(cultivated_area_mu)",
  name: "核定播种面积",
  sourceRelation: "production.production_record",
  unitCode: "亩",
  value: "10",
  sourceDomain: "PRODUCTION" as const,
  sourceCount: 1,
  sourcePath: "/api/v1/production-records",
};
const emptySampleNetworkComparison = {
  networkYear: 2026,
  networkStatus: "NOT_CREATED",
  designPointCount: 0,
  activeSamplePointCount: 0,
  exactCoveredDesignPointCount: 0,
  representedDesignPointCount: 0,
  regionalAssociationDesignPointCount: 0,
  unrelatedDesignPointCount: 0,
  actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 0 },
  designPoints: [],
  actualPoints: [],
  relations: [],
};

const samplePointList = {
  regionCode: "230231",
  totalCount: 1,
  validCoordinateCount: 1,
  dataQualityIssueCount: 0,
  correctionSourceCount: 0,
  unresolvedSourceCount: 0,
  categories: [
    {
      code: "PRODUCTION" as const,
      name: "产情类",
      count: 1,
      types: [{ code: "FARMER", name: "农户", iconKey: "farmer", count: 1 }],
    },
    { code: "MARKET" as const, name: "市场类", count: 0, types: [] },
  ],
  items: [
    {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230231100201",
      regionName: "众兴村",
      locationState: "VALID",
      dataQualityReason: null,
      categories: [{ code: "PRODUCTION" as const, name: "产情类" }],
      types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
      products: [{ code: "CORN", name: "玉米" }],
      latestBusinessDate: "2026-08-05",
      summaryValues: {
        SAMPLE_CONTACT: {
          label: "样本点联系方式",
          value: "13900000000",
          unitCode: null,
        },
      },
    },
  ],
  correctionSources: [],
};
const samplePointIcons = [
  {
    samplePointId: "94000000-0000-0000-0000-000000000001",
    name: "同一跨产品样本点",
    iconKey: "farmer",
    types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
    longitude: 123.5,
    latitude: 47.5,
    dataQualityReason: null,
  },
];
const samplePointDetail = {
  samplePointId: "94000000-0000-0000-0000-000000000001",
  name: "同一跨产品样本点",
  regionCode: "230231100201",
  regionName: "众兴村",
  locationState: "VALID",
  dataQualityReason: null,
  associations: [],
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
