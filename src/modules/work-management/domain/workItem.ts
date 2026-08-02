export type WorkItemScope = "PENDING" | "COMPLETED";

export interface WorkItemCriteria {
  scope: WorkItemScope;
  status?: string;
  domain?: string;
  regionId?: string;
  productCode?: string;
  pageNumber: number;
  pageSize: number;
}
