import { calculateMarketActualPrice, type MarketDraft } from "./marketCollection";

describe("calculateMarketActualPrice", () => {
  it.each([
    ["PURCHASE", "2300", null, "36", "12", "72", "2420.0000"],
    ["SALE", null, "2400.1", ".2", "0.30", "0.0000", "2400.6000"],
  ] as const)(
    "calculates an exact %s preview using the directional base and all components",
    (direction, purchase, sale, carriage, packaging, freight, expected) => {
      expect(
        calculateMarketActualPrice(
          draft({
            direction,
            purchaseBasePrice: purchase,
            saleBasePrice: sale,
            carriageBoardAmount: carriage,
            packagingAmount: packaging,
            freightAmount: freight,
          }),
        ),
      ).toBe(expected);
    },
  );

  it.each([
    ["", "2300", "36", "12", "72"],
    ["PURCHASE", "", "36", "12", "72"],
    ["PURCHASE", "2300", "", "12", "72"],
    ["PURCHASE", "2300", "36.00001", "12", "72"],
    ["PURCHASE", "2300", "-1", "12", "72"],
    ["PURCHASE", "100000000000000", "0", "0", "0"],
    ["PURCHASE", "99999999999999.9999", "0.0001", "0", "0"],
  ] as const)(
    "returns an empty preview for incomplete or invalid decimal input",
    (direction, base, carriage, packaging, freight) => {
      expect(
        calculateMarketActualPrice(
          draft({
            direction,
            purchaseBasePrice: base,
            carriageBoardAmount: carriage,
            packagingAmount: packaging,
            freightAmount: freight,
          }),
        ),
      ).toBe("");
    },
  );
});

function draft(overrides: Partial<MarketDraft>): MarketDraft {
  return {
    productCode: "CORN",
    objectTypeCode: "FEED_MILL",
    regionCode: "230200",
    tradeDate: "2026-08-01",
    direction: "PURCHASE",
    purchaseBasePrice: "2300",
    saleBasePrice: null,
    carriageBoardAmount: "36",
    packagingAmount: "12",
    freightAmount: "72",
    packagingForm: "BULK",
    facts: {},
    ...overrides,
  };
}
