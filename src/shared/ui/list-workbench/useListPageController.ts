import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BusinessPageKey,
  ListPageDefinition,
  ListQueryState,
  PagedResult,
  RouteListQuery,
} from "../../application/page-definition";
import {
  ListPageContextError,
  normalizeListRouteQuery,
  validateListPageDefinitionContext,
} from "../../application/page-definition";

export interface ListPageControllerOptions {
  controllerKey: string;
  definitionErrorMessage?: string;
  listErrorMessage?: string;
  loadDefinition: () => Promise<ListPageDefinition>;
  onQueryCommitted?: ((query: ListQueryState) => void) | undefined;
  onQueryNormalized?: ((query: ListQueryState) => void) | undefined;
  pageKey: BusinessPageKey;
  routeQuery?: RouteListQuery | undefined;
  search: (query: ListQueryState) => Promise<PagedResult>;
}

export function useListPageController(options: ListPageControllerOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const [definitionState, setDefinitionState] = useState<{
    contextKey: string;
    value: ListPageDefinition;
  }>();
  const [query, setQuery] = useState<ListQueryState>();
  const queryRef = useRef<ListQueryState | undefined>(undefined);
  const [result, setResult] = useState<PagedResult>();
  const [definitionError, setDefinitionError] = useState("");
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(false);
  const [definitionAttempt, setDefinitionAttempt] = useState(0);
  const requestVersion = useRef(0);
  const routeKey = routeFingerprint(options.routeQuery);

  const executeSearch = useCallback(async (next: ListQueryState) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setListError("");
    try {
      let nextResult = await optionsRef.current.search(next);
      if (version !== requestVersion.current) return;
      const lastPage = Math.max(0, nextResult.totalPages - 1);
      if (next.pageNumber > lastPage) {
        const normalized = { ...next, pageNumber: lastPage };
        queryRef.current = normalized;
        setQuery(normalized);
        optionsRef.current.onQueryNormalized?.(normalized);
        nextResult = await optionsRef.current.search(normalized);
        if (version !== requestVersion.current) return;
      }
      setResult(nextResult);
    } catch {
      if (version === requestVersion.current) {
        setListError(
          optionsRef.current.listErrorMessage ?? "列表查询失败，请稍后重试。",
        );
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queryRef.current = undefined;
    requestVersion.current += 1;
    void Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setDefinitionState(undefined);
        setQuery(undefined);
        setResult(undefined);
        setDefinitionError("");
        setListError("");
        return optionsRef.current.loadDefinition();
      })
      .then((loaded) => {
        if (!active || !loaded) return;
        const validated = validateListPageDefinitionContext(
          optionsRef.current.pageKey,
          loaded,
        );
        const initial = normalizeListRouteQuery(
          validated,
          optionsRef.current.routeQuery,
        );
        queryRef.current = initial;
        setDefinitionState({ contextKey: options.controllerKey, value: validated });
        setQuery(initial);
        setResult(emptyResult(initial));
        optionsRef.current.onQueryNormalized?.(initial);
        void executeSearch(initial);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setDefinitionError(
          failure instanceof ListPageContextError
            ? failure.message
            : (optionsRef.current.definitionErrorMessage ??
                "页面定义加载失败，请稍后重试。"),
        );
      });
    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [definitionAttempt, executeSearch, options.controllerKey]);

  useEffect(() => {
    const definition =
      definitionState?.contextKey === options.controllerKey
        ? definitionState.value
        : undefined;
    const currentQuery = queryRef.current;
    if (!definition || !currentQuery) return;
    const restored = normalizeListRouteQuery(definition, optionsRef.current.routeQuery);
    if (sameQuery(restored, currentQuery)) return;
    queryRef.current = restored;
    requestVersion.current += 1;
    setQuery(restored);
    setResult(emptyResult(restored));
    optionsRef.current.onQueryNormalized?.(restored);
    void executeSearch(restored);
  }, [definitionState, executeSearch, options.controllerKey, routeKey]);

  const changeQuery = useCallback(
    (next: ListQueryState) => {
      const current = queryRef.current;
      const shouldSearch =
        current !== undefined &&
        sameValues(current.values, next.values) &&
        (current.pageNumber !== next.pageNumber || current.pageSize !== next.pageSize);
      queryRef.current = next;
      setQuery(next);
      if (shouldSearch) {
        optionsRef.current.onQueryCommitted?.(next);
        void executeSearch(next);
      }
    },
    [executeSearch],
  );

  const submitSearch = useCallback(() => {
    const latest = queryRef.current;
    if (latest) {
      optionsRef.current.onQueryCommitted?.(latest);
      void executeSearch(latest);
    }
  }, [executeSearch]);

  const refreshLatest = useCallback(async () => {
    const latest = queryRef.current;
    if (latest) await executeSearch(latest);
  }, [executeSearch]);

  return {
    changeQuery,
    definition:
      definitionState?.contextKey === options.controllerKey
        ? definitionState.value
        : undefined,
    definitionError,
    executeSearch,
    listError,
    loading,
    query,
    refreshLatest,
    result,
    retryDefinition: () => setDefinitionAttempt((value) => value + 1),
    submitSearch,
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

function sameQuery(left: ListQueryState, right: ListQueryState) {
  return (
    left.pageNumber === right.pageNumber &&
    left.pageSize === right.pageSize &&
    sameValues(left.values, right.values)
  );
}

function sameValues(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
}

function routeFingerprint(routeQuery?: RouteListQuery) {
  if (!routeQuery) return "";
  const values = Object.entries(routeQuery.values).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return JSON.stringify([routeQuery.pageNumber, routeQuery.pageSize, values]);
}
