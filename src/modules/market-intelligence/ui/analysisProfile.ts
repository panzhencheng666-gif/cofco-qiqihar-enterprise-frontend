import { metricCatalog, metricGroups, type AnalysisTopic } from "./metricCatalog";

type Group = (typeof metricGroups)[number];
export type AnalysisMode = "series" | "event" | "balance";
export type ScenarioMode = "cost" | "balance" | "impact";

const relatedGroups: Record<string, readonly string[]> = {
  spot: ["futures"],
  futures: ["spot"],
  crop: ["weather"],
  weather: ["crop"],
  supply: ["inventory"],
  inventory: ["supply"],
  demand: ["supply"],
  processing: ["demand"],
  trade: ["shipping"],
  shipping: ["trade"],
  inland: ["shipping"],
  input: ["processing"],
  finance: ["trade"],
  quality: ["inventory"],
  policy: ["risk"],
  risk: ["policy"],
};

const overviewGroups: Record<string, readonly string[]> = {
  新闻直播: ["policy", "risk"],
  "AI 商情洞察": ["policy", "risk"],
  粮食与商品快讯: ["policy", "supply", "input"],
  粮食产区: ["crop", "weather", "supply"],
  油脂油料: ["processing", "demand", "trade"],
  能源与运输: ["input", "shipping", "inland"],
  市场速览: ["spot", "futures", "supply"],
  期货持仓与资金: ["futures", "finance"],
  新闻与市场联动: ["policy", "spot", "risk"],
  能源与运费: ["input", "shipping", "inland"],
  陆运与中转: ["inland", "shipping", "trade"],
  库存与供需: ["inventory", "supply", "demand"],
  航道与贸易政策: ["shipping", "trade", "policy"],
  种植与长势: ["crop", "weather"],
  天气与水文: ["weather", "crop"],
  加工与副产品: ["processing", "demand"],
  农资与生产成本: ["input", "processing"],
  粮食质量安全: ["quality", "inventory"],
  金融与套保: ["finance", "futures"],
  我的监控: ["risk", "policy"],
  原油与柴油: ["input", "shipping"],
  海运费: ["shipping", "trade"],
  铁路与公路: ["inland", "shipping"],
  产区库存: ["inventory", "supply"],
  产量与消费: ["supply", "demand"],
  关键航道: ["shipping", "risk"],
  进出口政策: ["policy", "trade"],
  关税与制裁: ["policy", "trade"],
};

const groupModes: Partial<Record<string, AnalysisMode>> = {
  policy: "event",
  risk: "event",
  supply: "balance",
  inventory: "balance",
  demand: "balance",
};

export function groupTopic(group: Group): AnalysisTopic {
  return {
    id: `group-${group.id}`,
    title: group.title,
    kind: group.kind,
    group: group.title,
  };
}

export function getAnalysisProfile(topic: AnalysisTopic) {
  const ownGroup = metricGroups.find(
    (group) => group.title === topic.group || group.title === topic.title,
  );
  const ids = ownGroup
    ? [ownGroup.id, ...(relatedGroups[ownGroup.id] ?? [])]
    : (overviewGroups[topic.title] ??
      (topic.kind === "实时事件"
        ? ["policy", "risk"]
        : topic.kind === "风险观察"
          ? ["risk", "weather"]
          : ["spot", "supply"]));
  const groups = ids
    .map((id) => metricGroups.find((group) => group.id === id))
    .filter((group): group is Group => Boolean(group));
  const metrics = metricCatalog.filter((metric) =>
    groups.some((group) => group.title === metric.group),
  );
  const primary = groups[0];
  const mode: AnalysisMode =
    topic.kind === "实时事件" ? "event" : (groupModes[primary?.id ?? ""] ?? "series");
  const scenario: ScenarioMode = ["supply", "inventory", "demand"].includes(
    primary?.id ?? "",
  )
    ? "balance"
    : ["trade", "shipping"].includes(primary?.id ?? "") && mode !== "event"
      ? "cost"
      : "impact";
  const checks =
    mode === "event"
      ? ["原始发布与时间", "涉及区域与品种", "多源交叉核验", "影响路径与修订"]
      : mode === "balance"
        ? ["统计期与范围", "供需口径", "单位与换算", "历史修订版本"]
        : ["报价或观测来源", "发布时间与频率", "币种及单位", "可比区域与品质"];
  return {
    groups,
    metrics,
    mode,
    scenario,
    checks,
    focus: primary?.title ?? topic.kind,
  };
}
