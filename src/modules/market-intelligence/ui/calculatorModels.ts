export interface CalculatorField {
  key: string;
  label: string;
  unit: string;
  allowNegative?: boolean;
}

export interface CalculatorModel {
  id: string;
  title: string;
  group: string;
  unit: string;
  expression: string;
  fields: readonly CalculatorField[];
  calculate: (values: Record<string, number>) => number;
}

const field = (
  key: string,
  label: string,
  unit: string,
  allowNegative = false,
): CalculatorField => ({ key, label, unit, allowNegative });
const rate = (value: number) => value / 100;

export const calculatorModels: readonly CalculatorModel[] = [
  {
    id: "soy-domestic",
    title: "国产大豆压榨利润",
    group: "油脂油料",
    unit: "元/吨大豆",
    expression: "豆粕价 × 出粕率 + 豆油价 × 出油率 − 国产大豆价 − 加工费 − 其他费用",
    fields: [
      field("meal", "豆粕成交价", "元/吨"),
      field("mealYield", "实际出粕率", "%"),
      field("oil", "豆油成交价", "元/吨"),
      field("oilYield", "实际出油率", "%"),
      field("soy", "国产大豆采购价", "元/吨"),
      field("processing", "加工费", "元/吨"),
      field("other", "其他费用", "元/吨"),
    ],
    calculate: (v) =>
      v.meal! * rate(v.mealYield!) +
      v.oil! * rate(v.oilYield!) -
      v.soy! -
      v.processing! -
      v.other!,
  },
  {
    id: "soy-imported",
    title: "进口大豆压榨利润",
    group: "油脂油料",
    unit: "元/吨大豆",
    expression:
      "豆粕价 × 出粕率 + 豆油价 × 出油率 − 进口大豆到厂成本 − 加工费 − 其他费用",
    fields: [
      field("meal", "豆粕成交价", "元/吨"),
      field("mealYield", "实际出粕率", "%"),
      field("oil", "豆油成交价", "元/吨"),
      field("oilYield", "实际出油率", "%"),
      field("soy", "进口大豆到厂成本", "元/吨"),
      field("processing", "加工费", "元/吨"),
      field("other", "其他费用", "元/吨"),
    ],
    calculate: (v) =>
      v.meal! * rate(v.mealYield!) +
      v.oil! * rate(v.oilYield!) -
      v.soy! -
      v.processing! -
      v.other!,
  },
  {
    id: "wet-dry",
    title: "潮粮折干成本",
    group: "玉米与谷物",
    unit: "元/吨干粮",
    expression:
      "潮粮价格 × 单位换算倍数 ÷ [1 − (潮粮水分 − 目标水分) × 合同折扣系数 / 100] + 烘干损耗费",
    fields: [
      field("wetPrice", "潮粮价格", "报价单位"),
      field("conversion", "单位换算倍数", "倍"),
      field("wetMoisture", "潮粮实测水分", "%"),
      field("targetMoisture", "目标水分", "%"),
      field("discount", "合同折扣系数", "每百分点"),
      field("drying", "烘干及损耗费", "元/吨"),
    ],
    calculate: (v) =>
      (v.wetPrice! * v.conversion!) /
        (1 - (v.wetMoisture! - v.targetMoisture!) * rate(v.discount!)) +
      v.drying!,
  },
  {
    id: "grain-chain",
    title: "毛粮—净粮—塔粮价格",
    group: "玉米与谷物",
    unit: "元/吨",
    expression: "塔粮价 = 毛粮价 + 净粮升贴水 + 烘干及塔粮附加费",
    fields: [
      field("raw", "毛粮价格", "元/吨"),
      field("premium", "净粮升贴水", "元/吨", true),
      field("tower", "烘干及塔粮附加费", "元/吨"),
    ],
    calculate: (v) => v.raw! + v.premium! + v.tower!,
  },
  {
    id: "feed-rice",
    title: "饲用糙米混合物出厂成本",
    group: "饲料与加工",
    unit: "元/吨混合物",
    expression:
      "[(稻谷底价 + 交易/出库/运输/加工费 − 副产品收益) ÷ 出糙率] × 糙米配比 + 替代谷物到场价 × 替代配比 + 资金损耗",
    fields: [
      field("paddy", "稻谷拍卖底价", "元/吨"),
      field("fees", "交易出库运输加工费", "元/吨"),
      field("byproduct", "副产品收益", "元/吨"),
      field("yield", "出糙率", "%"),
      field("riceShare", "糙米配比", "%"),
      field("alternate", "替代谷物到场价", "元/吨"),
      field("alternateShare", "替代谷物配比", "%"),
      field("finance", "资金及损耗", "元/吨"),
    ],
    calculate: (v) =>
      ((v.paddy! + v.fees! - v.byproduct!) / rate(v.yield!)) * rate(v.riceShare!) +
      v.alternate! * rate(v.alternateShare!) +
      v.finance!,
  },
  {
    id: "landed",
    title: "进口粮食到厂成本",
    group: "贸易与物流",
    unit: "元/吨",
    expression:
      "(FOB价 + 海运费 + 保险费) × 汇率 × (1 + 适用税费率) + 港杂费 + 国内运费 + 资金损耗",
    fields: [
      field("fob", "FOB报价", "美元/吨"),
      field("freight", "国际运费", "美元/吨"),
      field("insurance", "保险费", "美元/吨"),
      field("fx", "结算汇率", "元/美元"),
      field("tax", "适用税费率", "%"),
      field("port", "港杂费", "元/吨"),
      field("inland", "国内运费", "元/吨"),
      field("finance", "资金及损耗", "元/吨"),
    ],
    calculate: (v) =>
      (v.fob! + v.freight! + v.insurance!) * v.fx! * (1 + rate(v.tax!)) +
      v.port! +
      v.inland! +
      v.finance!,
  },
  {
    id: "wheat-maize",
    title: "小麦玉米替代比价",
    group: "玉米与谷物",
    unit: "倍",
    expression: "同区域同品质小麦到场价 ÷ 玉米到场价",
    fields: [
      field("wheat", "小麦到场价", "元/吨"),
      field("maize", "玉米到场价", "元/吨"),
    ],
    calculate: (v) => v.wheat! / v.maize!,
  },
  {
    id: "wheat-delivery",
    title: "小麦升贴水与出库成本",
    group: "玉米与谷物",
    unit: "元/吨",
    expression: "小麦基准价 + 品质升贴水 + 出库费 + 运输损耗",
    fields: [
      field("benchmark", "小麦基准价", "元/吨"),
      field("premium", "品质升贴水", "元/吨", true),
      field("warehouse", "出库费", "元/吨"),
      field("loss", "运输损耗", "元/吨"),
    ],
    calculate: (v) => v.benchmark! + v.premium! + v.warehouse! + v.loss!,
  },
  {
    id: "flour",
    title: "小麦制粉利润",
    group: "饲料与加工",
    unit: "元/吨小麦",
    expression: "面粉售价 × 出粉率 + 麸皮及副产品收益 − 小麦到厂价 − 加工及能源费",
    fields: [
      field("flour", "面粉售价", "元/吨"),
      field("yield", "实际出粉率", "%"),
      field("byproduct", "麸皮及副产品收益", "元/吨小麦"),
      field("wheat", "小麦到厂价", "元/吨"),
      field("processing", "加工及能源费", "元/吨"),
    ],
    calculate: (v) =>
      v.flour! * rate(v.yield!) + v.byproduct! - v.wheat! - v.processing!,
  },
  {
    id: "starch",
    title: "玉米淀粉加工利润",
    group: "饲料与加工",
    unit: "元/吨玉米",
    expression: "淀粉售价 × 得率 + 副产品收益 − 玉米到厂价 − 加工及能源费",
    fields: [
      field("product", "淀粉售价", "元/吨"),
      field("yield", "实际得率", "%"),
      field("byproduct", "副产品收益", "元/吨玉米"),
      field("corn", "玉米到厂价", "元/吨"),
      field("processing", "加工及能源费", "元/吨"),
    ],
    calculate: (v) =>
      v.product! * rate(v.yield!) + v.byproduct! - v.corn! - v.processing!,
  },
  {
    id: "ethanol",
    title: "玉米酒精加工利润",
    group: "饲料与加工",
    unit: "元/吨玉米",
    expression: "酒精售价 × 得率 + 副产品收益 − 玉米到厂价 − 加工及能源费",
    fields: [
      field("product", "酒精售价", "元/吨"),
      field("yield", "实际得率", "%"),
      field("byproduct", "副产品收益", "元/吨玉米"),
      field("corn", "玉米到厂价", "元/吨"),
      field("processing", "加工及能源费", "元/吨"),
    ],
    calculate: (v) =>
      v.product! * rate(v.yield!) + v.byproduct! - v.corn! - v.processing!,
  },
  {
    id: "storage-finance",
    title: "仓储资金占用成本",
    group: "资金与套保",
    unit: "元/吨",
    expression: "每吨库存货值 × 年化融资利率 × 占用天数 ÷ 计息天数 + 仓储费",
    fields: [
      field("value", "每吨库存货值", "元/吨"),
      field("interest", "年化融资利率", "%"),
      field("days", "占用天数", "天"),
      field("dayBasis", "合同计息天数", "天/年"),
      field("storage", "仓储费", "元/吨"),
    ],
    calculate: (v) =>
      (v.value! * rate(v.interest!) * v.days!) / v.dayBasis! + v.storage!,
  },
  {
    id: "fx-parity",
    title: "汇率利率平价",
    group: "资金与套保",
    unit: "元/美元",
    expression: "即期汇率 × (1 + 人民币期限利率) ÷ (1 + 美元期限利率)",
    fields: [
      field("spot", "即期汇率", "元/美元"),
      field("cnyRate", "同期限人民币利率", "%", true),
      field("usdRate", "同期限美元利率", "%", true),
    ],
    calculate: (v) => (v.spot! * (1 + rate(v.cnyRate!))) / (1 + rate(v.usdRate!)),
  },
  {
    id: "unit",
    title: "报价单位换算",
    group: "通用工具",
    unit: "目标单位",
    expression: "原报价 × 自填换算倍数；使用前核对重量、币种和报价基准",
    fields: [
      field("price", "原报价", "原单位"),
      field("factor", "换算倍数", "目标单位/原单位"),
    ],
    calculate: (v) => v.price! * v.factor!,
  },
  {
    id: "basis",
    title: "现货期货基差",
    group: "资金与套保",
    unit: "元/吨",
    expression: "同品质同交割地现货价 − 对应期货合约价",
    fields: [field("spot", "现货价", "元/吨"), field("futures", "期货价", "元/吨")],
    calculate: (v) => v.spot! - v.futures!,
  },
  {
    id: "stock-use",
    title: "库存消费比",
    group: "通用工具",
    unit: "%",
    expression: "期末库存 ÷ 同口径年度消费 × 100%",
    fields: [field("stock", "期末库存", "万吨"), field("use", "年度消费", "万吨")],
    calculate: (v) => (v.stock! / v.use!) * 100,
  },
];

