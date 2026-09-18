import { describe, expect, it } from "vitest";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import { operationalSituationTimeline } from "./operationalSituationTimeline";

describe("operationalSituationTimeline", () => {
  it("uses only timestamps from persisted weather, policy, event and price records", () => {
    const situation = {
      generatedAt: "2026-09-18T06:00:00Z",
      weather: [
        {
          rootRegionCode: "230200",
          regionName: "齐齐哈尔市",
          observedAt: "2026-09-18T05:00:00Z",
          assessment: "公开观测",
          sourceName: "Open-Meteo",
          sourceUrl: "https://open-meteo.com/",
        },
      ],
      publicEvents: [],
      policyEvents: [
        {
          sourceId: "policy-1",
          rootRegionCode: "*",
          title: "公开政策",
          summary: "原文摘要",
          publishedOn: "2026-09-01",
          sourceName: "政府网站",
          sourceUrl: "https://example.test/policy",
          verifiedAt: null,
        },
      ],
      sources: [],
    } as unknown as OperationalSituationCatalogue;
    const facilities = {
      storageFacilities: [
        {
          code: "DEPOT",
          name: "库点",
          regionCode: "230229",
          prices: [
            {
              productCode: "CORN",
              productName: "玉米",
              qualityRequirement: "公开挂牌",
              value: 2300,
              unit: "元/吨",
              effectiveOn: "2026-09-10",
              sourceName: "公开公告",
              sourceUrl: "https://example.test/price",
            },
          ],
        },
      ],
    } as unknown as OperationalFacilityCatalogue;

    const timeline = operationalSituationTimeline(situation, facilities);

    expect(timeline.map((item) => item.category)).toEqual([
      "POLICY",
      "MARKET",
      "WEATHER",
    ]);
    expect(timeline.map((item) => item.occurredAt)).toEqual([
      "2026-09-01T00:00:00+08:00",
      "2026-09-10T00:00:00+08:00",
      "2026-09-18T05:00:00Z",
    ]);
  });
});
