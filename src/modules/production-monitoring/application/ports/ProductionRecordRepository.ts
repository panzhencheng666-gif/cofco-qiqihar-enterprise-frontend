import type { PagedResult } from "../../../../shared/application/page-definition";
import type {
  ProductionDraft,
  ProductionFormDefinition,
  ProductionRecord,
  ProductionRecordCriteria,
  ProductionRecordDetail,
} from "../../domain/productionRecord";

export interface ProductionRecordRepository {
  search(criteria: ProductionRecordCriteria): Promise<PagedResult<ProductionRecord>>;
  detail(id: string): Promise<ProductionRecordDetail>;
  definition(
    productCode: string,
    objectTypeCode?: string,
  ): Promise<ProductionFormDefinition>;
  create(draft: ProductionDraft): Promise<ProductionRecordDetail>;
  saveDraft(
    id: string,
    version: number,
    draft: ProductionDraft,
  ): Promise<ProductionRecordDetail>;
  submit(id: string, version: number): Promise<ProductionRecordDetail>;
  approve(id: string, version: number): Promise<ProductionRecordDetail>;
  returnForCorrection(
    id: string,
    version: number,
    reason: string,
  ): Promise<ProductionRecordDetail>;
}
