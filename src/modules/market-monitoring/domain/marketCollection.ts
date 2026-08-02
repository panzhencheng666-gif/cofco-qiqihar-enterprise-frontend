export interface MarketCollectionRecord {
  id: string;
  values: Readonly<Record<string, string | null>>;
  allowedActions: readonly string[];
  version: number;
}

export interface MarketCollectionCriteria {
  productCode: string;
  pageKind: string;
  pageNumber: number;
  pageSize: number;
  values: Readonly<Record<string, string>>;
}

export interface MarketFieldOption {
  value: string;
  label: string;
  sortOrder: number;
}

export interface MarketCoreField {
  code: string;
  label: string;
  controlType: string;
  unit: string | null;
  description?: string | null;
  precision: number | null;
  scale: number | null;
  sortOrder: number;
  options: readonly MarketFieldOption[];
}

export interface MarketFactField {
  code: string;
  label: string;
  valueType: string;
  unit: string | null;
  description: string | null;
  precision: number;
  scale: number;
  sortOrder: number;
}

export interface MarketFormDefinition {
  productCode: string;
  objectTypeCode: string | null;
  coreFields: readonly MarketCoreField[];
  groups: readonly {
    category: string;
    label: string;
    sortOrder: number;
    fields: readonly MarketFactField[];
  }[];
}

export interface MarketDraft {
  productCode: string;
  objectTypeCode: string;
  regionCode: string;
  tradeDate: string;
  direction: string;
  purchaseBasePrice: string | null;
  saleBasePrice: string | null;
  carriageBoardAmount: string;
  packagingAmount: string;
  freightAmount: string;
  packagingForm: string | null;
  facts: Readonly<Record<string, string>>;
}

export interface MarketRecordDetail extends MarketDraft {
  id: string;
  reportedAt: string;
  actualTradePrice: string;
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  version: number;
}

export type MarketDraftCoreField = Exclude<keyof MarketDraft, "productCode" | "facts">;
export type MarketDisplayCoreField =
  MarketDraftCoreField | "actualTradePrice" | "reportedAt";

const draftFields: Readonly<Record<string, MarketDisplayCoreField>> = {
  MKT_OBJECT_TYPE: "objectTypeCode",
  MKT_REGION: "regionCode",
  MKT_TRADE_DATE: "tradeDate",
  MKT_REPORTED_AT: "reportedAt",
  MKT_TRADE_DIRECTION: "direction",
  MKT_PURCHASE_BASE_PRICE: "purchaseBasePrice",
  MKT_SALE_BASE_PRICE: "saleBasePrice",
  MKT_CARRIAGE_BOARD_AMOUNT: "carriageBoardAmount",
  MKT_PACKAGING_FORM: "packagingForm",
  MKT_PACKAGING_AMOUNT: "packagingAmount",
  MKT_FREIGHT_AMOUNT: "freightAmount",
  MKT_ACTUAL_TRADE_PRICE: "actualTradePrice",
};
const maximumMarketAmountUnits = 999_999_999_999_999_999n;

export const marketCoreFieldCodes = new Set(Object.keys(draftFields));

export function marketDraftField(code: string) {
  const field = draftFields[code];
  if (!field) throw new Error(`Unsupported market core field: ${code}`);
  return field;
}

export function calculateMarketActualPrice(draft: MarketDraft): string {
  const base =
    draft.direction === "PURCHASE"
      ? draft.purchaseBasePrice
      : draft.direction === "SALE"
        ? draft.saleBasePrice
        : null;
  const amounts = [
    base,
    draft.carriageBoardAmount,
    draft.packagingAmount,
    draft.freightAmount,
  ].map(decimalUnits);
  let total = 0n;
  for (const amount of amounts) {
    if (amount === undefined) return "";
    total += amount;
    if (total > maximumMarketAmountUnits) return "";
  }
  return formatUnits(total);
}

function decimalUnits(value: string | null): bigint | undefined {
  if (value === null || !/^(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(value)) {
    return undefined;
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const units = BigInt(whole || "0") * 10_000n + BigInt(fraction.padEnd(4, "0"));
  return units <= maximumMarketAmountUnits ? units : undefined;
}

function formatUnits(value: bigint): string {
  const whole = value / 10_000n;
  const fraction = String(value % 10_000n).padStart(4, "0");
  return `${String(whole)}.${fraction}`;
}
