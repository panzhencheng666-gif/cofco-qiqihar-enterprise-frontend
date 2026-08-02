import type {
  MarketCollectionCriteria,
  MarketCollectionDefinition,
  MarketCollectionRecord,
} from "../../domain/marketCollection";

export interface MarketCollectionRepository {
  getDefinition(productCode: string): Promise<MarketCollectionDefinition>;
  search(
    criteria: MarketCollectionCriteria,
  ): Promise<readonly MarketCollectionRecord[]>;
}
