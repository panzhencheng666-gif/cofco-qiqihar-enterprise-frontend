import type {
  MarketCollectionCriteria,
  MarketCollectionRecord,
} from "../../domain/marketCollection";
import type { PagedResult } from "../../../../shared/application/page-definition";

export interface MarketCollectionRepository {
  search(
    criteria: MarketCollectionCriteria,
  ): Promise<PagedResult<MarketCollectionRecord>>;
}
