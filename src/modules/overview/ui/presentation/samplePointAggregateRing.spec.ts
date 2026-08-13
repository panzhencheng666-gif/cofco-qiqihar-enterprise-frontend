import { describe, expect, it } from "vitest";

import {
  samplePointAggregateLabel,
  samplePointAggregateRing,
} from "./samplePointAggregateRing";

describe("samplePointAggregateRing", () => {
  it.each([
    {
      name: "双类",
      productionCount: 3,
      marketCount: 1,
      samplePointCount: 4,
      state: "mixed",
      expected: "75%",
    },
    {
      name: "仅生产",
      productionCount: 4,
      marketCount: 0,
      samplePointCount: 4,
      state: "production-only",
      expected: "#ffe58e",
    },
    {
      name: "仅市场",
      productionCount: 0,
      marketCount: 4,
      samplePointCount: 4,
      state: "market-only",
      expected: "#5ce1e6",
    },
    {
      name: "零值空态",
      productionCount: 0,
      marketCount: 0,
      samplePointCount: 0,
      state: "empty",
      expected: "#31566b",
    },
  ])("renders $name without a third category color", (counts) => {
    const ring = samplePointAggregateRing(counts);

    expect(ring.state).toBe(counts.state);
    expect(ring.background).toContain(counts.expected);
    expect(ring.background).not.toContain("#71b9ff");
  });

  it("describes only the production and market categories", () => {
    const label = samplePointAggregateLabel({
      productionCount: 3,
      marketCount: 1,
      samplePointCount: 4,
    });

    expect(label).toBe("已核定 4 个样本点，其中生产类 3 个、市场类 1 个");
    expect(label).not.toContain("物流");
  });

  it("gives zero counts an explicit empty-state description", () => {
    expect(
      samplePointAggregateLabel({
        productionCount: 0,
        marketCount: 0,
        samplePointCount: 0,
      }),
    ).toBe("暂无生产类或市场类样本点");
  });
});
