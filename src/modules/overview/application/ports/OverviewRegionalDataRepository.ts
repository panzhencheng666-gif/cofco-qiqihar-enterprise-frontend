import type {
  RegionalAgricultureProfile,
  RegionalCropSummary,
  SupplyBalanceSummary,
} from "../../domain/overviewRegionalData";
import type {
  OperationalFacilityCatalogue,
  StorageFacility,
  StorageFacilityDraft,
} from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";

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
  createOperationalFacility?(draft: StorageFacilityDraft): Promise<StorageFacility>;
  updateOperationalFacility?(
    facilityCode: string,
    draft: StorageFacilityDraft,
  ): Promise<StorageFacility>;
  archiveOperationalFacility?(
    facilityCode: string,
    expectedVersion: number,
  ): Promise<void>;
  operationalSituation?(
    query?: { regionCode?: string; productCode?: string; surveyYear?: number },
    signal?: AbortSignal,
  ): Promise<OperationalSituationCatalogue>;
}
