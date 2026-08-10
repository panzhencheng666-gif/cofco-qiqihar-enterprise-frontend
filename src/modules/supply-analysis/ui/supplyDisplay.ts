const expressionTerms: Readonly<Record<string, string>> = {
  OPENING_INVENTORY: "期初库存",
  LOCAL_PRODUCTION: "本地生产",
  EXTERNAL_INFLOW: "区域外流入",
  IMPORTS: "进口",
  OTHER_SUPPLY: "其他供给",
  TOTAL_SUPPLY: "总供给",
  FOOD_USE: "口粮消费",
  FEED_USE: "饲用消费",
  SEED_USE: "种用消费",
  PROCESSING_USE: "加工投入",
  LOSS_USE: "损耗",
  EXTERNAL_OUTFLOW: "区域外流出",
  EXPORTS: "出口",
  OTHER_USE: "其他使用",
  TOTAL_USE: "总使用",
  CALCULATED_ENDING_INVENTORY: "计算期末库存",
  APPROVED_ADJUSTMENT: "已批准调整",
  ADOPTED_ENDING_INVENTORY: "采用后账面期末库存",
  SURVEYED_ENDING_INVENTORY: "调查期末库存",
  INVENTORY_RECONCILIATION_DIFFERENCE: "库存核对差额",
};

export function sourceDomainLabel(value: string) {
  if (value === "PRODUCTION") return "产情监测";
  if (value === "LOGISTICS") return "物流监测";
  return "其他已审核业务";
}

export function qualityStateLabel(value: string) {
  if (value === "PASSED") return "数据质量通过";
  if (value === "WARNING") return "数据需要关注";
  if (value === "BLOCKING") return "数据不可采用";
  return "数据质量待确认";
}

export function approvalStateLabel(value: string) {
  if (value === "APPROVED") return "已审核";
  if (value === "PENDING") return "待审核";
  if (value === "REJECTED" || value === "RETURNED") return "已退回";
  return "审核状态待确认";
}

export function roleGroupLabel(value: string) {
  if (value === "SUPPLY") return "供给项目";
  if (value === "USE") return "使用项目";
  if (value === "INVENTORY" || value === "RECONCILIATION") return "库存项目";
  return "其他项目";
}

export function resultStateLabel(value: string) {
  if (value === "DRAFT") return "草稿";
  if (value === "CONFIRMED") return "已确认";
  if (value === "PUBLISHED") return "已发布";
  return "结果状态待确认";
}

export function balanceReasonLabel(value: string) {
  if (value === "WITHIN_TOLERANCE") return "库存差额在允许范围内";
  if (value === "OUTSIDE_BALANCE_TOLERANCE") return "库存差额超出允许范围";
  return validationCodeLabel(value);
}

export function validationCodeLabel(value: string) {
  if (value === "OUTSIDE_BALANCE_TOLERANCE") {
    return "库存差额超出允许范围";
  }
  return /[A-Z_]/.test(value) ? "计算校验未通过，请联系供需业务负责人" : value;
}

export function formulaExpressionLabel(expression: string) {
  let unknown = false;
  const translated = expression.replace(/[A-Z][A-Z_]*/g, (term) => {
    const label = expressionTerms[term];
    if (!label) unknown = true;
    return label ?? term;
  });
  if (unknown) return "计算规则已由系统核对";
  return translated.replaceAll(" + ", " ＋ ").replaceAll(" - ", " － ");
}

export function chineseDateTime(value: string | null | undefined) {
  if (!value) return "时间未提供";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未提供";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}
