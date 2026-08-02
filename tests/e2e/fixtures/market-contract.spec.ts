import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import * as contract from "./market-contract";

describe("market V23 contract snapshot", () => {
  it("canonically serializes the complete fixture contract to the backend hash", () => {
    expect(contract).toMatchObject({
      marketContractVersion: "V23",
    });
    expect(contract.marketContractSha256).toBe(contract.backendMarketContractSha256);
    expect(contract.canonicalMarketContract).toContain(
      "CORE|CORN|MKT_SOURCE_NOTE|来源说明|TEXT|||||105|EXTENSION|GENERIC|f|59\n",
    );
    expect(contract.canonicalMarketContract).toContain(
      "CATEGORY|PURCHASE|采购与成交|20\n",
    );
    expect(contract.canonicalMarketContract).toContain(
      "CORE_OPTION|CORN|MKT_PACKAGING_FORM|BULK|散粮|20\n",
    );
    expect(contract.canonicalMarketContract).not.toContain("MKT_CORN_SOURCE_NOTE");
    expect(contract.marketCoreFieldDefinitions).toHaveLength(13);
    expect(
      contract.marketCoreFieldDefinitions.find(
        ({ code }) => code === "MKT_SOURCE_NOTE",
      ),
    ).toMatchObject({ description: null, domainBinding: "EXTENSION" });
    expect(contract.marketFactDefinitions.PROTEIN).toMatchObject({
      label: "蛋白",
      scale: 1,
    });
    expect(contract.marketFactDefinitions.TEST_WEIGHT).toMatchObject({ scale: 0 });
  });

  it("changes the UTF-8 hash for every response metadata drift", () => {
    const baseline = contract.marketContractSha256;
    const hash = (value: string) =>
      createHash("sha256").update(value, "utf8").digest("hex");
    const coreFields = contract.marketCoreFieldDefinitions.map((field) => ({
      ...field,
      options: field.options.map((option) => ({ ...option })),
    }));
    const packaging = coreFields.find(({ code }) => code === "MKT_PACKAGING_FORM")!;

    const descriptions = coreFields.map((field) =>
      field.code === "MKT_PURCHASE_BASE_PRICE"
        ? { ...field, description: `${field.description}（漂移）` }
        : field,
    );
    const optionLabels = coreFields.map((field) =>
      field.code === packaging.code
        ? {
            ...field,
            options: field.options.map((option) =>
              option.value === "BULK" ? { ...option, label: "散装漂移" } : option,
            ),
          }
        : field,
    );
    const optionOrders = coreFields.map((field) =>
      field.code === packaging.code
        ? {
            ...field,
            options: field.options.map((option) =>
              option.value === "BULK" ? { ...option, sortOrder: 999 } : option,
            ),
          }
        : field,
    );
    const categoryLabels = contract.marketFactCategories.map((category) =>
      category.code === "QUALITY" ? { ...category, label: "质量漂移" } : category,
    );
    const categoryOrders = contract.marketFactCategories.map((category) =>
      category.code === "QUALITY" ? { ...category, sortOrder: 999 } : category,
    );
    const factDescriptions = {
      ...contract.marketFactDefinitions,
      MOISTURE: {
        ...contract.marketFactDefinitions.MOISTURE,
        description: "水分漂移",
      },
    };

    expect(
      [
        contract.serializeMarketContract({ coreFields: descriptions }),
        contract.serializeMarketContract({ coreFields: optionLabels }),
        contract.serializeMarketContract({ coreFields: optionOrders }),
        contract.serializeMarketContract({ categories: categoryLabels }),
        contract.serializeMarketContract({ categories: categoryOrders }),
        contract.serializeMarketContract({ facts: factDescriptions }),
      ].map(hash),
    ).not.toContain(baseline);
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
