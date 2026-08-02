import type { PagedResult } from "../../../../shared/application/page-definition";
import type {
  ProductionDraft,
  ProductionFormDefinition,
  ProductionRecord,
  ProductionRecordCriteria,
  ProductionRecordDetail,
} from "../../domain/productionRecord";

export type ProductionRepositoryFailureKind =
  "AUTHENTICATION" | "CONFLICT" | "VALIDATION" | "UNEXPECTED";

export class ProductionRepositoryFailure extends Error {
  readonly name = "ProductionRepositoryFailure";

  constructor(
    readonly kind: ProductionRepositoryFailureKind,
    readonly cause?: unknown,
  ) {
    super(`Production repository request failed: ${kind}`);
  }
}

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
