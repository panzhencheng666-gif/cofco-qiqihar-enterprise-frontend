import { useEffect, useRef, useState } from "react";

import {
  MarketRepositoryFailure,
  type MarketCollectionRepository,
  type MarketRepositoryFailureKind,
} from "../../application/ports/MarketCollectionRepository";
import type {
  MarketCollectionRecord,
  MarketDraft,
  MarketFormDefinition,
  MarketRecordDetail,
} from "../../domain/marketCollection";

export interface MarketEditorSession {
  id?: string;
  version?: number;
  draft: MarketDraft;
  definition: MarketFormDefinition;
  actualTradePrice: string;
  reportedAt: string;
  allowedActions: readonly string[];
}

export interface MarketActionIssue {
  message: string;
  retry: () => void;
}

export function useMarketCommands({
  contextKey,
  productCode,
  records,
  refresh,
  repository,
}: {
  contextKey: string;
  productCode: string;
  records: readonly MarketCollectionRecord[];
  refresh: () => Promise<void>;
  repository: MarketCollectionRepository;
}) {
  const [editor, setEditor] = useState<MarketEditorSession>();
  const [returning, setReturning] = useState<MarketRecordDetail>();
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [issue, setIssue] = useState<MarketActionIssue>();
  const requestVersion = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    inFlight.current = false;
    requestVersion.current += 1;
    void Promise.resolve().then(() => {
      if (!mounted.current) return;
      setEditor(undefined);
      setReturning(undefined);
      setReturnReason("");
      setIssue(undefined);
      setLoading(false);
      setDefinitionLoading(false);
    });
    return () => {
      mounted.current = false;
      inFlight.current = false;
      requestVersion.current += 1;
    };
  }, [contextKey]);

  function active(version: number) {
    return mounted.current && requestVersion.current === version;
  }

  function begin() {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    const version = ++requestVersion.current;
    setIssue(undefined);
    setLoading(true);
    return version;
  }

  function finish(version: number) {
    if (requestVersion.current !== version) return;
    inFlight.current = false;
    if (active(version)) setLoading(false);
  }

  function fail(version: number, failure: unknown, retry: () => void) {
    if (active(version)) {
      setIssue({ message: actionFailureMessage(failure), retry });
    }
  }

  async function dispatch(action: string, rowId?: string) {
    const row = records.find((candidate) => candidate.id === rowId);
    if (action !== "NEW" && (!row || !row.allowedActions.includes(action))) return;
    const version = begin();
    if (version === undefined) return;
    try {
      if (action === "NEW") {
        const definition = requireDefinitionContext(
          await repository.definition(productCode),
          productCode,
        );
        if (active(version)) {
          setEditor({
            draft: emptyDraft(productCode),
            definition,
            actualTradePrice: "",
            reportedAt: "",
            allowedActions: ["SAVE"],
          });
        }
      } else if (action === "VIEW" && row) {
        const detail = await repository.detail(row.id);
        if (!active(version)) return;
        const definition = requireDefinitionContext(
          await repository.definition(productCode, detail.objectTypeCode),
          productCode,
          detail.objectTypeCode,
        );
        if (active(version)) {
          setEditor({
            id: detail.id,
            version: detail.version,
            draft: detailDraft(detail),
            definition,
            actualTradePrice: detail.actualTradePrice,
            reportedAt: detail.reportedAt,
            allowedActions: detail.allowedActions,
          });
        }
      } else if (action === "SUBMIT" && row) {
        await repository.submit(row.id, row.version);
        if (active(version)) await refresh();
      } else if (action === "APPROVE" && row) {
        await repository.approve(row.id, row.version);
        if (active(version)) await refresh();
      } else if (action === "RETURN" && row) {
        const detail = await repository.detail(row.id);
        if (active(version)) setReturning(detail);
      }
    } catch (failure) {
      fail(version, failure, () => void dispatch(action, rowId));
    } finally {
      finish(version);
    }
  }

  async function save() {
    if (!editor) return;
    const snapshot = editor;
    const version = begin();
    if (version === undefined) return;
    try {
      if (snapshot.id !== undefined && snapshot.version !== undefined) {
        await repository.saveDraft(snapshot.id, snapshot.version, snapshot.draft);
      } else {
        await repository.create(snapshot.draft);
      }
      if (!active(version)) return;
      setEditor(undefined);
      await refresh();
    } catch (failure) {
      fail(version, failure, () => void save());
    } finally {
      finish(version);
    }
  }

  async function confirmReturn() {
    if (!returning || !returnReason.trim()) return;
    const detail = returning;
    const reason = returnReason;
    const version = begin();
    if (version === undefined) return;
    try {
      await repository.returnForCorrection(detail.id, detail.version, reason);
      if (!active(version)) return;
      setReturning(undefined);
      setReturnReason("");
      await refresh();
    } catch (failure) {
      fail(version, failure, () => void confirmReturn());
    } finally {
      finish(version);
    }
  }

  async function changeObjectType(objectTypeCode: string) {
    if (!editor) return;
    const version = ++requestVersion.current;
    setIssue(undefined);
    setDefinitionLoading(true);
    try {
      const definition = requireDefinitionContext(
        await repository.definition(productCode, objectTypeCode || undefined),
        productCode,
        objectTypeCode || undefined,
      );
      if (!active(version)) return;
      setEditor((current) =>
        current
          ? {
              ...current,
              definition,
              draft: pruneFacts({ ...current.draft, objectTypeCode }, definition),
            }
          : current,
      );
    } catch (failure) {
      fail(version, failure, () => void changeObjectType(objectTypeCode));
    } finally {
      if (active(version)) setDefinitionLoading(false);
    }
  }

  return {
    changeDraft: (draft: MarketDraft) =>
      setEditor((current) => (current ? { ...current, draft } : current)),
    changeObjectType,
    closeEditor: () => setEditor(undefined),
    closeReturn: () => setReturning(undefined),
    confirmReturn,
    definitionLoading,
    dismissIssue: () => setIssue(undefined),
    dispatch,
    editor,
    issue,
    loading,
    retryIssue: () => issue?.retry(),
    returnReason,
    returning,
    save,
    setReturnReason,
  };
}

