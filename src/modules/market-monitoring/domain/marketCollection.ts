export interface MarketCollectionRecord {
  id: string;
  values: Readonly<Record<string, string | number | null>>;
}

export interface MarketCollectionCriteria {
  productCode: string;
  pageKind: string;
  pageNumber: number;
  pageSize: number;
  values: Readonly<Record<string, string>>;
}
