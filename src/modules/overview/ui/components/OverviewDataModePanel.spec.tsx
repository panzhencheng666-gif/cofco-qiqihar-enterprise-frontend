import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OverviewDataModePanel, OverviewDataModeTabs } from "./OverviewDataModePanel";

describe("OverviewDataModePanel", () => {
  it("keeps sample points as the default mode and exposes independent regional and supply modes", async () => {
    const onModeChange = vi.fn();
    render(<OverviewDataModeTabs mode="SAMPLE_POINTS" onModeChange={onModeChange} />);

    expect(screen.getByRole("button", { name: "样本点" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "地区数据" }));
    expect(onModeChange).toHaveBeenCalledWith("REGIONAL_DATA");
  });

  it("renders regional metrics without embedding the mode navigation", () => {
    render(
      <OverviewDataModePanel
        mode="REGIONAL_DATA"
        productLabel="玉米"
        regionalSummary={{
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          administrativeLevel: "PREFECTURE",
          year: 2026,
          productCode: "CORN",
          plantedAreaMu: "1500000.0000",
          yieldPerMuKg: "650.0000",
          totalOutputKg: "975000000.0000",
          areaChangeWanMu: "10.0000",
          areaChangeRatePercent: "7.1429",
          currentDataAvailable: true,
          comparisonAvailable: true,
          areaChangeRateAvailable: true,
          comparisonMessage: "已按2025年对比",
        }}
      />,
    );

    expect(screen.getByText("播种面积")).toBeInTheDocument();
    expect(screen.getByText("单产")).toBeInTheDocument();
    expect(screen.getByText("总产")).toBeInTheDocument();
    expect(screen.getByText("结构调整增减")).toBeInTheDocument();
    expect(screen.getByText("增减比率")).toBeInTheDocument();
    expect(screen.getByText("2026年 · 玉米")).toBeInTheDocument();
    expect(screen.queryByText(/CORN/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "总揽展示内容" }),
    ).not.toBeInTheDocument();
  });

  it("shows dated regional data and opens formulas or source evidence on demand", async () => {
    render(
      <OverviewDataModePanel
        mode="REGIONAL_DATA"
        agricultureProfile={{
          regionCode: "231100",
          regionName: "黑河市",
          administrativeLevel: "PREFECTURE",
          year: 2026,
          automatic: true,
          generatedAt: "2026-09-14T10:00:00Z",
          coverageDescription: "乡镇级自动估算：继承上级公开统计并按边界面积分摊",
          regionFacts: {
            areaSquareKilometres: "68726.00",
            directChildCount: 6,
            countyCount: 6,
            townshipCount: 64,
            villageCount: 562,
          },
          sourceSummary: "地区年度正式数据优先，缺项由统计模型自动补齐",
          calculationMethod: "结构系数估算；复合增长公式预测",
          refreshStatus: {
            cadence: "每日",
            status: "SUCCESS_UNCHANGED",
            lastAttemptAt: "2026-09-14T02:00:00Z",
            lastSuccessAt: "2026-09-14T02:00:00Z",
            nextRefreshAt: "2026-09-15T02:00:00Z",
          },
          weather: {
            meanTemperatureC: "18.4",
            precipitationMm: "1.2",
            soilMoisturePercent: "27",
            risk: "当前天气指标处于常规模型区间",
            assessment: "墒情适宜",
            observedAt: "2026-09-14T02:15:00Z",
            sourceId: "weather-heihe",
          },
          policies: [
            {
              title: "2026年强农惠农富农政策清单",
              publishedOn: "2026-03-25",
              sourceName: "农业农村部",
              sourceUrl: "https://example.test/policy",
              affectedCrops: "玉米、大豆、水稻",
              impact: "生产者补贴与农业保险作为预测修正依据",
            },
          ],
          indicators: [
            {
              category: "OUTLOOK",
              label: "玉米产量 · 2027年预测",
              value: "133.10",
              unit: "万吨",
              dataYear: 2027,
              dataKind: "ESTIMATED",
              method:
                "方法：两期年均趋势。选择原因：两期同口径数据。历史输入：2024年=100万吨；2025年=110万吨。计算：110×exp(0.095310×2)=133.10万吨。",
              sourceName: "黑河市人民政府",
              sourceUrl: "https://example.test/report",
            },
            {
              category: "INPUT",
              label: "种子需求量",
              value: "10.5",
              unit: "万吨",
              dataYear: 2026,
              dataKind: "PLAN",
              method: "农业农村局春耕调度值",
              sourceName: "黑河市农业农村局",
              sourceUrl: "https://example.test/spring",
            },
            {
              category: "FINANCE",
              label: "计划涉农贷款",
              value: "294",
              unit: "亿元",
              dataYear: 2026,
              dataKind: "PLAN",
              method: "公开报道的金融机构计划投放额",
              sourceName: "黑河市农业农村局",
              sourceUrl: "https://example.test/spring",
            },
          ],
          sources: [
            {
              id: "heihe-report",
              type: "AGRICULTURE",
              name: "黑河市人民政府",
              url: "https://example.test/report",
              sourceClass: "OFFICIAL",
              reliabilityWeight: "1.0",
              publishedOn: "2026-04-29",
              fetchedAt: "2026-09-14T02:00:00Z",
              status: "SUCCESS_UNCHANGED",
              evidence: "大豆2026.4万亩，玉米713.9万亩",
            },
          ],
          crops: [
            {
              productCode: "CORN",
              productName: "玉米",
              dataKind: "OBSERVED",
              plantedAreaMu: "1000000",
              yieldPerMuKg: "600",
              totalOutputKg: "600000000",
              structurePercent: "40",
              basis: "采用地区年度正式数据自动汇总",
              formula: "总产=播种面积×亩均单产",
              confidencePercent: "92",
              uncertaintyLowKg: "540000000",
              uncertaintyHighKg: "660000000",
              forecasts: [
                {
                  year: 2027,
                  plantedAreaMu: "1012000",
                  yieldPerMuKg: "604.8",
                  totalOutputKg: "612057600",
                  formula: "明年总产=当年总产×趋势系数×天气系数×政策系数",
                  confidencePercent: "58",
                },
              ],
            },
            {
              productCode: "SOYBEAN",
              productName: "大豆",
              dataKind: "MODEL_ESTIMATE",
              plantedAreaMu: "1375000",
              yieldPerMuKg: "155",
              totalOutputKg: "213125000",
              structurePercent: "55",
              basis: "依据公开行政区边界面积和结构系数推算",
              forecasts: [],
            },
            {
              productCode: "RICE",
              productName: "水稻",
              dataKind: "MODEL_ESTIMATE",
              plantedAreaMu: "125000",
              yieldPerMuKg: "520",
              totalOutputKg: "65000000",
              structurePercent: "5",
              basis: "依据公开行政区边界面积和结构系数推算",
              forecasts: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "黑河市农业概况" })).toBeVisible();
    expect(screen.getByText("无需日常人工填报")).toBeVisible();
    expect(screen.getByRole("heading", { name: "种植结构与分品种数据" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "面积与单产模型预测" })).toBeVisible();
    expect(screen.getByText("公开统计")).toBeVisible();
    expect(screen.getAllByText("模型补算")).toHaveLength(2);
    expect(screen.getByText("2027年")).toBeVisible();
    expect(screen.getByText("农业天气")).toBeVisible();
    expect(screen.getByRole("heading", { name: "政策影响（1项）" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "来源档案（1个渠道）" })).toBeVisible();
    expect(screen.getByText("地区档案")).toBeVisible();
    expect(screen.getByText(/黑河市区域面积约68,726.00平方公里/)).toBeVisible();
    expect(screen.getByText(/结构以大豆为主/)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "农业粮食专题指标（3项）" }),
    ).toBeVisible();
    expect(screen.getByText("农资保障")).toBeVisible();
    expect(screen.getByText("金融与补贴")).toBeVisible();
    expect(screen.getByText("种子需求量")).toBeVisible();
    expect(screen.getByText("计划涉农贷款")).toBeVisible();
    expect(screen.getAllByText("公开计划")).toHaveLength(2);
    expect(screen.getByText("已覆盖作物播种规模")).toBeVisible();
    expect(screen.getByText("公开值覆盖")).toBeVisible();
    expect(screen.getByText("明年产量变化")).toBeVisible();
    expect(screen.getByText("562")).toBeVisible();
    expect(screen.getByText("核验完成，公开数据确认无变化")).toBeVisible();
    expect(screen.getByText("已核验 · 确认无变化")).toBeVisible();
    expect(screen.getByText("确认数据无变化")).toBeVisible();
    expect(screen.getByText("本次计算")).toBeVisible();
    expect(screen.getByText("下次定时任务")).toBeVisible();
    expect(
      screen.getByText("大豆", { selector: ".overview-data-mode__fact-grid strong" }),
    ).toBeVisible();
    expect(screen.queryByText(/SUCCESS|PARTIAL|\{"/)).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "搜索农业指标" }),
      "贷款",
    );
    expect(screen.queryByText("种子需求量")).not.toBeInTheDocument();
    expect(screen.getByText("计划涉农贷款")).toBeVisible();
    await userEvent.clear(screen.getByRole("searchbox", { name: "搜索农业指标" }));
    await userEvent.click(
      screen.getByRole("button", { name: "查看玉米产量 · 2027年预测计算与来源" }),
    );
    const explanation = screen.getByRole("dialog", {
      name: "玉米产量 · 2027年预测计算与来源说明",
    });
    expect(within(explanation).getByText("2024年")).toBeVisible();
    expect(within(explanation).getByText("100万吨")).toBeVisible();
    expect(within(explanation).getByText(/年度倍率 exp/)).toBeVisible();
    expect(
      within(explanation).getByText("110×exp(0.095310×2)=133.10万吨"),
    ).toBeVisible();
    await userEvent.click(within(explanation).getByRole("button", { name: "关闭" }));
    expect(screen.queryByText("大豆2026.4万亩，玉米713.9万亩")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "查看黑河市人民政府计算与来源" }),
    );
    expect(screen.getByRole("heading", { name: "指标解释" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "为什么这样计算" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "逐步计算逻辑" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "来源依据（1项）" })).toBeVisible();
    expect(screen.getByText("资料期")).toBeVisible();
    expect(screen.getByText("核验时间")).toBeVisible();
    expect(screen.getByText("来源优先权重")).toBeVisible();
    expect(screen.getByRole("link", { name: /查看公开原文/ })).toHaveAttribute(
      "href",
      "https://example.test/report",
    );
    expect(screen.getByText("大豆2026.4万亩，玉米713.9万亩")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "关闭" }));

    await userEvent.click(screen.getByRole("button", { name: "查看公式" }));
    expect(
      screen.getByRole("dialog", { name: "玉米2027年产量预测计算与来源说明" }),
    ).toBeVisible();
    expect(screen.getByText(/÷1000=61.21万吨/)).toBeVisible();
    expect(screen.getByText(/模型参考评分 92/)).toBeVisible();
  });

  it("renders an unfilled manual balance field without rejecting the backend contract", () => {
    render(
      <OverviewDataModePanel
        mode="SUPPLY_BALANCE"
        productLabel="玉米"
        supplyBalance={{
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          administrativeLevel: "PREFECTURE",
          surveyYear: 2026,
          productCode: "CORN",
          regionalProductionAvailable: false,
          version: 0,
          updatedAt: null,
          rows: [
            {
              code: "OPENING_INVENTORY",
              label: "期初库存",
              kind: "MANUAL",
              unit: "万吨",
              requirement: "按本地区本年度实际口径填报",
              value: null,
              display: null,
              note: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("齐齐哈尔市供需平衡")).toBeVisible();
    expect(screen.getByRole("cell", { name: "待填报" })).toBeVisible();
  });

  it("presents key supply indicators and preserves the complete formal table", () => {
    render(
      <OverviewDataModePanel
        mode="SUPPLY_BALANCE"
        productLabel="玉米"
        supplyBalance={{
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          administrativeLevel: "PREFECTURE",
          surveyYear: 2026,
          productCode: "CORN",
          regionalProductionAvailable: true,
          version: 3,
          updatedAt: "2026-08-28T09:00:00+08:00",
          rows: [
            balanceRow("OUTPUT", "产量", "AUTO", "124.07", "系统读取地区总产"),
            balanceRow(
              "OPENING_INVENTORY",
              "期初库存",
              "MANUAL",
              null,
              "按正式口径填报",
            ),
            balanceRow("TOTAL_SUPPLY", "总供给", "DERIVED", "150.00", "系统自动计算"),
            balanceRow("TOTAL_DEMAND", "总需求", "DERIVED", null, "系统自动计算"),
            balanceRow(
              "CLOSING_INVENTORY",
              "期末库存",
              "DERIVED",
              null,
              "系统自动计算",
            ),
            balanceRow(
              "DEMAND_SUPPLY_RATIO",
              "需求供给比",
              "RATIO",
              null,
              "系统自动计算",
            ),
          ],
        }}
      />,
    );

    const metrics = screen.getByRole("list", { name: "供需平衡核心指标" });
    expect(within(metrics).getByText("产量")).toBeVisible();
    expect(within(metrics).getByText("总供给")).toBeVisible();
    expect(within(metrics).getByText("总需求")).toBeVisible();
    expect(within(metrics).getByText("期末库存")).toBeVisible();
    expect(within(metrics).getByText("需求供给比")).toBeVisible();
    expect(within(metrics).getAllByText("计算条件未完整")).toHaveLength(2);
    expect(within(metrics).getByText("不可计算")).toBeVisible();

    const table = screen.getByRole("table", { name: "供需平衡完整明细" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(
      within(table).queryByRole("columnheader", { name: "口径" }),
    ).not.toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(
      within(table).getByRole("row", {
        name: /期初库存 按正式口径填报 待填报 万吨/,
      }),
    ).toBeVisible();
    expect(within(table).getByRole("cell", { name: "待填报" })).toBeVisible();
    expect(within(table).getAllByRole("cell", { name: "计算条件未完整" })).toHaveLength(
      2,
    );
    expect(within(table).getByRole("cell", { name: "不可计算" })).toBeVisible();
  });
});

function balanceRow(
  code: string,
  label: string,
  kind: "AUTO" | "MANUAL" | "DERIVED" | "RATIO",
  display: string | null,
  requirement: string,
) {
  return {
    code,
    label,
    kind,
    unit: kind === "RATIO" ? "%" : "万吨",
    requirement,
    value: display,
    display,
    note: null,
  } as const;
}
