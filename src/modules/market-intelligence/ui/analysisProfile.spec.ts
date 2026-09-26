import { describe, expect, it } from "vitest";
import { getAnalysisProfile, groupTopic } from "./analysisProfile";
import { findMetric, metricCatalog, metricGroups } from "./metricCatalog";

describe("market analysis profiles", () => {
  it("keeps the left directory relevant to the selected subject", () => {
    const oilseed = getAnalysisProfile(findMetric("油脂油料", "实时事件"));
    const inland = getAnalysisProfile(
      groupTopic(metricGroups.find((group) => group.id === "inland")!),
    );

    expect(oilseed.groups.map((group) => group.id)).toEqual([
      "processing",
      "demand",
      "trade",
    ]);
    expect(inland.groups.map((group) => group.id)).toEqual(["inland", "shipping"]);
    expect(oilseed.metrics.map((item) => item.id)).not.toEqual(
      inland.metrics.map((item) => item.id),
    );
    expect(inland.metrics.some((item) => item.title === "铁路运费")).toBe(true);
    expect(inland.metrics.some((item) => item.title === "公路拥堵与封闭")).toBe(true);
  });

  it("gives each catalogue subject a nonempty own group", () => {
    expect(metricGroups.length).toBeGreaterThan(0);
    for (const group of metricGroups) {
      const profile = getAnalysisProfile(groupTopic(group));
      expect(profile.groups[0]?.id).toBe(group.id);
      expect(profile.metrics.some((metric) => metric.group === group.title)).toBe(true);
    }
  });

  it("uses different analysis and scenario views for events, supply, and costs", () => {
    expect(getAnalysisProfile(findMetric("关税与制裁", "风险观察")).mode).toBe("event");
    expect(
      getAnalysisProfile(
        groupTopic(metricGroups.find((group) => group.id === "supply")!),
      ).scenario,
    ).toBe("balance");
    expect(
      getAnalysisProfile(
        groupTopic(metricGroups.find((group) => group.id === "shipping")!),
      ).scenario,
    ).toBe("cost");
    expect(
      getAnalysisProfile(
        groupTopic(metricGroups.find((group) => group.id === "weather")!),
      ).scenario,
    ).toBe("impact");
    expect(
      getAnalysisProfile(
        groupTopic(metricGroups.find((group) => group.id === "inland")!),
      ).scenario,
    ).toBe("impact");
  });

  it("retains every catalogued metric in its subject workspace", () => {
    for (const metric of metricCatalog) {
      expect(
        getAnalysisProfile(metric).metrics.some((item) => item.id === metric.id),
      ).toBe(true);
    }
  });
});
