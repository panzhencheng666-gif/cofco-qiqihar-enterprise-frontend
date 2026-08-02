import type { WorkItemRepository } from "../../application/ports/WorkItemRepository";
import type { WorkItemScope } from "../../domain/workItem";
import type {
  ListQueryState,
  LoadRegionChildren,
  LoadRegionPath,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import {
  ListWorkbench,
  useListPageController,
} from "../../../../shared/ui/list-workbench";

const pageKey = { domain: "WORKFLOW", pageKind: "WORK_ITEMS" } as const;

export type WorkRouteQuery = RouteListQuery;

export function WorkItemsPage({
  loadRegionChildren,
  loadRegionPath,
  loadProducts,
  onQueryCommitted,
  onQueryNormalized,
  pageDefinitionGateway,
  repository,
  routeQuery,
  scope,
}: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  loadProducts?: () => Promise<readonly { value: string; label: string }[]>;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  repository: WorkItemRepository;
  routeQuery?: WorkRouteQuery;
  scope: WorkItemScope;
}) {
  const controller = useListPageController({
    controllerKey: `WORKFLOW/WORK_ITEMS/${scope}`,
    definitionErrorMessage: "任务页面定义加载失败，请稍后重试。",
    listErrorMessage: "任务列表查询失败，请稍后重试。",
    loadDefinition: async () => {
      const [loaded, products] = await Promise.all([
        pageDefinitionGateway.getDefinition(pageKey),
        loadProducts?.() ?? Promise.resolve([]),
      ]);
      const dynamic = {
        ...loaded,
        filters: loaded.filters.map((filter) =>
          filter.id === "productCode" ? { ...filter, options: products } : filter,
        ),
      };
      return scope === "COMPLETED"
        ? {
            ...dynamic,
            filters: dynamic.filters.filter((filter) => filter.id !== "status"),
          }
        : dynamic;
    },
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
    routeQuery,
    search: (searchedQuery) =>
      repository.search({
        scope,
        ...(searchedQuery.values.status ? { status: searchedQuery.values.status } : {}),
        ...(searchedQuery.values.domain ? { domain: searchedQuery.values.domain } : {}),
        ...(searchedQuery.values.regionId
          ? { regionId: searchedQuery.values.regionId }
          : {}),
        ...(searchedQuery.values.productCode
          ? { productCode: searchedQuery.values.productCode }
          : {}),
        pageNumber: searchedQuery.pageNumber,
        pageSize: searchedQuery.pageSize,
      }),
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
  if (!definition || !query || !result) {
    return <div className="ledger-panel list-workbench-loading">正在加载任务页面</div>;
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
