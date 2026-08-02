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

export type MarketCoreControlType =
  | "SELECT"
  | "REGION_HIERARCHY"
  | "DATE"
  | "DECIMAL"
  | "TEXT"
  | "READONLY_DECIMAL"
  | "READONLY_DATETIME";

export type MarketCoreCapability =
  | "GENERIC"
  | "OBJECT_TYPE_CONTEXT"
  | "PRICE_DIRECTION"
  | "PURCHASE_BASE_PRICE"
  | "SALE_BASE_PRICE"
  | "PRICE_COMPONENT"
  | "ACTUAL_TRADE_PRICE";

export interface MarketCoreField {
  code: string;
  label: string;
  controlType: MarketCoreControlType;
  capability: MarketCoreCapability;
  required: boolean;
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
  coreValues: Readonly<Record<string, string | null>>;
  facts: Readonly<Record<string, string>>;
}

export interface MarketRecordDetail extends MarketDraft {
  id: string;
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  version: number;
}

const maximumMarketAmountUnits = 999_999_999_999_999_999n;

/** Mirrors MarketPricing: every submitted amount is HALF_UP rounded to scale 4 first. */
export function calculateMarketActualPrice(
  coreValues: Readonly<Record<string, string | null>>,
  fields: readonly MarketCoreField[],
): string {
  const directionField = singleCapability(fields, "PRICE_DIRECTION");
  const purchaseField = singleCapability(fields, "PURCHASE_BASE_PRICE");
  const saleField = singleCapability(fields, "SALE_BASE_PRICE");
  if (!directionField || !purchaseField || !saleField) return "";

  const direction = coreValues[directionField.code];
  const baseField =
    direction === "PURCHASE"
      ? purchaseField
      : direction === "SALE"
        ? saleField
        : undefined;
  if (!baseField) return "";

  const amountFields = [
    baseField,
    ...fields.filter((field) => field.capability === "PRICE_COMPONENT"),
  ];
  let total = 0n;
  for (const field of amountFields) {
    const amount = decimalUnits(coreValues[field.code]);
    if (amount === undefined) return "";
    total += amount;
    if (total > maximumMarketAmountUnits) return "";
  }
  return formatUnits(total);
}

export function objectTypeField(definition: MarketFormDefinition) {
  return singleCapability(definition.coreFields, "OBJECT_TYPE_CONTEXT");
}

function singleCapability(
  fields: readonly MarketCoreField[],
  capability: MarketCoreCapability,
) {
  const matching = fields.filter((field) => field.capability === capability);
  return matching.length === 1 ? matching[0] : undefined;
}

function decimalUnits(value: string | null | undefined): bigint | undefined {
  if (
    value === null ||
    value === undefined ||
    !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
  ) {
    return undefined;
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const padded = fraction.padEnd(5, "0");
  let units = BigInt(whole || "0") * 10_000n + BigInt(padded.slice(0, 4));
  if (padded.charAt(4) >= "5") units += 1n;
  return units <= maximumMarketAmountUnits ? units : undefined;
}

function formatUnits(value: bigint): string {
  const whole = value / 10_000n;
  const fraction = String(value % 10_000n).padStart(4, "0");
  return `${String(whole)}.${fraction}`;
}
