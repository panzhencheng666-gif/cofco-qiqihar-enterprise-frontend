import { createHash } from "node:crypto";

export type MarketProductCode = "CORN" | "SOYBEAN" | "RICE";

export type MarketFactCode = keyof typeof marketFactDefinitions;

export const marketContractVersion = "V22";
export const backendMarketContractSha256 =
  "0efc5505da3daff584e7af903e2dba0ca58e513aa56c9e5ba5ae4c61a77a7ac2";

export const marketFactDefinitions = {
  MOISTURE: fact("QUALITY", "水分", "%", 10, 1),
  TEST_WEIGHT: fact("QUALITY", "容重", "克/升", 20, 0),
  IMPURITY: fact("QUALITY", "杂质", "%", 30, 1),
  IMPERFECT_GRAIN: fact("QUALITY", "不完善粒", "%", 40, 1),
  MILDEW: fact("QUALITY", "霉变", "%", 50, 1),
  PROTEIN: fact("QUALITY", "蛋白", "%", 60, 1),
  OIL_YIELD: fact("QUALITY", "出油率", "%", 70, 1),
  MILLING_YIELD: fact("QUALITY", "出米率", "%", 80, 1),
  BROWN_RICE_YIELD: fact("QUALITY", "出糙率", "%", 90, 1),
  PURCHASE_VOLUME: fact("PURCHASE", "采购量", "吨", 100, 4),
  SALES_VOLUME: fact("SALES", "销售量", "吨", 110, 4),
  PROCESSING_INPUT: fact("PROCESSING", "加工投入量", "吨/日", 120, 4),
  MAIN_OUTPUT: fact("PROCESSING", "主产品产出量", "吨/日", 130, 4),
  BYPRODUCT_OUTPUT: fact("PROCESSING", "副产品产出量", "吨/日", 140, 4),
  PROCESSING_LOSS: fact("PROCESSING", "加工损耗", "吨/日", 150, 4),
  OPENING_INVENTORY: fact("INVENTORY", "期初库存", "吨", 160, 4),
  STOCK_INFLOW: fact("INVENTORY", "入库量", "吨", 170, 4),
  STOCK_OUTFLOW: fact("INVENTORY", "出库量", "吨", 180, 4),
  STORAGE_LOSS: fact("INVENTORY", "保管损耗", "吨", 190, 4),
  ENDING_INVENTORY: fact("INVENTORY", "期末库存", "吨", 200, 4),
} as const;

export const marketCoreFieldDefinitions = [
  coreDefinition(
    "MKT_OBJECT_TYPE",
    "对象类型",
    "SELECT",
    10,
    "OBJECT_TYPE",
    "OBJECT_TYPE_CONTEXT",
    true,
  ),
  coreDefinition(
    "MKT_REGION",
    "地区",
    "REGION_HIERARCHY",
    20,
    "REGION",
    "GENERIC",
    true,
  ),
  coreDefinition(
    "MKT_TRADE_DATE",
    "交易日期",
    "DATE",
    30,
    "TRADE_DATE",
    "GENERIC",
    true,
  ),
  coreDefinition(
    "MKT_REPORTED_AT",
    "填报时间",
    "READONLY_DATETIME",
    35,
    "REPORTED_AT",
    "GENERIC",
    false,
  ),
  coreDefinition(
    "MKT_TRADE_DIRECTION",
    "买卖方向",
    "SELECT",
    40,
    "TRADE_DIRECTION",
    "PRICE_DIRECTION",
    true,
    null,
    null,
    [
      { value: "PURCHASE", label: "采购", sortOrder: 10 },
      { value: "SALE", label: "销售", sortOrder: 20 },
    ],
  ),
  coreDefinition(
    "MKT_PURCHASE_BASE_PRICE",
    "采购基础价",
    "DECIMAL",
    50,
    "PURCHASE_BASE_PRICE",
    "PURCHASE_BASE_PRICE",
    false,
    "元/吨",
    "采购基础价未包含车板、包装和运费组成",
  ),
  coreDefinition(
    "MKT_SALE_BASE_PRICE",
    "销售基础价",
    "DECIMAL",
    60,
    "SALE_BASE_PRICE",
    "SALE_BASE_PRICE",
    false,
    "元/吨",
    "销售基础价未包含车板、包装和运费组成",
  ),
  coreDefinition(
    "MKT_CARRIAGE_BOARD_AMOUNT",
    "车板组成",
    "DECIMAL",
    70,
    "CARRIAGE_BOARD_AMOUNT",
    "PRICE_COMPONENT",
    true,
    "元/吨",
  ),
  coreDefinition(
    "MKT_PACKAGING_FORM",
    "包装形态",
    "SELECT",
    80,
    "PACKAGING_FORM",
    "GENERIC",
    true,
    null,
    null,
    [
      { value: "BAGGED", label: "包粮", sortOrder: 10 },
      { value: "BULK", label: "散粮", sortOrder: 20 },
    ],
  ),
  coreDefinition(
    "MKT_PACKAGING_AMOUNT",
    "包装组成",
    "DECIMAL",
    90,
    "PACKAGING_AMOUNT",
    "PRICE_COMPONENT",
    true,
    "元/吨",
  ),
  coreDefinition(
    "MKT_FREIGHT_AMOUNT",
    "运费组成",
    "DECIMAL",
    100,
    "FREIGHT_AMOUNT",
    "PRICE_COMPONENT",
    true,
    "元/吨",
  ),
  coreDefinition(
    "MKT_SOURCE_NOTE",
    "来源说明",
    "TEXT",
    105,
    "EXTENSION",
    "GENERIC",
    false,
  ),
  coreDefinition(
    "MKT_ACTUAL_TRADE_PRICE",
    "实际成交价",
    "READONLY_DECIMAL",
    110,
    "ACTUAL_TRADE_PRICE",
    "ACTUAL_TRADE_PRICE",
    false,
    "元/吨",
    "实际成交价已包含车板、包装和运费组成",
  ),
] as const;

