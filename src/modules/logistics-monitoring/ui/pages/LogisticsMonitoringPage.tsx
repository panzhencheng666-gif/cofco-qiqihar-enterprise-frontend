import { useState } from "react";

import type { LogisticsRecordRepository } from "../../application/ports/LogisticsRecordRepository";
import type { LogisticsDraft, LogisticsRecord } from "../../domain/logisticsRecord";
import type {
  BusinessPageKey,
  DefinitionOption,
  FieldDefinition,
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

export function LogisticsMonitoringPage({
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
  repository: LogisticsRecordRepository;
  routeQuery?: RouteListQuery;
}) {
  const productCode = requireProduct(pageKey);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [editor, setEditor] = useState<{
    id?: string;
    version?: number;
    draft: LogisticsDraft;
  }>();
  const [returning, setReturning] = useState<LogisticsRecord>();
  const [returnReason, setReturnReason] = useState("");
  const controller = useListPageController({
    controllerKey: `${pageKey.domain}/${pageKey.pageKind}/${productCode}`,
    loadDefinition: () => pageDefinitionGateway.getDefinition(pageKey),
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
    routeQuery,
    search: (query) => repository.search({ productCode, ...query }),
  });
  const records = (controller.result?.items ?? []) as readonly LogisticsRecord[];

  async function act(action: string, rowId?: string) {
    const row = records.find((candidate) => candidate.id === rowId);
    setIssue("");
    if (action === "NEW") {
      setEditor({
        draft: emptyDraft(
          productCode,
          controller.definition?.columnGroups.flatMap((group) => group.fields) ?? [],
        ),
      });
      return;
    }
    if (!row || !row.allowedActions.includes(action)) return;
    setBusy(true);
    try {
      if (action === "VIEW") {
        const detail = await repository.detail(row.id);
        setEditor({ id: detail.id, version: detail.version, draft: draftFrom(detail) });
      } else if (action === "SUBMIT") await repository.submit(row.id, row.version);
      else if (action === "APPROVE") await repository.approve(row.id, row.version);
      else if (action === "RETURN") setReturning(await repository.detail(row.id));
      if (action !== "VIEW" && action !== "RETURN") await controller.refreshLatest();
    } catch {
      setIssue("操作失败，记录可能已被其他用户修改，请刷新后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!editor) return;
    setBusy(true);
    setIssue("");
    try {
      if (editor.id !== undefined && editor.version !== undefined)
        await repository.saveDraft(editor.id, editor.version, editor.draft);
      else await repository.create(editor.draft);
      setEditor(undefined);
      await controller.refreshLatest();
    } catch {
      setIssue("保存失败，请核对必填项、节点和版本后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReturn() {
    if (!returning || !returnReason.trim()) return;
    setBusy(true);
    try {
      await repository.returnForCorrection(
        returning.id,
        returning.version,
        returnReason,
      );
      setReturning(undefined);
      setReturnReason("");
      await controller.refreshLatest();
    } catch {
      setIssue("退回失败，请刷新后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (controller.definitionError)
    return (
      <div className="page-alert" role="alert">
        {controller.definitionError}
        <button onClick={controller.retryDefinition}>重试页面定义</button>
      </div>
    );
  if (!controller.definition || !controller.query || !controller.result)
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;

  return (
    <>
      {issue && (
        <div className="page-alert" role="alert">
          {issue}
        </div>
      )}
      <ListWorkbench
        actionsDisabled={busy}
        definition={controller.definition}
        errorMessage={controller.listError}
        loadRegionChildren={loadRegionChildren}
        {...(loadRegionPath ? { loadRegionPath } : {})}
        loading={controller.loading}
        onAction={(action, id) => void act(action, id)}
        onQueryChange={controller.changeQuery}
        onRetry={() => void controller.executeSearch(controller.query!)}
        onSearch={controller.submitSearch}
        query={controller.query}
        result={controller.result}
      />
      {editor && (
        <LogisticsEditor
          busy={busy}
          fields={controller.definition.columnGroups.flatMap((group) => group.fields)}
          transportOptions={
            controller.definition.filters.find(
              (filter) => filter.id === "transportModeCode",
            )?.options ?? []
          }
          session={editor}
          onCancel={() => setEditor(undefined)}
          onChange={(draft) =>
            setEditor((current) => (current ? { ...current, draft } : current))
          }
          onSave={() => void save()}
        />
      )}
      {returning && (
        <div
          aria-labelledby="logistics-return-title"
          className="production-dialog"
          role="dialog"
        >
          <h2 id="logistics-return-title">退回物流记录</h2>
          <label>
            退回原因
            <textarea
              aria-label="退回原因"
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
            />
          </label>
          <button
            disabled={busy || !returnReason.trim()}
            onClick={() => void confirmReturn()}
          >
            确认退回
          </button>
          <button onClick={() => setReturning(undefined)}>取消</button>
        </div>
      )}
    </>
  );
}

function LogisticsEditor({
  busy,
  fields,
  transportOptions,
  session,
  onCancel,
  onChange,
  onSave,
}: {
  busy: boolean;
  fields: readonly FieldDefinition[];
  transportOptions: readonly DefinitionOption[];
  session: { draft: LogisticsDraft };
  onCancel: () => void;
  onChange: (draft: LogisticsDraft) => void;
  onSave: () => void;
}) {
  const d = session.draft;
  return (
    <div
      aria-labelledby="logistics-editor-title"
      className="production-dialog logistics-editor"
      role="dialog"
    >
      <h2 id="logistics-editor-title">物流事件填报</h2>
      <div className="logistics-editor-grid">
        {fields.flatMap((field) => {
          const key = logisticsDraftFields[field.id];
          if (!key) return [];
          const value = d[key];
          if (key === "transportModeCode")
            return [
              <label key={field.id}>
                {field.label}
                <select
                  aria-label={field.label}
                  value={String(value)}
                  onChange={(event) => onChange({ ...d, [key]: event.target.value })}
                >
                  <option value="">请选择</option>
                  {transportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>,
            ];
          const numericNode = key === "originNodeId" || key === "destinationNodeId";
          return [
            <label key={field.id}>
              {field.label}
              {field.unit && <small>{field.unit}</small>}
              <input
                aria-label={field.label}
                min={numericNode ? "1" : undefined}
                type={
                  numericNode || field.valueType === "DECIMAL"
                    ? "number"
                    : field.valueType === "DATE"
                      ? "date"
                      : "text"
                }
                value={numericNode ? value || "" : String(value)}
                onChange={(event) =>
                  onChange({
                    ...d,
                    [key]: numericNode
                      ? Number(event.target.value)
                      : event.target.value,
                  })
                }
              />
            </label>,
          ];
        })}
      </div>
      <button disabled={busy} onClick={onSave}>
        保存草稿
      </button>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}

const logisticsDraftFields: Readonly<Partial<Record<string, keyof LogisticsDraft>>> = {
  LOG_COLLECTION_DATE: "collectionDate",
  LOG_PERIOD: "monitoringPeriodCode",
  LOG_ORIGIN: "originNodeId",
  LOG_DESTINATION: "destinationNodeId",
  LOG_TRANSPORT_MODE: "transportModeCode",
  LOG_DIRECTION: "direction",
  LOG_ROUTE_VOLUME: "routeVolume",
  LOG_FREIGHT_RATE: "freightRate",
  LOG_TRANSIT_TIME: "transitTime",
  LOG_SOURCE_ORGANIZATION: "sourceOrganization",
  LOG_REPORTER: "reporter",
};

function emptyDraft(
  productCode: string,
  fields: readonly FieldDefinition[],
): LogisticsDraft {
  const unit = (id: string) => fields.find((field) => field.id === id)?.unit ?? "";
  return {
    productCode,
    monitoringPeriodCode: "",
    collectionDate: "",
    originNodeId: 0,
    destinationNodeId: 0,
    transportModeCode: "",
    direction: "",
    routeVolume: "",
    volumeUnit: unit("LOG_ROUTE_VOLUME"),
    freightRate: "",
    freightUnit: unit("LOG_FREIGHT_RATE"),
    transitTime: "",
    transitUnit: unit("LOG_TRANSIT_TIME"),
    sourceOrganization: "",
    reporter: "",
  };
}

function draftFrom(record: LogisticsRecord): LogisticsDraft {
  const v = record.values;
  return {
    productCode: record.productCode,
    monitoringPeriodCode: v.__monitoringPeriodCode ?? "",
    collectionDate: v.LOG_COLLECTION_DATE ?? "",
    originNodeId: Number(v.__originNodeId ?? 0),
    destinationNodeId: Number(v.__destinationNodeId ?? 0),
    transportModeCode: v.__transportModeCode ?? "",
    direction: v.__directionCode ?? "",
    routeVolume: v.__routeVolume ?? "",
    volumeUnit: v.__volumeUnit ?? "",
    freightRate: v.__freightRate ?? "",
    freightUnit: v.__freightUnit ?? "",
    transitTime: v.__transitTime ?? "",
    transitUnit: v.__transitUnit ?? "",
    sourceOrganization: v.__sourceOrganization ?? "",
    reporter: v.__reporter ?? "",
  };
}

function requireProduct(key: BusinessPageKey) {
  if (!key.productCode) throw new Error("Logistics page requires product context");
  return key.productCode;
}
