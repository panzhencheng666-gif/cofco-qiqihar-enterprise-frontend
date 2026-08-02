import { useCallback, useEffect, useRef, useState } from "react";

import type { ProductionRecordRepository } from "../../application/ports/ProductionRecordRepository";
import {
  createInitialListQuery,
  type BusinessPageKey,
  type ListPageDefinition,
  type ListQueryState,
  type LoadRegionChildren,
  type LoadRegionPath,
  type PagedResult,
  type PageDefinitionGateway,
} from "../../../../shared/application/page-definition";
import { ListWorkbench } from "../../../../shared/ui/list-workbench";

export interface ProductionRouteQuery {
  pageNumber?: number;
  pageSize?: number;
  values: Readonly<Record<string, string>>;
}

export function ProductionMonitoringPage({
  loadRegionChildren,
  loadRegionPath,
  pageDefinitionGateway,
  pageKey,
  repository,
  routeQuery,
  onQueryCommitted,
  onQueryNormalized,
}: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  repository: ProductionRecordRepository;
  routeQuery?: ProductionRouteQuery;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
}) {
  const productCode = requireProduct(pageKey);
  const [definition, setDefinition] = useState<ListPageDefinition>();
  const [query, setQuery] = useState<ListQueryState>();
  const [result, setResult] = useState<PagedResult>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const version = useRef(0);
  const search = useCallback(
    async (next: ListQueryState) => {
      const current = ++version.current;
      setLoading(true);
      setError("");
      try {
        let page = await repository.search({
          productCode,
          pageKind: pageKey.pageKind,
          pageNumber: next.pageNumber,
          pageSize: next.pageSize,
          values: next.values,
        });
        const lastPage = Math.max(0, page.totalPages - 1);
        if (next.pageNumber > lastPage) {
          const normalized = { ...next, pageNumber: lastPage };
          page = await repository.search({
            productCode,
            pageKind: pageKey.pageKind,
            pageNumber: normalized.pageNumber,
            pageSize: normalized.pageSize,
            values: normalized.values,
          });
          if (current === version.current) {
            setQuery(normalized);
            onQueryNormalized?.(normalized);
          }
        }
        if (current === version.current) setResult(page);
      } catch {
        if (current === version.current) setError("列表查询失败，请稍后重试。");
      } finally {
        if (current === version.current) setLoading(false);
      }
    },
    [onQueryNormalized, pageKey.pageKind, productCode, repository],
  );

  useEffect(() => {
    let active = true;
    void pageDefinitionGateway
      .getDefinition(pageKey)
      .then((loaded) => {
        if (!active || !sameKey(loaded.key, pageKey)) return;
        const initial = route(loaded, routeQuery);
        setDefinition(loaded);
        setQuery(initial);
        setResult({
          items: [],
          pageNumber: initial.pageNumber,
          pageSize: initial.pageSize,
          totalElements: 0,
          totalPages: 0,
        });
        onQueryNormalized?.(initial);
        void search(initial);
      })
      .catch(() => active && setError("页面定义加载失败，请稍后重试。"));
    return () => {
      active = false;
    };
  }, [onQueryNormalized, pageDefinitionGateway, pageKey, routeQuery, search]);

  if (!definition || !query || !result)
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;
  return (
    <ListWorkbench
      definition={definition}
      loadRegionChildren={loadRegionChildren}
      {...(loadRegionPath ? { loadRegionPath } : {})}
      loading={loading}
      errorMessage={error}
      query={query}
      result={result}
      onRetry={() => void search(query)}
      onSearch={() => {
        onQueryCommitted?.(query);
        void search(query);
      }}
      onQueryChange={(next) => {
        setQuery(next);
        if (next.pageNumber !== query.pageNumber || next.pageSize !== query.pageSize) {
          onQueryCommitted?.(next);
          void search(next);
        }
      }}
    />
  );
}

function requireProduct(key: BusinessPageKey) {
  if (!key.productCode) throw new Error("Production page requires product context");
  return key.productCode;
}
function sameKey(left: BusinessPageKey, right: BusinessPageKey) {
  return (
    left.domain === right.domain &&
    left.pageKind === right.pageKind &&
    left.productCode === right.productCode
  );
}
function route(
  definition: ListPageDefinition,
  current?: ProductionRouteQuery,
): ListQueryState {
  const defaults = createInitialListQuery(definition);
  const allowed = new Set(definition.filters.map((item) => item.id));
  return {
    values: Object.fromEntries(
      Object.entries({ ...defaults.values, ...current?.values }).filter(([key]) =>
        allowed.has(key),
      ),
    ),
    pageNumber:
      current?.pageNumber !== undefined && current.pageNumber >= 0
        ? current.pageNumber
        : defaults.pageNumber,
    pageSize:
      current?.pageSize !== undefined &&
      definition.pagination.pageSizeOptions.includes(current.pageSize)
        ? current.pageSize
        : defaults.pageSize,
  };
}
