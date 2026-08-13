import type { OverviewSamplePointAggregate } from "../../domain/overviewSamplePoint";

export const productionSamplePointColor = "#ffe58e";
export const marketSamplePointColor = "#5ce1e6";
export const emptySamplePointColor = "#31566b";

export type SamplePointAggregateRingState =
  "empty" | "production-only" | "market-only" | "mixed";

type SamplePointAggregateCounts = Pick<
  OverviewSamplePointAggregate,
  "samplePointCount" | "productionCount" | "marketCount"
>;

function assertAggregateTotal({
  marketCount,
  productionCount,
  samplePointCount,
}: SamplePointAggregateCounts) {
  if (samplePointCount !== productionCount + marketCount) {
    throw new Error("样本点总数必须等于生产类与市场类之和");
  }
}

export function samplePointAggregateLabel(
  aggregate: SamplePointAggregateCounts,
): string {
  assertAggregateTotal(aggregate);
  if (aggregate.samplePointCount === 0) return "暂无生产类或市场类样本点";
  return `已核定 ${aggregate.samplePointCount} 个样本点，其中生产类 ${aggregate.productionCount} 个、市场类 ${aggregate.marketCount} 个`;
}

export function samplePointAggregateRing(aggregate: SamplePointAggregateCounts): {
  background: string;
  state: SamplePointAggregateRingState;
} {
  const { marketCount, productionCount, samplePointCount } = aggregate;
  assertAggregateTotal(aggregate);
  if (samplePointCount === 0) {
    return { background: emptySamplePointColor, state: "empty" };
  }
  if (marketCount === 0) {
    return { background: productionSamplePointColor, state: "production-only" };
  }
  if (productionCount === 0) {
    return { background: marketSamplePointColor, state: "market-only" };
  }
  const productionPercent = Number(
    ((productionCount / samplePointCount) * 100).toFixed(4),
  );
  return {
    background: `conic-gradient(from -90deg, ${productionSamplePointColor} 0 ${productionPercent}%, ${marketSamplePointColor} ${productionPercent}% 100%)`,
    state: "mixed",
  };
}
