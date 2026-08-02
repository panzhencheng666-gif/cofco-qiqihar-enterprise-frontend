export type MarketProductCode = "CORN" | "SOYBEAN" | "RICE";

export type MarketFactCode = keyof typeof marketFactDefinitions;

export const marketFactDefinitions = {
  MOISTURE: fact("QUALITY", "水分", "%", 10),
  TEST_WEIGHT: fact("QUALITY", "容重", "克/升", 20),
  IMPURITY: fact("QUALITY", "杂质", "%", 30),
  IMPERFECT_GRAIN: fact("QUALITY", "不完善粒", "%", 40),
  MILDEW: fact("QUALITY", "霉变", "%", 50),
  PROTEIN: fact("QUALITY", "蛋白质", "%", 60),
  OIL_YIELD: fact("QUALITY", "出油率", "%", 70),
  MILLING_YIELD: fact("QUALITY", "出米率", "%", 80),
  BROWN_RICE_YIELD: fact("QUALITY", "出糙率", "%", 90),
  PURCHASE_VOLUME: fact("PURCHASE", "采购量", "吨", 100),
  SALES_VOLUME: fact("SALES", "销售量", "吨", 110),
  PROCESSING_INPUT: fact("PROCESSING", "加工投入量", "吨/日", 120),
  MAIN_OUTPUT: fact("PROCESSING", "主产品产出量", "吨/日", 130),
  BYPRODUCT_OUTPUT: fact("PROCESSING", "副产品产出量", "吨/日", 140),
  PROCESSING_LOSS: fact("PROCESSING", "加工损耗", "吨/日", 150),
  OPENING_INVENTORY: fact("INVENTORY", "期初库存", "吨", 160),
  STOCK_INFLOW: fact("INVENTORY", "入库量", "吨", 170),
  STOCK_OUTFLOW: fact("INVENTORY", "出库量", "吨", 180),
  STORAGE_LOSS: fact("INVENTORY", "保管损耗", "吨", 190),
  ENDING_INVENTORY: fact("INVENTORY", "期末库存", "吨", 200),
} as const;

const commonFlow = [
  "PURCHASE_VOLUME",
  "SALES_VOLUME",
  "OPENING_INVENTORY",
  "STOCK_INFLOW",
  "STOCK_OUTFLOW",
  "STORAGE_LOSS",
  "ENDING_INVENTORY",
] as const;
const processorFlow = [
  "PURCHASE_VOLUME",
  "PROCESSING_INPUT",
  "MAIN_OUTPUT",
  "BYPRODUCT_OUTPUT",
  "PROCESSING_LOSS",
  "OPENING_INVENTORY",
  "STOCK_INFLOW",
  "STOCK_OUTFLOW",
  "STORAGE_LOSS",
  "ENDING_INVENTORY",
] as const;
const cornQuality = [
  "MOISTURE",
  "TEST_WEIGHT",
  "IMPURITY",
  "IMPERFECT_GRAIN",
  "MILDEW",
] as const;
const soybeanQuality = [
  "MOISTURE",
  "IMPURITY",
  "IMPERFECT_GRAIN",
  "PROTEIN",
  "OIL_YIELD",
] as const;
const riceTradeQuality = [
  "MOISTURE",
  "IMPURITY",
  "MILLING_YIELD",
  "BROWN_RICE_YIELD",
] as const;
const riceProcessorQuality = [
  "MOISTURE",
  "IMPURITY",
  "IMPERFECT_GRAIN",
  "MILLING_YIELD",
  "BROWN_RICE_YIELD",
] as const;

export const marketProducts = {
  CORN: product("玉米", "DEEP_PROCESSOR", "MOISTURE", {
    TRADER: object("贸易商", [...cornQuality, ...commonFlow]),
    DEEP_PROCESSOR: object("深加工企业", [...cornQuality, ...processorFlow]),
    WHOLESALE_MARKET: object("批发市场", [...cornQuality, ...commonFlow]),
    RESERVE_ENTERPRISE: object("储备企业", [...cornQuality, ...commonFlow]),
    BREEDING_FACTORY: object("养殖场", [
      ...cornQuality,
      "PURCHASE_VOLUME",
      "ENDING_INVENTORY",
    ]),
    FEED_MILL: object("饲料厂", [
      ...cornQuality,
      "PURCHASE_VOLUME",
      "PROCESSING_INPUT",
      "ENDING_INVENTORY",
    ]),
  }),
  SOYBEAN: product("大豆", "DEEP_PROCESSOR", "PROTEIN", {
    TRADER: object("贸易商", [...soybeanQuality, ...commonFlow]),
    DEEP_PROCESSOR: object("深加工企业", [...soybeanQuality, ...processorFlow]),
    WHOLESALE_MARKET: object("批发市场", [...soybeanQuality, ...commonFlow]),
    RESERVE_ENTERPRISE: object("储备企业", [...soybeanQuality, ...commonFlow]),
  }),
  RICE: product("稻谷", "RICE_MILL", "MILLING_YIELD", {
    TRADER: object("贸易商", [...riceTradeQuality, ...commonFlow]),
    DEEP_PROCESSOR: object("深加工企业", [...riceProcessorQuality, ...processorFlow]),
    WHOLESALE_MARKET: object("批发市场", [...riceTradeQuality, ...commonFlow]),
    RESERVE_ENTERPRISE: object("储备企业", [...riceTradeQuality, ...commonFlow]),
    RICE_MILL: object("米厂", [
      "MOISTURE",
      "MILLING_YIELD",
      "BROWN_RICE_YIELD",
      "IMPURITY",
      "PURCHASE_VOLUME",
      "PROCESSING_INPUT",
      "MAIN_OUTPUT",
      "BYPRODUCT_OUTPUT",
      "PROCESSING_LOSS",
      "ENDING_INVENTORY",
    ]),
  }),
} as const;

function fact(
  category: "QUALITY" | "PURCHASE" | "SALES" | "PROCESSING" | "INVENTORY",
  label: string,
  unit: string,
  sortOrder: number,
) {
  return { category, label, unit, sortOrder };
}

function object(label: string, facts: readonly MarketFactCode[]) {
  return { label, facts };
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
