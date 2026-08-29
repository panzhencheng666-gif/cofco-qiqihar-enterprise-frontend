import type { OverviewDashboardMetric } from "../../domain/overview";
import { formatMetricAuditLabel } from "./metricAuditLabel";

describe("formatMetricAuditLabel", () => {
  it("formats the complete governed metric contract once in Chinese", () => {
    expect(
      formatMetricAuditLabel(
        metric({
          dataCutoff: "2026年08月09日 12:34:56",
          coverageScope: "所选地区及全部下级地区、所选产品、2026年度",
          calculationVersion: "总揽指标口径第1版",
          formula: "核定种植面积合计",
          sourceRelation: "产情核定记录",
        }),
      ),
    ).toBe(
      "2 条审核来源 · 截止 2026年08月09日 12:34:56 · 覆盖 所选地区及全部下级地区、所选产品、2026年度 · 版本 总揽指标口径第1版 · 公式 核定种植面积合计 · 来源 产情核定记录",
    );
  });

  it("keeps an empty optional contract concise", () => {
    expect(
      formatMetricAuditLabel(
        metric({
          dataCutoff: null,
          coverageScope: "",
          calculationVersion: "",
          formula: "",
          sourceRelation: "",
        }),
      ),
    ).toBe("2 条审核来源");
  });

  it("converts ISO cutoff time and refuses technical identifiers", () => {
    const label = formatMetricAuditLabel(
      metric({
        dataCutoff: "2026-08-09T04:34:56Z",
        coverageScope: "region=230200;product=CORN;year=2026",
        calculationVersion: "OVERVIEW_METRIC_V1",
        formula: "SUM(cultivated_area_mu)",
        sourceRelation: "production.production_record",
      }),
    );

    expect(label).toBe("2 条审核来源 · 截止 2026年08月09日 12:34:56");
    expect(label).not.toMatch(/SUM\(|production\.|OVERVIEW_|region=|T04:/);
  });
});

function metric(
  values: Pick<
    OverviewDashboardMetric,
    "dataCutoff" | "coverageScope" | "calculationVersion" | "formula" | "sourceRelation"
  >,
): OverviewDashboardMetric {
  return {
    code: "PRODUCTION_CULTIVATED_AREA",
    coverageStatus: "AVAILABLE",
    name: "种植面积",
    sourceCount: 2,
    sourcePath: "/api/v1/production-records",
    unitCode: "亩",
    value: "20",
    ...values,
  };
}
