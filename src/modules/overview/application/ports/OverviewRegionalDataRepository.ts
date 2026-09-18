import type {
  RegionalAgricultureProfile,
  RegionalCropSummary,
  SupplyBalanceSummary,
} from "../../domain/overviewRegionalData";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";

export interface OverviewRegionalDataQuery {
  regionCode: string;
  year: number;
  productCode: string;
}

export interface OverviewRegionalDataRepository {
  agricultureProfile?(
    query: OverviewRegionalDataQuery,
  ): Promise<RegionalAgricultureProfile>;
  regionalSummary(query: OverviewRegionalDataQuery): Promise<RegionalCropSummary>;
  supplyBalance(query: OverviewRegionalDataQuery): Promise<SupplyBalanceSummary>;
  operationalFacilities?(
    query: {
      regionCode?: string;
      productCode?: string;
      asOf: string;
    },
    signal?: AbortSignal,
  ): Promise<OperationalFacilityCatalogue>;
}
