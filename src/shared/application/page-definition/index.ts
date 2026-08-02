export interface BusinessPageKey {
  domain: string;
  pageKind: string;
  productCode?: string;
}

export interface DefinitionOption {
  value: string;
  label: string;
}

export type FilterControl = "text" | "date" | "select" | "region-hierarchy";

export interface FilterDefinition {
  id: string;
  label: string;
  control: FilterControl;
  placeholder: string;
  options: readonly DefinitionOption[];
}

export interface FieldDefinition {
  id: string;
  label: string;
  valueType: string;
  unit?: string;
  description?: string;
}

export interface ColumnGroupDefinition {
  id: string;
  label: string;
  fields: readonly FieldDefinition[];
}

export interface ActionDefinition {
  id: string;
  label: string;
  scope: "page" | "row";
}

export interface ListPageDefinition {
  key: BusinessPageKey;
  title: string;
  breadcrumbs: readonly { id: string; label: string }[];
  filters: readonly FilterDefinition[];
  defaultContext: Readonly<Record<string, string>>;
  columnGroups: readonly ColumnGroupDefinition[];
  actions: readonly ActionDefinition[];
  pagination: {
    defaultPageSize: number;
    pageSizeOptions: readonly number[];
  };
}

export interface ListQueryState {
  values: Readonly<Record<string, string>>;
  pageNumber: number;
  pageSize: number;
}

export interface ListRow {
  id: string;
  values: Readonly<Record<string, string | number | null | undefined>>;
}

export interface PagedResult<T extends ListRow = ListRow> {
  items: readonly T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface RegionNode {
  id: string;
  label: string;
  level: string;
}

export type LoadRegionChildren = (parentId?: string) => Promise<readonly RegionNode[]>;
export type LoadRegionPath = (regionId: string) => Promise<readonly RegionNode[]>;

export interface PageDefinitionGateway {
  getDefinition(key: BusinessPageKey): Promise<ListPageDefinition>;
}

export function createInitialListQuery(definition: ListPageDefinition): ListQueryState {
  return {
    values: { ...definition.defaultContext },
    pageNumber: 0,
    pageSize: definition.pagination.defaultPageSize,
  };
}
