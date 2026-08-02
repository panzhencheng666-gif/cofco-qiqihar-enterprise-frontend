export interface MasterDataOption {
  id: string;
  name: string;
}

export type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export interface RegionOption extends MasterDataOption {
  level: RegionLevel;
}

export interface RegionHierarchyNode {
  id: string;
  label: string;
  level: RegionLevel;
}