const commonFlow = orders(
  ["PURCHASE_VOLUME", 60],
  ["SALES_VOLUME", 70],
  ["OPENING_INVENTORY", 80],
  ["STOCK_INFLOW", 90],
  ["STOCK_OUTFLOW", 100],
  ["STORAGE_LOSS", 110],
  ["ENDING_INVENTORY", 120],
);
const processorFlow = orders(
  ["PURCHASE_VOLUME", 100],
  ["PROCESSING_INPUT", 110],
  ["MAIN_OUTPUT", 120],
  ["BYPRODUCT_OUTPUT", 130],
  ["PROCESSING_LOSS", 140],
  ["OPENING_INVENTORY", 150],
  ["STOCK_INFLOW", 160],
  ["STOCK_OUTFLOW", 170],
  ["STORAGE_LOSS", 180],
  ["ENDING_INVENTORY", 190],
);
const cornQuality = orders(
  ["MOISTURE", 10],
  ["TEST_WEIGHT", 20],
  ["IMPURITY", 30],
  ["IMPERFECT_GRAIN", 40],
  ["MILDEW", 50],
);
const soybeanTradeQuality = orders(
  ["MOISTURE", 10],
  ["IMPURITY", 30],
  ["IMPERFECT_GRAIN", 40],
  ["PROTEIN", 51],
  ["OIL_YIELD", 52],
);
const soybeanProcessorQuality = orders(
  ["MOISTURE", 10],
  ["IMPURITY", 30],
  ["IMPERFECT_GRAIN", 40],
  ["PROTEIN", 60],
  ["OIL_YIELD", 70],
);
const riceTradeQuality = orders(
  ["MOISTURE", 10],
  ["IMPURITY", 30],
  ["MILLING_YIELD", 51],
  ["BROWN_RICE_YIELD", 52],
);
const riceProcessorQuality = orders(
  ["MOISTURE", 10],
  ["IMPURITY", 30],
  ["IMPERFECT_GRAIN", 40],
  ["MILLING_YIELD", 80],
  ["BROWN_RICE_YIELD", 90],
);

export const marketProducts = {
  CORN: product("玉米", "DEEP_PROCESSOR", "MOISTURE", {
    TRADER: object("贸易商", 110, cornQuality, commonFlow),
    DEEP_PROCESSOR: object("深加工", 120, cornQuality, processorFlow),
    WHOLESALE_MARKET: object("批发市场", 130, cornQuality, commonFlow),
    RESERVE_ENTERPRISE: object("承储企业", 140, cornQuality, commonFlow),
    BREEDING_FACTORY: object(
      "养殖厂",
      160,
      cornQuality,
      orders(["PURCHASE_VOLUME", 60], ["ENDING_INVENTORY", 70]),
    ),
    FEED_MILL: object(
      "饲料厂",
      170,
      cornQuality,
      orders(
        ["PURCHASE_VOLUME", 60],
        ["PROCESSING_INPUT", 70],
        ["ENDING_INVENTORY", 80],
      ),
    ),
  }),
  SOYBEAN: product("大豆", "DEEP_PROCESSOR", "PROTEIN", {
    TRADER: object("贸易商", 110, soybeanTradeQuality, commonFlow),
    DEEP_PROCESSOR: object("深加工", 120, soybeanProcessorQuality, processorFlow),
    WHOLESALE_MARKET: object("批发市场", 130, soybeanTradeQuality, commonFlow),
    RESERVE_ENTERPRISE: object("承储企业", 140, soybeanTradeQuality, commonFlow),
  }),
  RICE: product("稻谷", "RICE_MILL", "MILLING_YIELD", {
    TRADER: object("贸易商", 110, riceTradeQuality, commonFlow),
    DEEP_PROCESSOR: object("深加工", 120, riceProcessorQuality, processorFlow),
    WHOLESALE_MARKET: object("批发市场", 130, riceTradeQuality, commonFlow),
    RESERVE_ENTERPRISE: object("承储企业", 140, riceTradeQuality, commonFlow),
    RICE_MILL: object(
      "米厂",
      150,
      orders(
        ["MOISTURE", 10],
        ["MILLING_YIELD", 20],
        ["BROWN_RICE_YIELD", 30],
        ["IMPURITY", 40],
        ["PURCHASE_VOLUME", 50],
        ["PROCESSING_INPUT", 60],
        ["MAIN_OUTPUT", 70],
        ["BYPRODUCT_OUTPUT", 80],
        ["PROCESSING_LOSS", 90],
        ["ENDING_INVENTORY", 100],
      ),
    ),
  }),
} as const;

