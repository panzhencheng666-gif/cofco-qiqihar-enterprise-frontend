import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";

export type SituationTimelineCategory =
  "WEATHER" | "LOGISTICS" | "MARKET" | "POLICY" | "PUBLIC_EVENT";

export interface SituationTimelineItem {
  id: string;
  category: SituationTimelineCategory;
  occurredAt: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  regionCode?: string;
  facilityId?: string;
}

export function operationalSituationTimeline(
  situation: OperationalSituationCatalogue,
  facilities: OperationalFacilityCatalogue,
): SituationTimelineItem[] {
  const items: SituationTimelineItem[] = [
    ...situation.weather.map((weather) => ({
      id: `weather:${weather.rootRegionCode}:${weather.observedAt}`,
      category: "WEATHER" as const,
      occurredAt: weather.observedAt,
      title: `${weather.regionName}天气观测`,
      description: weather.assessment,
      sourceName: weather.sourceName,
      sourceUrl: weather.sourceUrl,
      regionCode: weather.rootRegionCode,
    })),
    ...situation.publicEvents.map((event) => ({
      id: `public:${event.eventId}`,
      category: "PUBLIC_EVENT" as const,
      occurredAt: event.observedAt,
      title: event.title,
      description: event.description ?? event.categoryLabel,
      sourceName: "NASA EONET",
      sourceUrl: event.evidenceUrl ?? event.eventUrl,
    })),
    ...situation.policyEvents.flatMap((policy) =>
      policy.publishedOn
        ? [
            {
              id: `policy:${policy.sourceId}`,
              category: "POLICY" as const,
              occurredAt: `${policy.publishedOn}T00:00:00+08:00`,
              title: policy.title,
              description: policy.summary,
              sourceName: policy.sourceName,
              sourceUrl: policy.sourceUrl,
              ...(policy.rootRegionCode === "*"
                ? {}
                : { regionCode: policy.rootRegionCode }),
            },
          ]
        : [],
    ),
    ...(situation.logisticsFlows ?? []).map((flow) => ({
      id: `logistics:${flow.eventId}`,
      category: "LOGISTICS" as const,
      occurredAt: flow.occurredAt,
      title: `${flow.originRegionName} → ${flow.destinationRegionName}`,
      description: `${flow.transportMode}${
        flow.volumeTonnes === null
          ? ""
          : `，审核运量 ${flow.volumeTonnes.toLocaleString("zh-CN")} 吨`
      }`,
      sourceName: "系统物流监测",
      sourceUrl: "/#物流监测",
      regionCode: flow.originRegionCode,
    })),
    ...facilities.storageFacilities.flatMap((facility) =>
      facility.prices.map((price) => ({
        id: `market:${facility.code}:${price.productCode}:${price.effectiveOn}`,
        category: "MARKET" as const,
        occurredAt: `${price.effectiveOn}T00:00:00+08:00`,
        title: `${facility.name} ${price.productName ?? price.productCode}价格`,
        description: `${price.value.toLocaleString("zh-CN")} ${price.unit}；${price.qualityRequirement}`,
        sourceName: price.sourceName,
        sourceUrl: price.sourceUrl,
        regionCode: facility.regionCode,
        facilityId: facility.code,
      })),
    ),
  ];
  return items
    .filter((item) => Number.isFinite(Date.parse(item.occurredAt)))
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
}

export function categoryCount(
  category: SituationTimelineCategory,
  items: readonly SituationTimelineItem[],
  facilities: OperationalFacilityCatalogue,
) {
  if (category === "LOGISTICS")
    return (
      items.filter((item) => item.category === "LOGISTICS").length +
      facilities.railwayFacilities.length +
      facilities.railwayRoutes.length
    );
  return items.filter((item) => item.category === category).length;
}
