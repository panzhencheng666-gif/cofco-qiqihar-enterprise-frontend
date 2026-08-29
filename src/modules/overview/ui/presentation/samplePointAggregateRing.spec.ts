import { describe, expect, it } from "vitest";

import {
  samplePointAggregateLabel,
  samplePointAggregateMarkerText,
  samplePointAggregateRing,
} from "./samplePointAggregateRing";

describe("samplePointAggregateRing", () => {
  it.each([
    {
      name: "双类",
      productionCount: 3,
      marketCount: 1,
      logisticsCount: 0,
      samplePointCount: 4,
      state: "mixed",
      expected: "75%",
    },
    {
      name: "仅生产",
      productionCount: 4,
      marketCount: 0,
      logisticsCount: 0,
      samplePointCount: 4,
      state: "production-only",
      expected: "#ffe58e",
    },
    {
      name: "仅市场",
      productionCount: 0,
      marketCount: 4,
      logisticsCount: 0,
      samplePointCount: 4,
      state: "market-only",
      expected: "#5ce1e6",
    },
    {
      name: "零值空态",
      productionCount: 0,
      marketCount: 0,
      logisticsCount: 0,
      samplePointCount: 0,
      state: "empty",
      expected: "#31566b",
    },
  ])("renders $name", (counts) => {
    const ring = samplePointAggregateRing(counts);

    expect(ring.state).toBe(counts.state);
    expect(ring.background).toContain(counts.expected);
  });

  it("describes all stable roles without adding overlapping identities", () => {
    const label = samplePointAggregateLabel({
      productionCount: 3,
      marketCount: 1,
      logisticsCount: 2,
      samplePointCount: 4,
    });

    expect(label).toBe(
      "已核定 4 个样本点，其中产情类 3 个、市场类 1 个、物流类 2 个；多角色样本只计一个身份",
    );
  });

  it("gives zero counts an explicit empty-state description", () => {
    expect(
      samplePointAggregateLabel({
        productionCount: 0,
        marketCount: 0,
        logisticsCount: 0,
        samplePointCount: 0,
      }),
    ).toBe("暂无产情、市场或物流样本点");
  });

  it("names the explicit parent-direct bucket visibly", () => {
    expect(
      samplePointAggregateMarkerText({
        samplePointCount: 48,
        scopeKind: "PARENT_DIRECT",
      }),
    ).toBe("本级样本");
    expect(
      samplePointAggregateLabel({
        productionCount: 2,
        marketCount: 1,
        logisticsCount: 0,
        samplePointCount: 3,
        scopeKind: "PARENT_DIRECT",
      }),
    ).toContain("3 个本级直属样本点");
  });

  it("marks overlapping role counts without pretending they are an additive pie", () => {
    expect(
      samplePointAggregateRing({
        productionCount: 3,
        marketCount: 1,
        logisticsCount: 2,
        samplePointCount: 4,
      }).state,
    ).toBe("role-overlap");
  });
});
