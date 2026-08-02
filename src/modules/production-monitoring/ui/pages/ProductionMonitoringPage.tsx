import { useEffect, useState } from "react";

import type { ProductionRecordRepository } from "../../application/ports/ProductionRecordRepository";
import type {
  ProductionDraft,
  ProductionFormDefinition,
  ProductionRecordDetail,
} from "../../domain/productionRecord";
import { HttpError } from "../../../../shared/api/HttpClient";
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
  RegionHierarchyFilter,
  useListPageController,
} from "../../../../shared/ui/list-workbench";
import type { RouteListQuery } from "../../../../shared/ui/list-workbench";

export type ProductionRouteQuery = RouteListQuery;

interface EditorState {
  id?: string;
  version?: number;
  draft: ProductionDraft;
  definition: ProductionFormDefinition;
  allowedActions: readonly string[];
}

const emptyRegionPath: LoadRegionPath = () => Promise.resolve([]);

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
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editor, setEditor] = useState<EditorState>();
  const [cultivars, setCultivars] = useState<
    readonly { value: string; label: string }[]
  >([]);
  const [returning, setReturning] = useState<ProductionRecordDetail>();
  const [returnReason, setReturnReason] = useState("");
  const controller = useListPageController({
    controllerKey: `${pageKey.domain}/${pageKey.pageKind}/${productCode}`,
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
    executeSearch: search,
    listError,
    loading,
    query,
    result,
    retryDefinition,
    submitSearch,
  } = controller;
  const error = actionError || listError;

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return [];
        setEditor(undefined);
        setCultivars([]);
        return loadCultivars?.(productCode) ?? Promise.resolve([]);
      })
      .then((loaded) => {
        if (active) setCultivars(loaded);
      });
    return () => {
      active = false;
    };
  }, [loadCultivars, productCode]);

  async function dispatch(action: string, rowId?: string) {
    setActionError("");
    if (action === "NEW") {
      setActionLoading(true);
      try {
        const formDefinition = await repository.definition(productCode);
        setEditor({
          draft: emptyDraft(productCode),
          definition: formDefinition,
          allowedActions: ["SAVE"],
        });
      } catch (failure) {
        setActionError(writeError(failure));
      } finally {
        setActionLoading(false);
      }
      return;
    }
    if (!rowId || !result) return;
    const row = result.items.find((item) => item.id === rowId);
    if (!row || row.version === undefined || !row.allowedActions?.includes(action))
      return;
    setActionLoading(true);
    try {
      if (action === "VIEW") {
        const record = await repository.detail(rowId);
        const formDefinition = await repository.definition(
          productCode,
          record.objectTypeCode,
        );
        setEditor({
          id: record.id,
          version: record.version,
          draft: detailDraft(record),
          definition: formDefinition,
          allowedActions: record.allowedActions,
        });
      } else if (action === "SUBMIT") {
        await repository.submit(rowId, row.version);
        if (query) await search(query);
      } else if (action === "APPROVE") {
        await repository.approve(rowId, row.version);
        if (query) await search(query);
      } else if (action === "RETURN") {
        setReturning(await repository.detail(rowId));
      }
    } catch (failure) {
      setActionError(writeError(failure));
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEditor() {
    if (!editor) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (editor.id !== undefined && editor.version !== undefined) {
        await repository.saveDraft(editor.id, editor.version, editor.draft);
      } else {
        await repository.create(editor.draft);
      }
      setEditor(undefined);
      if (query) await search(query);
    } catch (failure) {
      setActionError(writeError(failure));
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmReturn() {
    if (!returning || !returnReason.trim()) return;
    setActionLoading(true);
    try {
      await repository.returnForCorrection(
        returning.id,
        returning.version,
        returnReason,
      );
      setReturning(undefined);
      setReturnReason("");
      if (query) await search(query);
    } catch (failure) {
      setActionError(writeError(failure));
    } finally {
      setActionLoading(false);
    }
  }

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
      <ListWorkbench
        definition={definition}
        loadRegionChildren={loadRegionChildren}
        {...(loadRegionPath ? { loadRegionPath } : {})}
        loading={loading || actionLoading}
        errorMessage={error}
        onAction={(action, rowId) => void dispatch(action, rowId)}
        query={query}
        result={result}
        onRetry={() => void search(query)}
        onSearch={submitSearch}
        onQueryChange={changeQuery}
      />
      {editor && (
        <ProductionEditor
          cultivars={cultivars}
          editor={editor}
          loading={actionLoading}
          loadRegionChildren={loadRegionChildren}
          loadRegionPath={loadRegionPath ?? emptyRegionPath}
          objectTypeOptions={
            definition.filters.find((filter) => filter.id === "objectTypeCode")
              ?.options ?? []
          }
          onCancel={() => setEditor(undefined)}
          onChange={(draft) => setEditor({ ...editor, draft })}
          onObjectTypeChange={(objectTypeCode) => {
            setEditor({
              ...editor,
              draft: { ...editor.draft, objectTypeCode },
            });
            void repository
              .definition(productCode, objectTypeCode || undefined)
              .then((next) =>
                setEditor((current) =>
                  current ? { ...current, definition: next } : current,
                ),
              )
              .catch((failure) => setActionError(writeError(failure)));
          }}
          onSave={() => void saveEditor()}
        />
      )}
      {returning && (
        <div aria-labelledby="return-title" className="production-dialog" role="dialog">
          <h2 id="return-title">退回产情记录</h2>
          <label>
            退回原因
            <textarea
              aria-label="退回原因"
              onChange={(event) => setReturnReason(event.target.value)}
              value={returnReason}
            />
          </label>
          <button
            disabled={actionLoading || !returnReason.trim()}
            onClick={() => void confirmReturn()}
            type="button"
          >
            确认退回
          </button>
          <button onClick={() => setReturning(undefined)} type="button">
            取消
          </button>
        </div>
      )}
    </>
  );
}

function ProductionEditor({
  cultivars,
  editor,
  loading,
  loadRegionChildren,
  loadRegionPath,
  objectTypeOptions,
  onCancel,
  onChange,
  onObjectTypeChange,
  onSave,
}: {
  cultivars: readonly { value: string; label: string }[];
  editor: EditorState;
  loading: boolean;
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath: LoadRegionPath;
  objectTypeOptions: readonly { value: string; label: string }[];
  onCancel: () => void;
  onChange: (draft: ProductionDraft) => void;
  onObjectTypeChange: (value: string) => void;
  onSave: () => void;
}) {
  const draft = editor.draft;
  const editable = editor.id === undefined || editor.allowedActions.includes("SAVE");
  const change = (key: keyof ProductionDraft, value: unknown) =>
    onChange({ ...draft, [key]: value });
  return (
    <div
      aria-labelledby="production-editor-title"
      className="production-dialog"
      role="dialog"
    >
      <h2 id="production-editor-title">
        {editor.id === undefined ? "新建产情填报" : "产情记录详情"}
      </h2>
      <fieldset disabled={!editable || loading}>
        <label>
          对象类型
          <select
            aria-label="对象类型"
            onChange={(event) => onObjectTypeChange(event.target.value)}
            value={draft.objectTypeCode}
          >
            <option value="">请选择对象类型</option>
            {objectTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          地区
          <RegionHierarchyFilter
            label="地区"
            loadChildren={loadRegionChildren}
            loadPath={loadRegionPath}
            onChange={(value) => change("regionCode", value)}
            placeholder="请选择地区"
            value={draft.regionCode}
          />
        </label>
        {cultivars.length > 0 && (
          <label>
            品种
            <select
              aria-label="品种"
              onChange={(event) => change("cultivarCode", event.target.value || null)}
              value={draft.cultivarCode ?? ""}
            >
              <option value="">不选择具体品种</option>
              {cultivars.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          调查日期
          <input
            aria-label="调查日期"
            onChange={(event) => change("surveyDate", event.target.value)}
            type="date"
            value={draft.surveyDate}
          />
        </label>
        <label>
          种植面积（亩）
          <input
            aria-label="种植面积（亩）"
            inputMode="decimal"
            onChange={(event) => change("cultivatedAreaMu", event.target.value)}
            value={draft.cultivatedAreaMu}
          />
        </label>
        <label>
          亩产（公斤/亩）
          <input
            aria-label="亩产（公斤/亩）"
            inputMode="decimal"
            onChange={(event) => change("yieldPerMuKilograms", event.target.value)}
            value={draft.yieldPerMuKilograms}
          />
        </label>
        {editor.definition.groups.map((group) => (
          <fieldset key={group.category}>
            <legend>{categoryLabel(group.category)}</legend>
            {group.fields.map((field) => (
              <label key={field.code}>
                {field.label}
                {field.unit ? `（${field.unit}）` : ""}
                <input
                  aria-label={field.label}
                  inputMode="decimal"
                  onChange={(event) =>
                    changeFact(
                      onChange,
                      draft,
                      group.category,
                      field.code,
                      event.target.value,
                    )
                  }
                  value={factValues(draft, group.category)[field.code] ?? ""}
                />
                {field.description && <small>{field.description}</small>}
              </label>
            ))}
          </fieldset>
        ))}
      </fieldset>
      {editable && (
        <button disabled={loading} onClick={onSave} type="button">
          保存草稿
        </button>
      )}
      <button onClick={onCancel} type="button">
        关闭
      </button>
    </div>
  );
}

function changeFact(
  onChange: (draft: ProductionDraft) => void,
  draft: ProductionDraft,
  category: string,
  code: string,
  value: string,
) {
  const key = categoryKey(category);
  onChange({ ...draft, [key]: { ...draft[key], [code]: value } });
}
function categoryKey(
  category: string,
): "quality" | "costs" | "insurance" | "subsidies" {
  return category === "QUALITY"
    ? "quality"
    : category === "COST"
      ? "costs"
      : category === "INSURANCE"
        ? "insurance"
        : "subsidies";
}
function factValues(draft: ProductionDraft, category: string) {
  return draft[categoryKey(category)];
}
function categoryLabel(category: string) {
  return category === "QUALITY"
    ? "质量"
    : category === "COST"
      ? "成本"
      : category === "INSURANCE"
        ? "保险"
        : "补贴";
}
function emptyDraft(productCode: string): ProductionDraft {
  return {
    productCode,
    objectTypeCode: "",
    regionCode: "",
    cultivarCode: null,
    surveyDate: "",
    cultivatedAreaMu: "",
    yieldPerMuKilograms: "",
    quality: {},
    costs: {},
    insurance: {},
    subsidies: {},
  };
}
function detailDraft(record: ProductionRecordDetail): ProductionDraft {
  return {
    productCode: record.productCode,
    objectTypeCode: record.objectTypeCode,
    regionCode: record.regionCode,
    cultivarCode: record.cultivarCode,
    surveyDate: record.surveyDate,
    cultivatedAreaMu: record.cultivatedAreaMu,
    yieldPerMuKilograms: record.yieldPerMuKilograms,
    quality: record.quality,
    costs: record.costs,
    insurance: record.insurance,
    subsidies: record.subsidies,
  };
}
function writeError(failure: unknown) {
  const status =
    failure instanceof HttpError
      ? failure.status
      : typeof failure === "object" && failure !== null && "status" in failure
        ? Number(failure.status)
        : 0;
  if (status === 401) return "登录已失效，请重新登录。";
  if (status === 409) return "记录已被其他用户修改，请刷新后重试。";
  if (status === 400) return "填报内容校验失败，请检查后重试。";
  return "操作失败，请稍后重试。";
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
