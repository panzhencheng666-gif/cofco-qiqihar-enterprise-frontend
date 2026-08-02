export interface ProductionRecord {
  id: string;
  values: Readonly<Record<string, string | null>>;
  allowedActions: readonly string[];
  version: number;
}

export interface ProductionRecordCriteria {
  productCode: string;
  pageKind: string;
  pageNumber: number;
  pageSize: number;
  values: Readonly<Record<string, string>>;
}

export type ProductionFactCategory = "QUALITY" | "COST" | "INSURANCE" | "SUBSIDY";

export interface ProductionFactField {
  code: string;
  label: string;
  valueType: string;
  unit: string | null;
  description: string | null;
  precision: number;
  scale: number;
}

export interface ProductionFormDefinition {
  productCode: string;
  objectTypeCode: string | null;
  groups: readonly {
    category: ProductionFactCategory;
    fields: readonly ProductionFactField[];
  }[];
}

export interface ProductionDraft {
  productCode: string;
  objectTypeCode: string;
  regionCode: string;
  cultivarCode: string | null;
  surveyDate: string;
  cultivatedAreaMu: string;
  yieldPerMuKilograms: string;
  quality: Readonly<Record<string, string>>;
  costs: Readonly<Record<string, string>>;
  insurance: Readonly<Record<string, string>>;
  subsidies: Readonly<Record<string, string>>;
}

export interface ProductionRecordDetail extends ProductionDraft {
  id: string;
  reportedAt: string;
  estimatedOutputKilograms: string;
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  version: number;
}
