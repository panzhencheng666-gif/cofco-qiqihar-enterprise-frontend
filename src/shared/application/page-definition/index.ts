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

export interface RouteListQuery {
  pageNumber?: number;
  pageSize?: number;
  values: Readonly<Record<string, string>>;
}

export interface ListRow {
  id: string;
  values: Readonly<Record<string, string | number | null | undefined>>;
  allowedActions?: readonly string[];
  version?: number;
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

export class ListPageContextError extends Error {}

export function validateListPageDefinitionContext(
  requested: BusinessPageKey,
  definition: ListPageDefinition,
) {
  const actual = definition.key;
  if (
    actual.domain !== requested.domain ||
    actual.pageKind !== requested.pageKind ||
    actual.productCode !== requested.productCode
  ) {
    throw new ListPageContextError("页面上下文与页面定义不一致。");
  }
  return definition;
}

export function normalizeListRouteQuery(
  definition: ListPageDefinition,
  routeQuery?: RouteListQuery,
): ListQueryState {
  const defaults = createInitialListQuery(definition);
  const allowedFilters = new Set(definition.filters.map((filter) => filter.id));
  const values = Object.fromEntries(
    Object.entries({ ...defaults.values, ...routeQuery?.values }).filter(([id]) =>
      allowedFilters.has(id),
    ),
  );
  const requestedPageNumber = routeQuery?.pageNumber;
  const requestedPageSize = routeQuery?.pageSize;
  return {
    values,
    pageNumber:
      requestedPageNumber !== undefined &&
      Number.isFinite(requestedPageNumber) &&
      Number.isInteger(requestedPageNumber) &&
      requestedPageNumber >= 0
        ? requestedPageNumber
        : defaults.pageNumber,
    pageSize:
      requestedPageSize !== undefined &&
      Number.isFinite(requestedPageSize) &&
      Number.isInteger(requestedPageSize) &&
      definition.pagination.pageSizeOptions.includes(requestedPageSize)
        ? requestedPageSize
        : defaults.pageSize,
  };
}
