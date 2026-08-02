import { useCallback, useEffect, useRef, useState } from "react";

import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";
import type { MarketCollectionRecord } from "../../domain/marketCollection";

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
  pageDefinitionGateway,
  pageKey,
  routeQuery,
  search,
}: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  marketCollectionRepository?: MarketCollectionRepository;
  onQueryCommitted?: (query: ListQueryState) => void;
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
          const records = await marketCollectionRepository.search({
            productCode: pageKey.productCode,
            pageNumber: nextQuery.pageNumber,
            pageSize: nextQuery.pageSize,
            ...nextQuery.values,
          });
          nextResult = toPagedResult(records, nextQuery);
        } else {
          nextResult = emptyResult(nextQuery);
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
    [marketCollectionRepository, pageKey.productCode, search],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return undefined;
      setDefinition(undefined);
      setDefinitionError(false);
      return pageDefinitionGateway
        .getDefinition(pageKey)
        .then((loadedDefinition) => {
          if (!active) return;
          const defaults = createInitialListQuery(loadedDefinition);
          const initialQuery: ListQueryState = {
            values: { ...defaults.values, ...routeQuery?.values },
            pageNumber: routeQuery?.pageNumber ?? defaults.pageNumber,
            pageSize: routeQuery?.pageSize ?? defaults.pageSize,
          };
          setDefinition(loadedDefinition);
          setQuery(initialQuery);
          setResult({
            items: [],
            pageNumber: initialQuery.pageNumber,
            pageSize: initialQuery.pageSize,
            totalElements: 0,
            totalPages: 0,
          });
          void executeSearch(initialQuery);
        })
        .catch(() => {
          if (active) setDefinitionError(true);
        });
    });
    return () => {
      active = false;
    };
  }, [definitionAttempt, executeSearch, pageDefinitionGateway, pageKey, routeQuery]);

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

function emptyResult(query: ListQueryState): PagedResult {
  return {
    items: [],
    pageNumber: query.pageNumber,
    pageSize: query.pageSize,
    totalElements: 0,
    totalPages: 0,
  };
}

function toPagedResult(
  records: readonly MarketCollectionRecord[],
  query: ListQueryState,
): PagedResult {
  const start = query.pageNumber * query.pageSize;
  return {
    items: records.slice(start, start + query.pageSize).map((record) => {
      const { values, ...baseValues } = record;
      return { id: record.id, values: { ...baseValues, ...values } };
    }),
    pageNumber: query.pageNumber,
    pageSize: query.pageSize,
    totalElements: records.length,
    totalPages: Math.ceil(records.length / query.pageSize),
  };
}
