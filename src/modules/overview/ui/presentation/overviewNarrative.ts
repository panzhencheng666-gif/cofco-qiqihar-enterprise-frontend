import type { OverviewIndicator } from "../../domain/overview";

export type OverviewChapterCode = "PRODUCTION" | "MARKET" | "SUPPLY";

export interface OverviewChapter {
  code: OverviewChapterCode;
  label: string;
  indicators: readonly OverviewIndicator[];
}

const chapterDefinitions: readonly Pick<OverviewChapter, "code" | "label">[] = [
  { code: "PRODUCTION", label: "产情脉络" },
  { code: "MARKET", label: "市场脉络" },
  { code: "SUPPLY", label: "供需平衡" },
];

export function groupOverviewIndicators(
  indicators: readonly OverviewIndicator[],
): readonly OverviewChapter[] {
  const approvedIndicators = indicators.filter(
    (indicator) => indicator.sourceCount > 0,
  );
  return chapterDefinitions.map((definition) => ({
    ...definition,
    indicators: approvedIndicators.filter((indicator) =>
      definition.code === "SUPPLY"
        ? indicator.sourceDomain === "SUPPLY" || indicator.sourceDomain === "LOGISTICS"
        : indicator.sourceDomain === definition.code,
    ),
  }));
}

export function buildOverviewTranscript(context: {
  regionName?: string;
  productLabel: string;
  periodLabel?: string;
  chapters: readonly OverviewChapter[];
}): string {
  const introduction = context.regionName
    ? `${context.regionName}，当前讲解产品为${context.productLabel}。`
    : "请选择地图中的地区。";
  const period = context.periodLabel
    ? `业务期间为${context.periodLabel}。`
    : "当前尚未选择正式业务期间。";
  const chapters = context.chapters
    .map((chapter) => {
      if (!chapter.indicators.length) {
        return `${chapter.label}，当前条件下暂无已核定数据。`;
      }
      return `${chapter.label}，${chapter.indicators
        .map(
          (indicator) =>
            `${indicator.name}${formatIndicatorValue(indicator.value)}${indicator.unitCode}`,
        )
        .join("；")}。`;
    })
    .join("");
  return `${introduction}${period}${chapters}`;
}

export function formatIndicatorValue(value: string | null) {
  if (value === null) return "暂无可靠数据";
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(numericValue)
    : value;
}

export function sourceDomainLabel(domain: OverviewIndicator["sourceDomain"]) {
  return {
    PRODUCTION: "产情监测",
    MARKET: "市场监测",
    LOGISTICS: "物流监测",
    SUPPLY: "供需分析",
  }[domain];
}
