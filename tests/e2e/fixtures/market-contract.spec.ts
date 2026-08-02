import { describe, expect, it } from "vitest";

import * as contract from "./market-contract";

describe("market V21 contract snapshot", () => {
  it("is pinned to the backend-exported snapshot and exact fact metadata", () => {
    expect(contract).toMatchObject({
      marketContractVersion: "V21",
      backendMarketContractSha256:
        "041cb147446cbd70cffb648b856b9ed71a3b6ec1ee34e8e4141107bcf338d4e0",
    });
    expect(contract.marketFactDefinitions.PROTEIN).toMatchObject({
      label: "蛋白",
      scale: 1,
    });
    expect(contract.marketFactDefinitions.TEST_WEIGHT).toMatchObject({ scale: 0 });
  });

  it("pins object-specific applicability sort order independently of responses", () => {
    expect(
      Object.fromEntries(
        Object.entries(contract.marketProducts).map(([productCode, product]) => [
          productCode,
          Object.fromEntries(
            Object.entries(product.objects).map(([objectCode, object]) => [
              objectCode,
              { label: object.label, sortOrder: object.sortOrder },
            ]),
          ),
        ]),
      ),
    ).toEqual({
      CORN: {
        TRADER: { label: "贸易商", sortOrder: 110 },
        DEEP_PROCESSOR: { label: "深加工", sortOrder: 120 },
        WHOLESALE_MARKET: { label: "批发市场", sortOrder: 130 },
        RESERVE_ENTERPRISE: { label: "承储企业", sortOrder: 140 },
        BREEDING_FACTORY: { label: "养殖厂", sortOrder: 160 },
        FEED_MILL: { label: "饲料厂", sortOrder: 170 },
      },
      SOYBEAN: {
        TRADER: { label: "贸易商", sortOrder: 110 },
        DEEP_PROCESSOR: { label: "深加工", sortOrder: 120 },
        WHOLESALE_MARKET: { label: "批发市场", sortOrder: 130 },
        RESERVE_ENTERPRISE: { label: "承储企业", sortOrder: 140 },
      },
      RICE: {
        TRADER: { label: "贸易商", sortOrder: 110 },
        DEEP_PROCESSOR: { label: "深加工", sortOrder: 120 },
        WHOLESALE_MARKET: { label: "批发市场", sortOrder: 130 },
        RESERVE_ENTERPRISE: { label: "承储企业", sortOrder: 140 },
        RICE_MILL: { label: "米厂", sortOrder: 150 },
      },
    });
    expect(contract.marketProducts.SOYBEAN.objects.TRADER).toMatchObject({
      factSortOrders: {
        MOISTURE: 10,
        IMPURITY: 30,
        IMPERFECT_GRAIN: 40,
        PROTEIN: 51,
        OIL_YIELD: 52,
        PURCHASE_VOLUME: 60,
      },
    });
    expect(contract.marketProducts.RICE.objects.RICE_MILL).toMatchObject({
      factSortOrders: {
        MOISTURE: 10,
        MILLING_YIELD: 20,
        BROWN_RICE_YIELD: 30,
        IMPURITY: 40,
      },
    });
  });
});
