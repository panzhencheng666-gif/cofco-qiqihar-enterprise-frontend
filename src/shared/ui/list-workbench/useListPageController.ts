import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ListPageDefinition,
  ListQueryState,
  PagedResult,
} from "../../application/page-definition";

export interface RouteListQuery {
  pageNumber?: number;
  pageSize?: number;
  values: Readonly<Record<string, string>>;
}

export interface ListPageControllerOptions {
  controllerKey: string;
  definitionErrorMessage?: string;
  listErrorMessage?: string;
  loadDefinition: () => Promise<ListPageDefinition>;
  normalizeRoute: (
    definition: ListPageDefinition,
    routeQuery?: RouteListQuery,
  ) => ListQueryState;
  onQueryCommitted?: ((query: ListQueryState) => void) | undefined;
  onQueryNormalized?: ((query: ListQueryState) => void) | undefined;
  routeQuery?: RouteListQuery | undefined;
  search: (query: ListQueryState) => Promise<PagedResult>;
}

export function useListPageController(options: ListPageControllerOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const [definition, setDefinition] = useState<ListPageDefinition>();
  const [query, setQuery] = useState<ListQueryState>();
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
        nextResult = await optionsRef.current.search(normalized);
        if (version !== requestVersion.current) return;
        setQuery(normalized);
        optionsRef.current.onQueryNormalized?.(normalized);
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
    requestVersion.current += 1;
    void Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setDefinition(undefined);
        setQuery(undefined);
        setResult(undefined);
        setDefinitionError("");
        setListError("");
        return optionsRef.current.loadDefinition();
      })
      .then((loaded) => {
        if (!active || !loaded) return;
        const initial = optionsRef.current.normalizeRoute(
          loaded,
          optionsRef.current.routeQuery,
        );
        setDefinition(loaded);
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
  }, [definitionAttempt, executeSearch, options.controllerKey, routeKey]);

  const changeQuery = useCallback(
    (next: ListQueryState) => {
      setQuery((current) => {
        const shouldSearch =
          current !== undefined &&
          sameValues(current.values, next.values) &&
          (current.pageNumber !== next.pageNumber ||
            current.pageSize !== next.pageSize);
        if (shouldSearch) {
          optionsRef.current.onQueryCommitted?.(next);
          void executeSearch(next);
        }
        return next;
      });
    },
    [executeSearch],
  );

  const submitSearch = useCallback(() => {
    setQuery((current) => {
      if (current) {
        optionsRef.current.onQueryCommitted?.(current);
        void executeSearch(current);
      }
      return current;
    });
  }, [executeSearch]);

  return {
    changeQuery,
    definition,
    definitionError,
    executeSearch,
    listError,
    loading,
    query,
    result,
    retryDefinition: () => setDefinitionAttempt((value) => value + 1),
    submitSearch,
  };
}

export class ListPageContextError extends Error {}

function emptyResult(query: ListQueryState): PagedResult {
  return {
    items: [],
    pageNumber: query.pageNumber,
    pageSize: query.pageSize,
    totalElements: 0,
    totalPages: 0,
  };
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
