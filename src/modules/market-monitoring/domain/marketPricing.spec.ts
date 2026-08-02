import {
  calculateMarketActualPrice,
  type MarketCoreCapability,
  type MarketCoreField,
} from "./marketCollection";

describe("calculateMarketActualPrice", () => {
  it.each([
    ["PURCHASE", "2300", null, "36", "12", "72", "2420.0000"],
    ["SALE", null, "2400.1", ".2", "0.30", "0.0000", "2400.6000"],
    ["PURCHASE", "1.00005", null, "0", "0", "0", "1.0001"],
    ["PURCHASE", "1.00005", null, "0.00005", "0.00005", "0.00005", "1.0004"],
  ] as const)(
    "calculates an exact %s preview using per-item HALF_UP rounding",
    (direction, purchase, sale, carriage, packaging, freight, expected) => {
      expect(
        calculateMarketActualPrice(
          values(direction, purchase, sale, carriage, packaging, freight),
          fields,
        ),
      ).toBe(expected);
    },
  );

  it.each([
    ["", "2300", "36", "12", "72"],
    ["PURCHASE", "", "36", "12", "72"],
    ["SALE", "2300", "36", "12", "72"],
    ["PURCHASE", "2300", "", "12", "72"],
    ["PURCHASE", "2300", "-1", "12", "72"],
    ["PURCHASE", "+2300", "36", "12", "72"],
    ["PURCHASE", "1e3", "36", "12", "72"],
    ["PURCHASE", "1E3", "36", "12", "72"],
    ["PURCHASE", "100000000000000", "0", "0", "0"],
    ["PURCHASE", "99999999999999.9999", "0.0001", "0", "0"],
  ] as const)(
    "returns an empty preview for incomplete, switched-base, negative, or range-invalid input",
    (direction, base, carriage, packaging, freight) => {
      expect(
        calculateMarketActualPrice(
          values(direction, base, null, carriage, packaging, freight),
          fields,
        ),
      ).toBe("");
    },
  );
});

function values(
  direction: string,
  purchase: string | null,
  sale: string | null,
  carriage: string,
  packaging: string,
  freight: string,
) {
  return {
    direction,
    purchase,
    sale,
    carriage,
    packaging,
    freight,
  };
}

const fields: readonly MarketCoreField[] = [
  field("direction", "PRICE_DIRECTION"),
  field("purchase", "PURCHASE_BASE_PRICE"),
  field("sale", "SALE_BASE_PRICE"),
  field("carriage", "PRICE_COMPONENT"),
  field("packaging", "PRICE_COMPONENT"),
  field("freight", "PRICE_COMPONENT"),
  field("actual", "ACTUAL_TRADE_PRICE", "READONLY_DECIMAL"),
];

function field(
  code: string,
  capability: MarketCoreCapability,
  controlType: MarketCoreField["controlType"] = "DECIMAL",
): MarketCoreField {
  return {
    code,
    label: code,
    controlType,
    capability,
    required: false,
    unit: null,
    description: null,
    precision: 18,
    scale: 4,
    sortOrder: 10,
    options: [],
  };
}
