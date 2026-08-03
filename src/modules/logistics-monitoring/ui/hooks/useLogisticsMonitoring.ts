import { useEffect, useRef, useState } from "react";

import type { LogisticsRecordRepository } from "../../application/ports/LogisticsRecordRepository";
import type {
  LogisticsDefinition,
  LogisticsDraft,
  LogisticsRecord,
} from "../../domain/logisticsRecord";
import type {
  BusinessPageKey,
  ListQueryState,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import { useListPageController } from "../../../../shared/ui/list-workbench";

export function useLogisticsMonitoring({
  onQueryCommitted,
  onQueryNormalized,
  pageDefinitionGateway,
  pageKey,
  repository,
  routeQuery,
}: {
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  repository: LogisticsRecordRepository;
  routeQuery?: RouteListQuery;
}) {
  const productCode = requireProduct(pageKey);
  const currentProduct = useRef(productCode);
  const [definitionState, setDefinitionState] =
    useState<ContextValue<LogisticsDefinition>>();
  const [definitionIssueState, setDefinitionIssueState] =
    useState<ContextValue<string>>();
  const [definitionAttempt, setDefinitionAttempt] = useState(0);
  const [busyState, setBusyState] = useState<ContextValue<boolean>>({
    productCode,
    value: false,
  });
  const [issueState, setIssueState] = useState<ContextValue<string>>({
    productCode,
    value: "",
  });
  const [editorState, setEditorState] = useState<EditorState>();
  const [returningState, setReturningState] = useState<ContextValue<LogisticsRecord>>();
  const [returnReasonState, setReturnReasonState] = useState<ContextValue<string>>({
    productCode,
    value: "",
  });
  const controller = useListPageController({
    controllerKey: `${pageKey.domain}/${pageKey.pageKind}/${productCode}`,
    loadDefinition: () => pageDefinitionGateway.getDefinition(pageKey),
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
    routeQuery,
    search: async (query) => {
      const result = await repository.search({ productCode, ...query });
      return {
        ...result,
        items: result.items.map((record) => ({
          ...record,
          values: record.displayValues,
        })),
      };
    },
  });
  const records = (controller.result?.items ?? []) as readonly LogisticsRecord[];
  const definition = inContext(definitionState, productCode);
  const definitionIssue = inContext(definitionIssueState, productCode) ?? "";
  const busy = inContext(busyState, productCode) ?? false;
  const issue = inContext(issueState, productCode) ?? "";
  const editor = editorState?.productCode === productCode ? editorState : undefined;
  const returning = inContext(returningState, productCode);
  const returnReason = inContext(returnReasonState, productCode) ?? "";

  useEffect(() => {
    currentProduct.current = productCode;
    let active = true;
    void repository
      .definition(productCode)
      .then((loaded) => {
        if (active) setDefinitionState({ productCode, value: loaded });
      })
      .catch(() => {
        if (active)
          setDefinitionIssueState({
            productCode,
            value: "物流字段定义加载失败，请重试。",
          });
      });
    return () => {
      active = false;
    };
  }, [definitionAttempt, productCode, repository]);

  const current = () => currentProduct.current === productCode;
  const setBusy = (value: boolean) => setBusyState({ productCode, value });
  const setIssue = (value: string) => setIssueState({ productCode, value });

  async function act(action: string, rowId?: string) {
    const row = records.find((candidate) => candidate.id === rowId);
    setIssue("");
    if (action === "NEW") {
      if (definition)
        setEditorState({ productCode, draft: emptyDraft(productCode, definition) });
      return;
    }
    if (!row || !row.allowedActions.includes(action)) return;
    setBusy(true);
    try {
      if (action === "VIEW") {
        const detail = await repository.detail(row.id);
        if (current() && definition)
          setEditorState({
            productCode,
            id: detail.id,
            version: detail.version,
            draft: draftFrom(detail, definition),
          });
      } else if (action === "SUBMIT") await repository.submit(row.id, row.version);
      else if (action === "APPROVE") await repository.approve(row.id, row.version);
      else if (action === "RETURN") {
        const detail = await repository.detail(row.id);
        if (current()) setReturningState({ productCode, value: detail });
      }
      if (current() && action !== "VIEW" && action !== "RETURN")
        await controller.refreshLatest();
    } catch {
      if (current()) setIssue("操作失败，记录可能已被其他用户修改，请刷新后重试。");
    } finally {
      if (current()) setBusy(false);
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
      if (!current()) return;
      setEditorState(undefined);
      await controller.refreshLatest();
    } catch {
      if (current()) setIssue("保存失败，请核对必填项、节点和版本后重试。");
    } finally {
      if (current()) setBusy(false);
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
      if (!current()) return;
      setReturningState(undefined);
      setReturnReasonState({ productCode, value: "" });
      await controller.refreshLatest();
    } catch {
      if (current()) setIssue("退回失败，请刷新后重试。");
    } finally {
      if (current()) setBusy(false);
    }
  }

  return {
    act,
    busy,
    cancelReturn: () => setReturningState(undefined),
    changeDraft: (draft: LogisticsDraft) =>
      setEditorState((state) =>
        state?.productCode === productCode ? { ...state, draft } : state,
      ),
    closeEditor: () => setEditorState(undefined),
    confirmReturn,
    controller,
    definition,
    definitionIssue,
    editor,
    issue,
    returning,
    returnReason,
    retryDefinition: () => {
      setDefinitionIssueState({ productCode, value: "" });
      setDefinitionAttempt((attempt) => attempt + 1);
    },
    save,
    setReturnReason: (value: string) => setReturnReasonState({ productCode, value }),
  };
}

interface ContextValue<T> {
  productCode: string;
  value: T;
}
interface EditorState {
  productCode: string;
  id?: string;
  version?: number;
  draft: LogisticsDraft;
}

function inContext<T>(state: ContextValue<T> | undefined, productCode: string) {
  return state?.productCode === productCode ? state.value : undefined;
}

function emptyDraft(
  productCode: string,
  definition: LogisticsDefinition,
): LogisticsDraft {
  return {
    productCode,
    values: Object.fromEntries(
      definition.fields
        .filter((field) => !field.readOnly)
        .map((field) => [field.code, ""]),
    ),
  };
}

function draftFrom(
  record: LogisticsRecord,
  definition: LogisticsDefinition,
): LogisticsDraft {
  return {
    productCode: record.productCode,
    values: Object.fromEntries(
      definition.fields
        .filter((field) => !field.readOnly)
        .map((field) => [field.code, record.values[field.code] ?? ""]),
    ),
  };
}

function requireProduct(key: BusinessPageKey) {
  if (!key.productCode) throw new Error("Logistics page requires product context");
  return key.productCode;
}