export const canonicalMarketContract = `${[
  ...Object.entries(marketProducts).flatMap(([productCode, product]) =>
    Object.entries(product.objects).flatMap(([objectCode, object]) => [
      `OBJECT|${productCode}|${objectCode}|${object.label}|${object.sortOrder}`,
      ...object.facts.map((factCode) => {
        const definition = marketFactDefinitions[factCode];
        return [
          "FACT",
          productCode,
          objectCode,
          factCode,
          definition.category,
          definition.label,
          definition.unit,
          18,
          definition.scale,
          object.factSortOrders[factCode],
        ].join("|");
      }),
    ]),
  ),
  ...Object.keys(marketProducts).flatMap((productCode) =>
    marketCoreFieldDefinitions.map((definition) =>
      [
        "CORE",
        productCode,
        definition.code,
        definition.label,
        definition.controlType,
        definition.unit ?? "",
        definition.precision ?? "",
        definition.scale ?? "",
        definition.sortOrder,
        definition.domainBinding,
        definition.capability,
        definition.required ? "t" : "f",
        definition.pageSortOrder,
      ].join("|"),
    ),
  ),
]
  .sort()
  .join("\n")}\n`;

export const marketContractSha256 = createHash("sha256")
  .update(canonicalMarketContract, "utf8")
  .digest("hex");

function fact(
  category: "QUALITY" | "PURCHASE" | "SALES" | "PROCESSING" | "INVENTORY",
  label: string,
  unit: string,
  sortOrder: number,
  scale: number,
) {
  return { category, label, unit, sortOrder, scale };
}

function coreDefinition(
  code: string,
  label: string,
  controlType: string,
  sortOrder: number,
  domainBinding: string,
  capability: string,
  required: boolean,
  unit: string | null = null,
  description: string | null = null,
  options: readonly { value: string; label: string; sortOrder: number }[] = [],
) {
  const decimal = controlType.includes("DECIMAL");
  return {
    code,
    label,
    controlType,
    unit,
    description,
    domainBinding,
    capability,
    required,
    precision: decimal ? 18 : null,
    scale: decimal ? 4 : null,
    sortOrder,
    pageSortOrder: pageSortOrder(code),
    options,
  };
}

function pageSortOrder(code: string) {
  const orders: Record<string, number> = {
    MKT_REGION: 10,
    MKT_OBJECT_TYPE: 20,
    MKT_TRADE_DATE: 30,
    MKT_REPORTED_AT: 32,
    MKT_TRADE_DIRECTION: 35,
    MKT_PURCHASE_BASE_PRICE: 40,
    MKT_SALE_BASE_PRICE: 50,
    MKT_CARRIAGE_BOARD_AMOUNT: 55,
    MKT_PACKAGING_FORM: 56,
    MKT_PACKAGING_AMOUNT: 57,
    MKT_FREIGHT_AMOUNT: 58,
    MKT_SOURCE_NOTE: 59,
    MKT_ACTUAL_TRADE_PRICE: 60,
  };
  return orders[code];
}

function orders(...entries: readonly (readonly [MarketFactCode, number])[]) {
  return Object.fromEntries(entries) as Partial<Record<MarketFactCode, number>>;
}

function object(
  label: string,
  sortOrder: number,
  ...groups: readonly Partial<Record<MarketFactCode, number>>[]
) {
  const factSortOrders = Object.assign({}, ...groups) as Partial<
    Record<MarketFactCode, number>
  >;
  const facts = (Object.entries(factSortOrders) as [MarketFactCode, number][])
    .sort(([leftCode, leftOrder], [rightCode, rightOrder]) =>
      leftOrder === rightOrder
        ? leftCode.localeCompare(rightCode)
        : leftOrder - rightOrder,
    )
    .map(([code]) => code);
  return { label, sortOrder, facts, factSortOrders };
}

function product<
  TQuality extends MarketFactCode,
  TObjects extends Record<string, ReturnType<typeof object>>,
>(
  name: string,
  defaultObject: keyof TObjects & string,
  qualityCode: TQuality,
  objects: TObjects,
) {
  return {
    name,
    defaultObject,
    qualityCode,
    qualityLabel: marketFactDefinitions[qualityCode].label,
    objects,
  };
}
