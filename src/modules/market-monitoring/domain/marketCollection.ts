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

const draftFields: Readonly<Record<string, MarketDraftCoreField | "actualTradePrice">> =
  {
    MKT_OBJECT_TYPE: "objectTypeCode",
    MKT_REGION: "regionCode",
    MKT_TRADE_DATE: "tradeDate",
    MKT_TRADE_DIRECTION: "direction",
    MKT_PURCHASE_BASE_PRICE: "purchaseBasePrice",
    MKT_SALE_BASE_PRICE: "saleBasePrice",
    MKT_CARRIAGE_BOARD_AMOUNT: "carriageBoardAmount",
    MKT_PACKAGING_FORM: "packagingForm",
    MKT_PACKAGING_AMOUNT: "packagingAmount",
    MKT_FREIGHT_AMOUNT: "freightAmount",
    MKT_ACTUAL_TRADE_PRICE: "actualTradePrice",
  };

export function marketDraftField(code: string) {
  return draftFields[code];
}
