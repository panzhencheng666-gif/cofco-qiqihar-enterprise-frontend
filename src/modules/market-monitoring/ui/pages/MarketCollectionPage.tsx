import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";

import type {
  BusinessPageKey,
  ListQueryState,
  LoadRegionChildren,
  LoadRegionPath,
  PagedResult,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import {
  ListWorkbench,
  useListPageController,
} from "../../../../shared/ui/list-workbench";

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
    loadDefinition: () => pageDefinitionGateway.getDefinition(pageKey),
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
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

function requiredProductCode(key: BusinessPageKey) {
  if (key.productCode === undefined) {
    throw new Error("Market page requires a real product context");
  }
  return key.productCode;
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