export function calculateManual(
  model: CalculatorModel,
  raw: Record<string, string>,
): { value: number | null; error: string | null } {
  const values: Record<string, number> = {};
  for (const item of model.fields) {
    if (raw[item.key]?.trim() === "") return { value: null, error: "请填完全部输入项" };
    const value = Number(raw[item.key]);
    if (!Number.isFinite(value) || (!item.allowNegative && value < 0))
      return { value: null, error: `${item.label}需要有效数值` };
    if (item.unit === "%" && (value > 100 || (value < 0 && !item.allowNegative)))
      return { value: null, error: `${item.label}需在有效百分比范围内` };
    values[item.key] = value;
  }
  if (
    model.id === "feed-rice" &&
    Math.abs(values.riceShare! + values.alternateShare! - 100) > 0.001
  )
    return { value: null, error: "糙米与替代谷物配比之和必须为 100%" };
  if (model.id === "wet-dry" && values.wetMoisture! < values.targetMoisture!)
    return { value: null, error: "潮粮水分不能低于目标水分" };
  const result = model.calculate(values);
  if (!Number.isFinite(result)) return { value: null, error: "分母必须大于零" };
  if (
    (model.id === "wet-dry" &&
      1 - (values.wetMoisture! - values.targetMoisture!) * rate(values.discount!) <=
        0) ||
    (model.id === "fx-parity" && 1 + rate(values.usdRate!) <= 0) ||
    (model.id === "feed-rice" && values.yield! <= 0)
  )
    return { value: null, error: "输入导致无效分母" };
  return { value: result, error: null };
}
