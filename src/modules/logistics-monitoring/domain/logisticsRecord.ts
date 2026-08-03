export interface LogisticsRecordCriteria {
  productCode: string;
  pageNumber: number;
  pageSize: number;
  values: Readonly<Record<string, string>>;
}

export interface LogisticsRecord {
  id: string;
  productCode: string;
  values: Readonly<Record<string, string | null>>;
  displayValues: Readonly<Record<string, string | null>>;
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  version: number;
}

export interface LogisticsDraft {
  productCode: string;
  values: Readonly<Record<string, string>>;
}

export interface LogisticsDefinition {
  productCode: string;
  fields: readonly LogisticsFieldDefinition[];
  actions: readonly LogisticsActionDefinition[];
}

export interface LogisticsFieldDefinition {
  code: string;
  label: string;
  controlType:
    "SELECT" | "DATE" | "DECIMAL" | "TEXT" | "READONLY_DATETIME" | "READONLY_STATUS";
  unit: string | null;
  precision: number | null;
  scale: number | null;
  required: boolean;
  readOnly: boolean;
  sortOrder: number;
  options: readonly { value: string; label: string; sortOrder: number }[];
}

export interface LogisticsActionDefinition {
  code: string;
  label: string;
  scope: string;
  sortOrder: number;
}
