import type { OverviewIndicator } from "../../domain/overview";
import { buildOverviewTranscript, groupOverviewIndicators } from "./overviewNarrative";

describe("overview narrative", () => {
  it("groups logistics with supply while preserving the three leadership chapters", () => {
    const chapters = groupOverviewIndicators([
      indicator("area", "核定播种面积", "10", "亩", "PRODUCTION"),
      indicator("price", "核定成交价格", "4286", "元/吨", "MARKET"),
      indicator("flow", "核定调入量", "30", "吨", "LOGISTICS"),
      indicator("balance", "期末结余", "8", "吨", "SUPPLY"),
    ]);

    expect(chapters.map(({ code, label }) => [code, label])).toEqual([
      ["PRODUCTION", "产情脉络"],
      ["MARKET", "市场脉络"],
      ["SUPPLY", "供需平衡"],
    ]);
    expect(chapters[2]?.indicators.map(({ code }) => code)).toEqual([
      "flow",
      "balance",
    ]);
  });

  it("builds a factual transcript and identifies chapters without approved data", () => {
    const transcript = buildOverviewTranscript({
      regionName: "黑河市",
      productLabel: "大豆",
      periodLabel: "2026年第三季度",
      chapters: groupOverviewIndicators([
        indicator("area", "核定播种面积", "1234.5", "亩", "PRODUCTION"),
      ]),
    });

    expect(transcript).toContain("黑河市");
    expect(transcript).toContain("大豆");
    expect(transcript).toContain("核定播种面积1,234.5亩");
    expect(transcript.match(/当前条件下暂无已核定数据/g)).toHaveLength(2);
    expect(transcript).not.toContain("增长");
    expect(transcript).not.toContain("预计");
  });

  it("does not turn missing region or period data into fabricated facts", () => {
    expect(
      buildOverviewTranscript({
        productLabel: "玉米",
        chapters: groupOverviewIndicators([]),
      }),
    ).toBe(
      "请选择地图中的地区。当前尚未选择正式业务期间。产情脉络，当前条件下暂无已核定数据。市场脉络，当前条件下暂无已核定数据。供需平衡，当前条件下暂无已核定数据。",
    );
  });

  it("does not present a backend zero aggregate when it has no approved source", () => {
    const emptyAggregate = indicator("balance", "期末结余", "0", "吨", "SUPPLY");
    const chapters = groupOverviewIndicators([{ ...emptyAggregate, sourceCount: 0 }]);

    expect(chapters[2]?.indicators).toEqual([]);
  });
});

function indicator(
  code: string,
  name: string,
  value: string,
  unitCode: string,
  sourceDomain: OverviewIndicator["sourceDomain"],
): OverviewIndicator {
  return {
    calculationVersion: "OVERVIEW_METRIC_V1",
    code,
    coverageScope: `region=230200;product=CORN;year=2026;metric=${code}`,
    coverageStatus: "AVAILABLE",
    dataCutoff: "2026-08-11T00:00:00Z",
    formula: `SUM(${code})`,
    name,
    sourceRelation: `${sourceDomain.toLowerCase()}.${code}`,
    sourceDomain,
    sourceCount: 1,
    sourcePath: `/sources/${code}`,
    unitCode,
    value,
  };
}
