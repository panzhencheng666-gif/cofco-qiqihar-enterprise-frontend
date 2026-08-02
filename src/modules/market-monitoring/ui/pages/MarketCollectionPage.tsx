import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";

import type {
  BusinessPageKey,
  ListPageDefinition,
  ListQueryState,
  LoadRegionChildren,
  LoadRegionPath,
  PagedResult,
  PageDefinitionGateway,
} from "../../../../shared/application/page-definition";
import { createInitialListQuery } from "../../../../shared/application/page-definition";
import {
  ListPageContextError,
  ListWorkbench,
  useListPageController,
} from "../../../../shared/ui/list-workbench";
import type { RouteListQuery } from "../../../../shared/ui/list-workbench";

type SearchList = (query: ListQueryState) => Promise<PagedResult>;

export type RouteQuery = RouteListQuery;

export function MarketCollectionPage({
  loadRegionChildren,
  loadRegionPath,
  marketCollectionRepository,
  onQueryCommitted,
  onQueryNormalized,
  pageDefinitionGateway,
  pageKey,
  routeQuery,
  search,
}: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  marketCollectionRepository?: MarketCollectionRepository;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  routeQuery?: RouteQuery;
  search?: SearchList;
}) {
  const productCode = requiredProductCode(pageKey);
  const controller = useListPageController({
    controllerKey: `${pageKey.domain}/${pageKey.pageKind}/${productCode}`,
    loadDefinition: async () => {
      const loaded = await pageDefinitionGateway.getDefinition(pageKey);
      if (!samePageKey(loaded.key, pageKey)) {
        throw new ListPageContextError("页面上下文与页面定义不一致。");
      }
      return loaded;
    },
    normalizeRoute: (loaded, current) =>
      normalizeRouteQuery(loaded, createInitialListQuery(loaded), current),
    onQueryCommitted,
    onQueryNormalized,
    routeQuery,
    search: async (nextQuery) => {
      if (search) return search(nextQuery);
      if (!marketCollectionRepository) return emptyResult(nextQuery);
      return marketCollectionRepository.search({
        productCode,
        pageKind: pageKey.pageKind,
        pageNumber: nextQuery.pageNumber,
        pageSize: nextQuery.pageSize,
        values: nextQuery.values,
      });
    },
  });
  const {
    changeQuery,
    definition,
    definitionError,
    executeSearch,
    listError,
    loading,
    query,
    result,
    retryDefinition,
    submitSearch,
  } = controller;

  if (definitionError) {
    return (
      <div className="page-alert" role="alert">
        {definitionError}
        <button onClick={retryDefinition} type="button">
          重试页面定义
        </button>
      </div>
    );
  }
  if (definition === undefined || query === undefined || result === undefined) {
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;
  }

  return (
    <ListWorkbench
      definition={definition}
      errorMessage={listError}
      loadRegionChildren={loadRegionChildren}
      loading={loading}
      onQueryChange={changeQuery}
      onRetry={() => void executeSearch(query)}
      onSearch={submitSearch}
      query={query}
      result={result}
      {...(loadRegionPath ? { loadRegionPath } : {})}
    />
  );
}

function samePageKey(left: BusinessPageKey, right: BusinessPageKey) {
  return (
    left.domain === right.domain &&
    left.pageKind === right.pageKind &&
    left.productCode === right.productCode
  );
}

function requiredProductCode(key: BusinessPageKey) {
  if (key.productCode === undefined) {
    throw new Error("Market page requires a real product context");
  }
  return key.productCode;
}

function normalizeRouteQuery(
  definition: ListPageDefinition,
  defaults: ListQueryState,
  routeQuery?: RouteQuery,
): ListQueryState {
  const allowedFilters = new Set(definition.filters.map((filter) => filter.id));
  const values = Object.fromEntries(
    Object.entries({ ...defaults.values, ...routeQuery?.values }).filter(([id]) =>
      allowedFilters.has(id),
    ),
  );
  const requestedPageSize = routeQuery?.pageSize;
  return {
    values,
    pageNumber:
      routeQuery?.pageNumber !== undefined &&
      Number.isInteger(routeQuery.pageNumber) &&
      routeQuery.pageNumber >= 0
        ? routeQuery.pageNumber
        : defaults.pageNumber,
    pageSize:
      requestedPageSize !== undefined &&
      definition.pagination.pageSizeOptions.includes(requestedPageSize)
        ? requestedPageSize
        : defaults.pageSize,
  };
}

function emptyResult(query: ListQueryState): PagedResult {
  return {
    items: [],
    pageNumber: query.pageNumber,
    pageSize: query.pageSize,
    totalElements: 0,
    totalPages: 0,
  };
}
