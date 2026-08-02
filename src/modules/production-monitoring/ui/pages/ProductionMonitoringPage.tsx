import { useEffect, useState } from "react";

import type { ProductionRecordRepository } from "../../application/ports/ProductionRecordRepository";
import { useProductionCommands } from "../hooks/useProductionCommands";
import type { ProductionRecord } from "../../domain/productionRecord";
import { ProductionRecordEditor } from "../components/ProductionRecordEditor";
import {
  createInitialListQuery,
  type BusinessPageKey,
  type ListPageDefinition,
  type ListQueryState,
  type LoadRegionChildren,
  type LoadRegionPath,
  type PageDefinitionGateway,
} from "../../../../shared/application/page-definition";
import {
  ListWorkbench,
  useListPageController,
} from "../../../../shared/ui/list-workbench";
import type { RouteListQuery } from "../../../../shared/ui/list-workbench";

export type ProductionRouteQuery = RouteListQuery;

export function ProductionMonitoringPage({
  loadCultivars,
  loadRegionChildren,
  loadRegionPath,
  pageDefinitionGateway,
  pageKey,
  repository,
  routeQuery,
  onQueryCommitted,
  onQueryNormalized,
}: {
  loadCultivars?: (
    productCode: string,
  ) => Promise<readonly { value: string; label: string }[]>;
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
  const contextKey = `${pageKey.domain}/${pageKey.pageKind}/${productCode}`;
  const [cultivars, setCultivars] = useState<
    readonly { value: string; label: string }[]
  >([]);
  const controller = useListPageController({
    controllerKey: contextKey,
    loadDefinition: async () => {
      const loaded = await pageDefinitionGateway.getDefinition(pageKey);
      if (!sameKey(loaded.key, pageKey)) throw new Error("definition context mismatch");
      return loaded;
    },
    normalizeRoute: (loaded, current) => route(loaded, current),
    onQueryCommitted,
    onQueryNormalized,
    routeQuery,
    search: (next) =>
      repository.search({
        productCode,
        pageKind: pageKey.pageKind,
        pageNumber: next.pageNumber,
        pageSize: next.pageSize,
        values: next.values,
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
  const records = productionRecords(result?.items ?? []);
  const commands = useProductionCommands({
    contextKey,
    productCode,
    records,
    refresh: async () => {
      if (query) await executeSearch(query);
    },
    repository,
  });

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => (active ? (loadCultivars?.(productCode) ?? []) : []))
      .then((loaded) => {
        if (active) setCultivars(loaded);
      });
    return () => {
      active = false;
    };
  }, [loadCultivars, productCode]);

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
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;
  }
  return (
    <>
      {commands.issue && (
        <div className="page-alert production-action-error" role="alert">
          <span>{commands.issue.message}</span>
          <button onClick={commands.retryIssue} type="button">
            重试操作
          </button>
          <button onClick={commands.dismissIssue} type="button">
            关闭操作错误
          </button>
        </div>
      )}
      <ListWorkbench
        definition={definition}
        errorMessage={listError}
        loadRegionChildren={loadRegionChildren}
        {...(loadRegionPath ? { loadRegionPath } : {})}
        loading={loading}
        onAction={(action, rowId) => void commands.dispatch(action, rowId)}
        onQueryChange={changeQuery}
        onRetry={() => void executeSearch(query)}
        onSearch={submitSearch}
        query={query}
        result={result}
      />
      {commands.editor && (
        <ProductionRecordEditor
          coreFields={definition.columnGroups.flatMap((group) => group.fields)}
          cultivars={cultivars}
          definitionLoading={commands.definitionLoading}
          editor={commands.editor}
          loading={commands.loading}
          loadRegionChildren={loadRegionChildren}
          {...(loadRegionPath ? { loadRegionPath } : {})}
          objectTypeOptions={
            definition.filters.find((filter) => filter.id === "objectTypeCode")
              ?.options ?? []
          }
          onCancel={commands.closeEditor}
          onChange={commands.changeDraft}
          onObjectTypeChange={(value) => void commands.changeObjectType(value)}
          onSave={() => void commands.save()}
        />
      )}
      {commands.returning && (
        <div aria-labelledby="return-title" className="production-dialog" role="dialog">
          <h2 id="return-title">退回产情记录</h2>
          <label>
            退回原因
            <textarea
              aria-label="退回原因"
              onChange={(event) => commands.setReturnReason(event.target.value)}
              value={commands.returnReason}
            />
          </label>
          <button
            disabled={commands.loading || !commands.returnReason.trim()}
            onClick={() => void commands.confirmReturn()}
            type="button"
          >
            确认退回
          </button>
          <button onClick={commands.closeReturn} type="button">
            取消
          </button>
        </div>
      )}
    </>
  );
}

function productionRecords(
  rows: readonly {
    id: string;
    values: Readonly<Record<string, string | number | null | undefined>>;
    allowedActions?: readonly string[];
    version?: number;
  }[],
): readonly ProductionRecord[] {
  return rows.flatMap((row) =>
    row.allowedActions !== undefined && row.version !== undefined
      ? [
          {
            id: row.id,
            values: Object.fromEntries(
              Object.entries(row.values).map(([key, value]) => [
                key,
                value === undefined || typeof value === "number"
                  ? String(value ?? "")
                  : value,
              ]),
            ),
            allowedActions: row.allowedActions,
            version: row.version,
          },
        ]
      : [],
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
