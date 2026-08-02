import type { PagedResult } from "../../../../shared/application/page-definition";
import type { WorkItemCriteria } from "../../domain/workItem";

export interface WorkItemRepository {
  search(criteria: WorkItemCriteria): Promise<PagedResult>;
}
