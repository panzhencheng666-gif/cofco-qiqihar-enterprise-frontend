export interface ProductionRecord {
  id: string;
  values: Readonly<Record<string, string | number | null>>;
}

export interface ProductionRecordCriteria {
  productCode: string;
  pageKind: string;
  pageNumber: number;
  pageSize: number;
  values: Readonly<Record<string, string>>;
}
