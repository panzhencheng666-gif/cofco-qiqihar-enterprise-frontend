import { useCallback, useEffect, useRef, useState } from "react";

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
import { ListWorkbench } from "../../../../shared/ui/list-workbench";

type SearchList = (query: ListQueryState) => Promise<PagedResult>;

export interface RouteQuery {
  pageNumber?: number;
  pageSize?: number;
  values: Readonly<Record<string, string>>;
}

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
  const [definition, setDefinition] = useState<ListPageDefinition>();
  const [query, setQuery] = useState<ListQueryState>();
  const [result, setResult] = useState<PagedResult>();
  const [definitionError, setDefinitionError] = useState(false);
  const [definitionAttempt, setDefinitionAttempt] = useState(0);
  const [listError, setListError] = useState("");
  const [contextError, setContextError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchVersion = useRef(0);

  const executeSearch = useCallback(
    async (nextQuery: ListQueryState) => {
      const version = ++searchVersion.current;
      setLoading(true);
      setListError("");
      try {
        let nextResult: PagedResult;
        if (search) {
          nextResult = await search(nextQuery);
        } else if (marketCollectionRepository) {
          nextResult = await marketCollectionRepository.search({
            productCode: pageKey.productCode,
            pageKind: pageKey.pageKind,
            pageNumber: nextQuery.pageNumber,
            pageSize: nextQuery.pageSize,
            values: nextQuery.values,
          });
        } else {
          nextResult = emptyResult(nextQuery);
        }
        const lastPage = Math.max(0, nextResult.totalPages - 1);
        if (nextQuery.pageNumber > lastPage) {
          const normalizedQuery = { ...nextQuery, pageNumber: lastPage };
          if (search) {
            nextResult = await search(normalizedQuery);
          } else if (marketCollectionRepository) {
            nextResult = await marketCollectionRepository.search({
              productCode: pageKey.productCode,
              pageKind: pageKey.pageKind,
              pageNumber: normalizedQuery.pageNumber,
              pageSize: normalizedQuery.pageSize,
              values: normalizedQuery.values,
            });
          }
          if (version === searchVersion.current) {
            setQuery(normalizedQuery);
            onQueryNormalized?.(normalizedQuery);
          }
        }
        if (version === searchVersion.current) setResult(nextResult);
      } catch {
        if (version === searchVersion.current) {
          setListError("列表查询失败，请稍后重试。");
        }
      } finally {
        if (version === searchVersion.current) setLoading(false);
      }
    },
    [
      marketCollectionRepository,
      onQueryNormalized,
      pageKey.pageKind,
      pageKey.productCode,
      search,
    ],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return undefined;
      setDefinition(undefined);
      setDefinitionError(false);
      setContextError("");
      return pageDefinitionGateway
        .getDefinition(pageKey)
        .then((loadedDefinition) => {
          if (!active) return;
          if (!samePageKey(loadedDefinition.key, pageKey)) {
            setContextError("页面上下文与页面定义不一致。");
            return;
          }
          const defaults = createInitialListQuery(loadedDefinition);
          const initialQuery = normalizeRouteQuery(
            loadedDefinition,
            defaults,
            routeQuery,
          );
          setDefinition(loadedDefinition);
          setQuery(initialQuery);
          setResult({
            items: [],
            pageNumber: initialQuery.pageNumber,
            pageSize: initialQuery.pageSize,
            totalElements: 0,
            totalPages: 0,
          });
          onQueryNormalized?.(initialQuery);
          void executeSearch(initialQuery);
        })
        .catch(() => {
          if (active) setDefinitionError(true);
        });
    });
    return () => {
      active = false;
    };
  }, [
    definitionAttempt,
    executeSearch,
    onQueryNormalized,
    pageDefinitionGateway,
    pageKey,
    routeQuery,
  ]);

  function changeQuery(nextQuery: ListQueryState) {
    const shouldRun =
      query !== undefined &&
      (nextQuery.pageNumber !== query.pageNumber ||
        nextQuery.pageSize !== query.pageSize);
    setQuery(nextQuery);
    if (shouldRun) {
      onQueryCommitted?.(nextQuery);
      void executeSearch(nextQuery);
    }
  }

  function submitSearch() {
    if (!query) return;
    onQueryCommitted?.(query);
    void executeSearch(query);
  }

  if (definitionError) {
    return (
      <div className="page-alert" role="alert">
        页面定义加载失败，请稍后重试。
        <button
          onClick={() => setDefinitionAttempt((value) => value + 1)}
          type="button"
        >
          重试页面定义
        </button>
      </div>
    );
  }
  if (contextError) {
    return (
      <div className="page-alert" role="alert">
        {contextError}
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
