import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";
import type { MarketCollectionRecord } from "../../domain/marketCollection";
import { MarketRecordEditor } from "../components/MarketRecordEditor";
import { ReturnDialog } from "../components/ReturnDialog";
import { useMarketCommands } from "../hooks/useMarketCommands";
import type {
  BusinessPageKey,
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

export type MarketRouteQuery = RouteListQuery;

export function MarketCollectionPage({
  loadRegionChildren,
  loadRegionPath,
  onQueryCommitted,
  onQueryNormalized,
  pageDefinitionGateway,
  pageKey,
  repository,
  routeQuery,
}: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  repository: MarketCollectionRepository;
  routeQuery?: MarketRouteQuery;
}) {
  const productCode = requireProduct(pageKey);
  const contextKey = `${pageKey.domain}/${pageKey.pageKind}/${productCode}`;
  const controller = useListPageController({
    controllerKey: contextKey,
    loadDefinition: () => pageDefinitionGateway.getDefinition(pageKey),
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
    routeQuery,
    search: (query) =>
      repository.search({
        productCode,
        pageKind: pageKey.pageKind,
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        values: query.values,
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
    refreshLatest,
    result,
    retryDefinition,
    submitSearch,
  } = controller;
  const commands = useMarketCommands({
    contextKey,
    productCode,
    records: marketRecords(result?.items ?? []),
    refresh: refreshLatest,
    repository,
  });

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
        <div className="page-alert market-action-error" role="alert">
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
        actionsDisabled={commands.loading}
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
        <MarketRecordEditor
          definitionLoading={commands.definitionLoading}
          editor={commands.editor}
          loading={commands.loading}
          loadRegionChildren={loadRegionChildren}
          {...(loadRegionPath ? { loadRegionPath } : {})}
          onCancel={commands.closeEditor}
          onChange={commands.changeDraft}
          onObjectTypeChange={(value) => void commands.changeObjectType(value)}
          onSave={() => void commands.save()}
        />
      )}
      {commands.returning && (
        <ReturnDialog
          loading={commands.loading}
          onCancel={commands.closeReturn}
          onConfirm={() => void commands.confirmReturn()}
          onReasonChange={commands.setReturnReason}
          reason={commands.returnReason}
        />
      )}
    </>
  );
}

function marketRecords(
  rows: readonly {
    id: string;
    values: Readonly<Record<string, string | number | null | undefined>>;
    allowedActions?: readonly string[];
    version?: number;
  }[],
): readonly MarketCollectionRecord[] {
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
  if (!key.productCode) throw new Error("Market page requires product context");
  return key.productCode;
}
