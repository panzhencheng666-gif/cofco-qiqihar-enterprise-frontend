import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkItemRepository } from "../../application/ports/WorkItemRepository";
import type { WorkItemScope } from "../../domain/workItem";
import type {
  ListPageDefinition,
  ListQueryState,
  LoadRegionChildren,
  LoadRegionPath,
  PagedResult,
  PageDefinitionGateway,
} from "../../../../shared/application/page-definition";
import { createInitialListQuery } from "../../../../shared/application/page-definition";
import { ListWorkbench } from "../../../../shared/ui/list-workbench";

const pageKey = { domain: "WORKFLOW", pageKind: "WORK_ITEMS" } as const;

export interface WorkRouteQuery {
  pageNumber?: number;
  pageSize?: number;
  values: Readonly<Record<string, string>>;
}

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
  const [definition, setDefinition] = useState<ListPageDefinition>();
  const [query, setQuery] = useState<ListQueryState>();
  const [result, setResult] = useState<PagedResult>();
  const [definitionError, setDefinitionError] = useState(false);
  const [definitionAttempt, setDefinitionAttempt] = useState(0);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestVersion = useRef(0);

  const execute = useCallback(
    async (nextQuery: ListQueryState) => {
      const version = ++requestVersion.current;
      setLoading(true);
      setListError("");
      try {
        const nextResult = await repository.search({
          scope,
          ...(nextQuery.values.status ? { status: nextQuery.values.status } : {}),
          ...(nextQuery.values.domain ? { domain: nextQuery.values.domain } : {}),
          ...(nextQuery.values.regionId ? { regionId: nextQuery.values.regionId } : {}),
          ...(nextQuery.values.productCode
            ? { productCode: nextQuery.values.productCode }
            : {}),
          pageNumber: nextQuery.pageNumber,
          pageSize: nextQuery.pageSize,
        });
        if (version === requestVersion.current) setResult(nextResult);
      } catch {
        if (version === requestVersion.current) {
          setListError("任务列表查询失败，请稍后重试。");
        }
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    },
    [repository, scope],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      pageDefinitionGateway.getDefinition(pageKey),
      loadProducts?.() ?? Promise.resolve([]),
    ])
      .then(([loaded, products]) => {
        if (!active) return;
        setDefinitionError(false);
        const dynamic = {
          ...loaded,
          filters: loaded.filters.map((filter) =>
            filter.id === "productCode" ? { ...filter, options: products } : filter,
          ),
        };
        const scoped =
          scope === "COMPLETED"
            ? {
                ...dynamic,
                filters: dynamic.filters.filter((filter) => filter.id !== "status"),
              }
            : dynamic;
        const defaults = createInitialListQuery(scoped);
        const initial = normalizeQuery(scoped, defaults, routeQuery, scope);
        setDefinition(scoped);
        setQuery(initial);
        setResult(emptyResult(initial));
        onQueryNormalized?.(initial);
        void execute(initial);
      })
      .catch(() => active && setDefinitionError(true));
    return () => {
      active = false;
    };
  }, [
    definitionAttempt,
    execute,
    loadProducts,
    onQueryNormalized,
    pageDefinitionGateway,
    routeQuery,
    scope,
  ]);

  function run(next: ListQueryState) {
    setQuery(next);
    onQueryCommitted?.(next);
    void execute(next);
  }

  if (definitionError) {
    return (
      <div className="page-alert" role="alert">
        任务页面定义加载失败，请稍后重试。
        <button
          onClick={() => setDefinitionAttempt((value) => value + 1)}
          type="button"
        >
          重试页面定义
        </button>
      </div>
    );
  }
  if (!definition || !query || !result) {
    return <div className="ledger-panel list-workbench-loading">正在加载任务页面</div>;
  }

  const statusFilter = definition.filters.find((filter) => filter.id === "status");
  return (
    <>
      {scope === "PENDING" && statusFilter && (
        <nav aria-label="待办状态" className="work-status-tabs">
          <button
            aria-pressed={!query.values.status}
            onClick={() =>
              run({ ...query, pageNumber: 0, values: { ...query.values, status: "" } })
            }
            type="button"
          >
            {statusFilter.placeholder}
          </button>
          {statusFilter.options.map((option) => (
            <button
              aria-pressed={query.values.status === option.value}
              key={option.value}
              onClick={() =>
                run({
                  ...query,
                  pageNumber: 0,
                  values: { ...query.values, status: option.value },
                })
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </nav>
      )}
      <ListWorkbench
        definition={definition}
        errorMessage={listError}
        loadRegionChildren={loadRegionChildren}
        loading={loading}
        onQueryChange={(next) => {
          const paged =
            next.pageNumber !== query.pageNumber || next.pageSize !== query.pageSize;
          setQuery(next);
          if (paged) run(next);
        }}
        onRetry={() => void execute(query)}
        onSearch={() => run(query)}
        query={query}
        result={result}
        {...(loadRegionPath ? { loadRegionPath } : {})}
      />
    </>
  );
}

function normalizeQuery(
  definition: ListPageDefinition,
  defaults: ListQueryState,
  routeQuery: WorkRouteQuery | undefined,
  scope: WorkItemScope,
) {
  const allowed = new Set(definition.filters.map((filter) => filter.id));
  const values = Object.fromEntries(
    Object.entries({ ...defaults.values, ...routeQuery?.values }).filter(
      ([id]) => allowed.has(id) && !(scope === "COMPLETED" && id === "status"),
    ),
  );
  return {
    values,
    pageNumber: routeQuery?.pageNumber ?? 0,
    pageSize: definition.pagination.pageSizeOptions.includes(routeQuery?.pageSize ?? -1)
      ? routeQuery!.pageSize!
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
