import { useEffect, useRef, useState } from "react";

import {
  ProductionRepositoryFailure,
  type ProductionRecordRepository,
  type ProductionRepositoryFailureKind,
} from "../../application/ports/ProductionRecordRepository";
import type {
  ProductionDraft,
  ProductionFormDefinition,
  ProductionRecord,
  ProductionRecordDetail,
} from "../../domain/productionRecord";

export interface ProductionEditorSession {
  id?: string;
  version?: number;
  draft: ProductionDraft;
  definition: ProductionFormDefinition;
  allowedActions: readonly string[];
}

export interface ProductionActionIssue {
  message: string;
  retry: () => void;
}

export function useProductionCommands({
  contextKey,
  productCode,
  records,
  refresh,
  repository,
}: {
  contextKey: string;
  productCode: string;
  records: readonly ProductionRecord[];
  refresh: () => Promise<void>;
  repository: ProductionRecordRepository;
}) {
  const [editor, setEditor] = useState<ProductionEditorSession>();
  const [returning, setReturning] = useState<ProductionRecordDetail>();
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [issue, setIssue] = useState<ProductionActionIssue>();
  const requestVersion = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
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
      requestVersion.current += 1;
    };
  }, [contextKey]);

  function active(version: number) {
    return mounted.current && requestVersion.current === version;
  }

  function begin() {
    const version = ++requestVersion.current;
    setIssue(undefined);
    setLoading(true);
    return version;
  }

  function fail(version: number, failure: unknown, retry: () => void) {
    if (!active(version)) return;
    setIssue({ message: actionFailureMessage(failure), retry });
  }

  function refreshFailed(version: number, message: string) {
    if (!active(version)) return;
    setIssue({ message, retry: () => void retryRefresh(message) });
  }

  async function retryRefresh(message: string) {
    const version = begin();
    try {
      await refresh();
    } catch {
      refreshFailed(version, message);
    } finally {
      if (active(version)) setLoading(false);
    }
  }

  async function refreshAfterMutation(version: number, message: string) {
    try {
      if (active(version)) await refresh();
    } catch {
      refreshFailed(version, message);
    }
  }

  async function dispatch(action: string, rowId?: string) {
    const row = records.find((candidate) => candidate.id === rowId);
    if (action !== "NEW" && (!row || !row.allowedActions.includes(action))) return;
    const version = begin();
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
            allowedActions: detail.allowedActions,
          });
        }
      } else if (action === "SUBMIT" && row) {
        await repository.submit(row.id, row.version);
        await refreshAfterMutation(version, "状态已变更，但列表刷新失败，请重试刷新。");
      } else if (action === "APPROVE" && row) {
        await repository.approve(row.id, row.version);
        await refreshAfterMutation(version, "状态已变更，但列表刷新失败，请重试刷新。");
      } else if (action === "RETURN" && row) {
        const detail = await repository.detail(row.id);
        if (active(version)) setReturning(detail);
      }
    } catch (failure) {
      fail(version, failure, () => void dispatch(action, rowId));
    } finally {
      if (active(version)) setLoading(false);
    }
  }

  async function save() {
    if (!editor) return;
    const snapshot = editor;
    const version = begin();
    try {
      if (snapshot.id !== undefined && snapshot.version !== undefined) {
        await repository.saveDraft(snapshot.id, snapshot.version, snapshot.draft);
      } else {
        await repository.create(snapshot.draft);
      }
      if (!active(version)) return;
      setEditor(undefined);
      await refreshAfterMutation(version, "记录已保存，但列表刷新失败，请重试刷新。");
    } catch (failure) {
      fail(version, failure, () => void save());
    } finally {
      if (active(version)) setLoading(false);
    }
  }

  async function confirmReturn() {
    if (!returning || !returnReason.trim()) return;
    const detail = returning;
    const reason = returnReason;
    const version = begin();
    try {
      await repository.returnForCorrection(detail.id, detail.version, reason);
      if (!active(version)) return;
      setReturning(undefined);
      setReturnReason("");
      await refreshAfterMutation(version, "状态已变更，但列表刷新失败，请重试刷新。");
    } catch (failure) {
      fail(version, failure, () => void confirmReturn());
    } finally {
      if (active(version)) setLoading(false);
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
    changeDraft: (draft: ProductionDraft) =>
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
  definition: ProductionFormDefinition,
  productCode: string,
  objectTypeCode?: string,
) {
  if (
    definition.productCode !== productCode ||
    definition.objectTypeCode !== (objectTypeCode ?? null)
  ) {
    throw new Error("Production definition context mismatch");
  }
  return definition;
}

function pruneFacts(
  draft: ProductionDraft,
  definition: ProductionFormDefinition,
): ProductionDraft {
  const allowed = new Map(
    definition.groups.map((group) => [
      group.category,
      new Set(group.fields.map((field) => field.code)),
    ]),
  );
  return {
    ...draft,
    quality: retain(draft.quality, allowed.get("QUALITY")),
    costs: retain(draft.costs, allowed.get("COST")),
    insurance: retain(draft.insurance, allowed.get("INSURANCE")),
    subsidies: retain(draft.subsidies, allowed.get("SUBSIDY")),
  };
}

function retain(
  values: Readonly<Record<string, string>>,
  allowed: ReadonlySet<string> | undefined,
) {
  return Object.fromEntries(
    Object.entries(values).filter(([code]) => allowed?.has(code) ?? false),
  );
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

function actionFailureMessage(failure: unknown) {
  const kind: ProductionRepositoryFailureKind =
    failure instanceof ProductionRepositoryFailure ? failure.kind : "UNEXPECTED";
  if (kind === "AUTHENTICATION") return "登录已失效，请重新登录。";
  if (kind === "CONFLICT") return "记录已被其他用户修改，请刷新后重试。";
  if (kind === "VALIDATION") return "填报内容校验失败，请检查后重试。";
  return "操作失败，请稍后重试。";
}
