import type { PagedResult } from "../../../../shared/application/page-definition";
import type {
  ProductionRecord,
  ProductionRecordCriteria,
} from "../../domain/productionRecord";

export interface ProductionRecordRepository {
  search(criteria: ProductionRecordCriteria): Promise<PagedResult<ProductionRecord>>;
}
