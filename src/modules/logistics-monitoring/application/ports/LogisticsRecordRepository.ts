import type { PagedResult } from "../../../../shared/application/page-definition";
import type {
  LogisticsDraft,
  LogisticsDefinition,
  LogisticsRecord,
  LogisticsRecordCriteria,
} from "../../domain/logisticsRecord";

export interface LogisticsRecordRepository {
  definition(productCode: string): Promise<LogisticsDefinition>;
  search(criteria: LogisticsRecordCriteria): Promise<PagedResult<LogisticsRecord>>;
  detail(id: string): Promise<LogisticsRecord>;
  create(draft: LogisticsDraft): Promise<LogisticsRecord>;
  saveDraft(
    id: string,
    version: number,
    draft: LogisticsDraft,
  ): Promise<LogisticsRecord>;
  submit(id: string, version: number): Promise<LogisticsRecord>;
  approve(id: string, version: number): Promise<LogisticsRecord>;
  returnForCorrection(
    id: string,
    version: number,
    reason: string,
  ): Promise<LogisticsRecord>;
}
