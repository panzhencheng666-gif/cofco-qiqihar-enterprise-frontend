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
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  version: number;
}

export interface LogisticsDraft {
  productCode: string;
  monitoringPeriodCode: string;
  collectionDate: string;
  originNodeId: number;
  destinationNodeId: number;
  transportModeCode: string;
  direction: string;
  routeVolume: string;
  volumeUnit: string;
  freightRate: string;
  freightUnit: string;
  transitTime: string;
  transitUnit: string;
  sourceOrganization: string;
  reporter: string;
}