function requireDefinitionContext(
  definition: MarketFormDefinition,
  productCode: string,
  objectTypeCode?: string,
) {
  if (
    definition.productCode !== productCode ||
    definition.objectTypeCode !== (objectTypeCode ?? null)
  ) {
    throw new Error("Market definition context mismatch");
  }
  return definition;
}

function pruneFacts(draft: MarketDraft, definition: MarketFormDefinition): MarketDraft {
  const allowed = new Set(
    definition.groups.flatMap((group) => group.fields.map((field) => field.code)),
  );
  return {
    ...draft,
    facts: Object.fromEntries(
      Object.entries(draft.facts).filter(([code]) => allowed.has(code)),
    ),
  };
}

function emptyDraft(productCode: string): MarketDraft {
  return {
    productCode,
    objectTypeCode: "",
    regionCode: "",
    tradeDate: "",
    direction: "",
    purchaseBasePrice: null,
    saleBasePrice: null,
    carriageBoardAmount: "",
    packagingAmount: "",
    freightAmount: "",
    packagingForm: null,
    facts: {},
  };
}

function detailDraft(record: MarketRecordDetail): MarketDraft {
  return {
    productCode: record.productCode,
    objectTypeCode: record.objectTypeCode,
    regionCode: record.regionCode,
    tradeDate: record.tradeDate,
    direction: record.direction,
    purchaseBasePrice: record.purchaseBasePrice,
    saleBasePrice: record.saleBasePrice,
    carriageBoardAmount: record.carriageBoardAmount,
    packagingAmount: record.packagingAmount,
    freightAmount: record.freightAmount,
    packagingForm: record.packagingForm,
    facts: record.facts,
  };
}

function actionFailureMessage(failure: unknown) {
  const kind: MarketRepositoryFailureKind =
    failure instanceof MarketRepositoryFailure ? failure.kind : "UNEXPECTED";
  if (kind === "AUTHENTICATION") return "登录已失效，请重新登录。";
  if (kind === "CONFLICT") return "记录已被其他用户修改，请刷新后重试。";
  if (kind === "VALIDATION") return "填报内容校验失败，请检查后重试。";
  if (kind === "DEFINITION") {
    return "市场表单定义包含不受支持的字段，请联系管理员。";
  }
  return "操作失败，请稍后重试。";
}
