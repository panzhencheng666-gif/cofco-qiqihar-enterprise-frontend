export interface MarketFieldDefinition {
  id: string;
  name: string;
  unit?: string;
  note?: string;
}

export interface MarketFieldGroupDefinition {
  id: string;
  name: string;
  fields: readonly MarketFieldDefinition[];
}

export interface MarketCollectionDefinition {
  productCode: string;
  productName: string;
  fieldGroups: readonly MarketFieldGroupDefinition[];
}

export type CollectionStatus = string;

export interface MarketCollectionRecord {
  id: string;
  collectionDate: string;
  submittedAt: string;
  subjectName: string;
  objectTypeName: string;
  regionName: string;
  cultivarName: string;
  status: CollectionStatus;
  values: Readonly<Record<string, string>>;
}

export interface MarketCollectionCriteria {
  productCode: string;
  collectionDate?: string;
  regionId?: string;
  monitoringPeriodId?: string;
  objectTypeId?: string;
  cultivarId?: string;
  status?: CollectionStatus;
}
