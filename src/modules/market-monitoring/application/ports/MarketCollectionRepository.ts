import type { PagedResult } from "../../../../shared/application/page-definition";
import type {
  MarketCollectionCriteria,
  MarketCollectionRecord,
  MarketDraft,
  MarketFormDefinition,
  MarketRecordDetail,
} from "../../domain/marketCollection";

export type MarketRepositoryFailureKind =
  "AUTHENTICATION" | "CONFLICT" | "VALIDATION" | "DEFINITION" | "UNEXPECTED";

export class MarketRepositoryFailure extends Error {
  readonly name = "MarketRepositoryFailure";

  constructor(
    readonly kind: MarketRepositoryFailureKind,
    readonly cause?: unknown,
  ) {
    super(`Market repository request failed: ${kind}`);
  }
}

export interface MarketCollectionRepository {
  search(
    criteria: MarketCollectionCriteria,
  ): Promise<PagedResult<MarketCollectionRecord>>;
  detail(id: string): Promise<MarketRecordDetail>;
  definition(
    productCode: string,
    objectTypeCode?: string,
  ): Promise<MarketFormDefinition>;
  create(draft: MarketDraft): Promise<MarketRecordDetail>;
  saveDraft(
    id: string,
    version: number,
    draft: MarketDraft,
  ): Promise<MarketRecordDetail>;
  submit(id: string, version: number): Promise<MarketRecordDetail>;
  approve(id: string, version: number): Promise<MarketRecordDetail>;
  returnForCorrection(
    id: string,
    version: number,
    reason: string,
  ): Promise<MarketRecordDetail>;
}
