import type { OverviewSamplePointAggregate } from "../../domain/overviewSamplePoint";

export const productionSamplePointColor = "#ffe58e";
export const marketSamplePointColor = "#5ce1e6";
export const logisticsSamplePointColor = "#ff786f";
export const emptySamplePointColor = "#31566b";

export type SamplePointAggregateRingState =
  | "empty"
  | "production-only"
  | "market-only"
  | "logistics-only"
  | "mixed"
  | "role-overlap";

type SamplePointAggregateCounts = Pick<
  OverviewSamplePointAggregate,
  | "samplePointCount"
  | "productionCount"
  | "marketCount"
  | "logisticsCount"
  | "scopeKind"
>;

type SamplePointAggregateMarker = Pick<
  OverviewSamplePointAggregate,
  "samplePointCount" | "scopeKind"
>;

export function samplePointAggregateMarkerText(
  aggregate: SamplePointAggregateMarker,
): string {
  if (aggregate.scopeKind === "PARENT_DIRECT") return "本级样本";
  return aggregate.samplePointCount === 0 ? "暂无样本点" : "样本点";
}

export function samplePointAggregateLabel(
  aggregate: SamplePointAggregateCounts,
): string {
  if (aggregate.samplePointCount === 0) return "暂无产情、市场或物流样本点";
  const identity =
    aggregate.scopeKind === "PARENT_DIRECT" ? "本级直属样本点" : "样本点";
  return `已核定 ${aggregate.samplePointCount} 个${identity}，其中产情类 ${aggregate.productionCount} 个、市场类 ${aggregate.marketCount} 个、物流类 ${aggregate.logisticsCount ?? 0} 个；多角色样本只计一个身份`;
}

export function samplePointAggregateRing(aggregate: SamplePointAggregateCounts): {
  background: string;
  state: SamplePointAggregateRingState;
} {
  const {
    marketCount,
    productionCount,
    samplePointCount,
    logisticsCount = 0,
  } = aggregate;
  if (samplePointCount === 0) {
    return { background: emptySamplePointColor, state: "empty" };
  }
  if (
    productionCount === samplePointCount &&
    marketCount === 0 &&
    logisticsCount === 0
  ) {
    return { background: productionSamplePointColor, state: "production-only" };
  }
  if (
    marketCount === samplePointCount &&
    productionCount === 0 &&
    logisticsCount === 0
  ) {
    return { background: marketSamplePointColor, state: "market-only" };
  }
  if (
    logisticsCount === samplePointCount &&
    productionCount === 0 &&
    marketCount === 0
  ) {
    return { background: logisticsSamplePointColor, state: "logistics-only" };
  }

  const roleTotal = productionCount + marketCount + logisticsCount;
  if (roleTotal !== samplePointCount) {
    return {
      background: `conic-gradient(from -90deg, ${productionSamplePointColor} 0 33.3333%, ${marketSamplePointColor} 33.3333% 66.6667%, ${logisticsSamplePointColor} 66.6667% 100%)`,
      state: "role-overlap",
    };
  }

  const productionPercent = Number(
    ((productionCount / samplePointCount) * 100).toFixed(4),
  );
  const marketPercent = Number(
    (((productionCount + marketCount) / samplePointCount) * 100).toFixed(4),
  );
  return {
    background: `conic-gradient(from -90deg, ${productionSamplePointColor} 0 ${productionPercent}%, ${marketSamplePointColor} ${productionPercent}% ${marketPercent}%, ${logisticsSamplePointColor} ${marketPercent}% 100%)`,
    state: "mixed",
  };
}
