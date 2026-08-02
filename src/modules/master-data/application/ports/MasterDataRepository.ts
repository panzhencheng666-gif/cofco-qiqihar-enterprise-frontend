import type {
  MasterDataOption,
  RegionHierarchyNode,
  RegionOption,
} from "../../domain/masterData";

export interface MasterDataRepository {
  getProducts(domain: string, pageKind: string): Promise<readonly MasterDataOption[]>;
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
