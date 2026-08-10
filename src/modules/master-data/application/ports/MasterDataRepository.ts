import type {
  BusinessPeriodOption,
  MasterDataOption,
  RegionHierarchyNode,
  RegionOption,
  SupplySurveyPeriodOption,
} from "../../domain/masterData";

export interface MasterDataRepository {
  getBusinessPeriods(): Promise<readonly BusinessPeriodOption[]>;
  getSupplySurveyPeriods(): Promise<readonly SupplySurveyPeriodOption[]>;
  getProducts(domain?: string, pageKind?: string): Promise<readonly MasterDataOption[]>;
  getCultivars(productCode: string): Promise<readonly MasterDataOption[]>;
  getMarketObjectTypes(productCode: string): Promise<readonly MasterDataOption[]>;
  getMonitoringPeriods(
    domain: "MARKET",
    productCode: string,
  ): Promise<readonly MasterDataOption[]>;
  getRegionRoots(): Promise<readonly RegionOption[]>;
  getRegionChildren(parentId?: string): Promise<readonly RegionHierarchyNode[]>;
  getRegionPath(regionId: string): Promise<readonly RegionHierarchyNode[]>;
}
