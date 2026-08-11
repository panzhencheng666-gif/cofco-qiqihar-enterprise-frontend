import { useEffect, useRef, useState } from "react";

import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import type {
  SupplyAccount,
  SupplyInputWorkspace,
  SupplyRunCommand,
  SupplySourceReleaseCommand,
} from "../../domain/supplyAccount";
import type {
  BusinessPageKey,
  ListQueryState,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import { useListPageController } from "../../../../shared/ui/list-workbench";
import {
  approvalStateLabel,
  qualityStateLabel,
  roleGroupLabel,
} from "../supplyDisplay";

export function useSupplyAccount({
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
  repository: SupplyAccountRepository;
  routeQuery?: RouteListQuery;
}) {
  const productCode = requireProduct(pageKey);
  const requestVersion = useRef(0);
  const activeQueryKey = useRef("");
  const [accountState, setAccountState] = useState<QueryAccount>();
  const [workspaceState, setWorkspaceState] = useState<QueryWorkspace>();
  const [selectionState, setSelectionState] = useState<QuerySelections>();
  const [managerState, setManagerState] = useState<QueryManager>();
  const [runnerState, setRunnerState] = useState<QueryRunner>();
  const [busyState, setBusyState] = useState<ContextValue<boolean>>();
  const [issueState, setIssueState] = useState<ContextValue<string>>();
  const controller = useListPageController({
    controllerKey: `${pageKey.domain}/${pageKey.pageKind}/${productCode}`,
    loadDefinition: () => pageDefinitionGateway.getDefinition(pageKey),
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
    routeQuery,
    search: async (query) => {
      const key = queryKey(productCode, query.values);
      const token = ++requestVersion.current;
      const regionCode = query.values.regionCode;
      const periodCode = query.values.periodCode;
      if (!regionCode || !periodCode) {
        if (token === requestVersion.current) {
          setAccountState(undefined);
          setWorkspaceState(undefined);
        }
        return emptyPage(query.pageSize);
      }
      const criteria = { productCode, regionCode, periodCode };
      const [accounts, workspace] = await Promise.all([
        repository.find({
          ...criteria,
          ...(query.values.resultState
            ? { resultState: query.values.resultState }
            : {}),
        }),
        repository.loadInputWorkspace(criteria),
      ]);
      const requestedVersion = query.values.version;
      const latest = requestedVersion
        ? accounts.find((account) => account.id === requestedVersion)
        : accounts[0];
      if (token === requestVersion.current) {
        setAccountState(
          latest ? { key, account: latest, accounts } : { key, accounts },
        );
        setWorkspaceState({ key, workspace });
        setSelectionState((current) => ({
          key,
          values: selectionsFor(
            workspace,
            current?.key === key ? current.values : undefined,
          ),
          reason: current?.key === key ? current.reason : "",
        }));
      }
      return accountPage(latest, query.pageSize);
    },
  });
  const currentKey = queryKey(productCode, controller.query?.values ?? {});
  const account = accountState?.key === currentKey ? accountState.account : undefined;
  const accounts = accountState?.key === currentKey ? accountState.accounts : [];
  const workspace =
    workspaceState?.key === currentKey ? workspaceState.workspace : undefined;
  const selections = selectionState?.key === currentKey ? selectionState.values : {};
  const inputSetReason =
    selectionState?.key === currentKey ? selectionState.reason : "";
  const manager = managerState?.key === currentKey ? managerState : undefined;
  const runner = runnerState?.key === currentKey ? runnerState.command : undefined;
  const busy = inContext(busyState, currentKey) ?? false;
  const issue = inContext(issueState, currentKey) ?? "";

  useEffect(() => {
    activeQueryKey.current = currentKey;
  }, [currentKey]);

  function context() {
    const regionCode = controller.query?.values.regionCode;
    const periodCode = controller.query?.values.periodCode;
    return regionCode && periodCode
      ? { productCode, regionCode, periodCode }
      : undefined;
  }

  function openInputManager() {
    if (!workspace || !context()) {
      setIssueState({ key: currentKey, value: "请先选择地区和调查期间并执行查询。" });
      return;
    }
    setManagerState({
      key: currentKey,
      manualDrafts: {},
      releaseDraft: emptyReleaseDraft(),
    });
  }

  function openRunner() {
    const values = context();
    const inputSetId = account?.inputSetId ?? workspace?.latestInputSetId;
    if (!values || !inputSetId || account?.legacyReadOnly) {
      setIssueState({
        key: currentKey,
        value: "请先为全部必填项目确认数据来源。",
      });
      return;
    }
    setRunnerState({
      key: currentKey,
      command: {
        ...values,
        inputSetId,
        adjustmentProposalValue: account?.approvedAdjustment ?? "0",
        adjustmentProposalReason: "",
        expectedDecisionVersion:
          account?.decisionVersion ?? workspace?.decisionVersion ?? 0,
        publish: false,
      },
    });
  }

  async function refreshWorkspace(key: string) {
    const values = context();
    if (!values) throw new Error("Supply context is incomplete");
    const refreshed = await repository.loadInputWorkspace(values);
    if (activeQueryKey.current === key) {
      setWorkspaceState({ key, workspace: refreshed });
      setSelectionState((current) => ({
        key,
        values: selectionsFor(
          refreshed,
          current?.key === key ? current.values : undefined,
        ),
        reason: current?.key === key ? current.reason : "",
      }));
    }
    return refreshed;
  }

  async function approveManualInput(roleCode: string) {
    if (!workspace || !manager) return;
    const values = context();
    const role = workspace.roles.find((candidate) => candidate.code === roleCode);
    const draft = manager.manualDrafts[roleCode];
    if (!values || !role?.manualAllowed || !draft?.value.trim() || !draft.reason.trim())
      return;
    const key = currentKey;
    await execute(
      key,
      async () => {
        await repository.approveManualInput({
          ...values,
          roleCode,
          value: draft.value,
          reason: draft.reason,
          expectedVersion: role.manualDecisionVersion,
        });
        await refreshWorkspace(key);
        setManagerState((current) =>
          current?.key === key
            ? {
                ...current,
                manualDrafts: {
                  ...current.manualDrafts,
                  [roleCode]: emptyManualDraft(),
                },
              }
            : current,
        );
      },
      "人工核定未完成：请检查拟采用数值、调整原因，或确认数据是否已被其他员工更新。",
    );
  }

  async function releaseSource() {
    if (!workspace || !manager) return;
    const values = context();
    const draft = manager.releaseDraft;
    if (
      !values ||
      !draft.sourceRecordId.trim() ||
      !draft.sourceFieldCode.trim() ||
      !draft.roleCode ||
      !Number.isInteger(Number(draft.sourceVersion))
    )
      return;
    const key = currentKey;
    await execute(
      key,
      async () => {
        await repository.releaseSource({
          ...values,
          sourceDomain: draft.sourceDomain,
          sourceRecordId: draft.sourceRecordId,
          sourceVersion: Number(draft.sourceVersion),
          roleCode: draft.roleCode,
          sourceFieldCode: draft.sourceFieldCode,
          qualityState: draft.qualityState,
        });
        await refreshWorkspace(key);
        setManagerState((current) =>
          current?.key === key
            ? { ...current, releaseDraft: emptyReleaseDraft() }
            : current,
        );
      },
      "业务来源释放失败：必须引用已审核记录、精确版本和已配置字段语义。",
    );
  }

  async function createInputSet() {
    if (!workspace || !inputSetReason.trim()) return;
    const values = context();
    const items = workspace.roles
      .filter((role) => role.required)
      .map((role) => ({
        roleCode: role.code,
        sourceReleaseId: selections[role.code] ?? "",
      }));
    if (!values || items.some((item) => !item.sourceReleaseId)) return;
    const key = currentKey;
    await execute(
      key,
      async () => {
        const created = await repository.createInputSet({
          ...values,
          reason: inputSetReason,
          expectedVersion: workspace.inputSetVersion,
          items,
        });
        const refreshed = await refreshWorkspace(key);
        setWorkspaceState({
          key,
          workspace: { ...refreshed, latestInputSetId: created.id },
        });
        setIssueState({ key, value: "本次数据来源已确认，可以执行试算或正式发布。" });
      },
      "确认数据来源失败：请确保每个必填账户项目都选择了一个已审核来源。",
    );
  }

  async function run() {
    if (!runner || !runner.adjustmentProposalReason.trim()) return;
    const runnerKey = currentKey;
    await execute(
      runnerKey,
      async () => {
        const result = await repository.run(runner);
        setAccountState({ key: runnerKey, account: result, accounts: [result] });
        setRunnerState((state) => (state?.key === runnerKey ? undefined : state));
        if (activeQueryKey.current === runnerKey) await controller.refreshLatest();
      },
      "计算或发布失败：请检查数据来源、调整建议，或确认数据是否已被其他员工更新。",
    );
  }

  async function execute(key: string, command: () => Promise<void>, message: string) {
    setBusyState({ key, value: true });
    setIssueState({ key, value: "" });
    try {
      await command();
    } catch {
      if (activeQueryKey.current === key) setIssueState({ key, value: message });
    } finally {
      if (activeQueryKey.current === key) setBusyState({ key, value: false });
    }
  }

  return {
    account,
    accounts,
    approveManualInput,
    busy,
    closeInputManager: () => setManagerState(undefined),
    closeRunner: () => setRunnerState(undefined),
    controller,
    createInputSet,
    inputSetReason,
    issue,
    manager,
    openInputManager,
    openRunner,
    releaseSource,
    run,
    runner,
    selectVersion: (resultId: string) => {
      if (!controller.query) return;
      const next = {
        ...controller.query,
        pageNumber: 0,
        values: { ...controller.query.values, version: resultId },
      };
      controller.changeQuery(next);
      controller.submitSearch();
    },
    selections,
    setInputSetReason: (reason: string) =>
      setSelectionState((current) => ({
        key: currentKey,
        values: current?.key === currentKey ? current.values : {},
        reason,
      })),
    setManualDraft: (roleCode: string, draft: ManualDraft) =>
      setManagerState((current) =>
        current?.key === currentKey
          ? { ...current, manualDrafts: { ...current.manualDrafts, [roleCode]: draft } }
          : current,
      ),
    setReleaseDraft: (draft: ReleaseDraft) =>
      setManagerState((current) =>
        current?.key === currentKey ? { ...current, releaseDraft: draft } : current,
      ),
    setRunner: (command: SupplyRunCommand) =>
      setRunnerState({ key: currentKey, command }),
    setSelection: (roleCode: string, sourceReleaseId: string) =>
      setSelectionState((current) => ({
        key: currentKey,
        values: {
          ...(current?.key === currentKey ? current.values : {}),
          [roleCode]: sourceReleaseId,
        },
        reason: current?.key === currentKey ? current.reason : "",
      })),
    viewSource: (rowId: string) => {
      if (!account) return;
      const role = rowId.slice(rowId.lastIndexOf(":") + 1);
      const source = account.sources.find((candidate) => candidate.roleCode === role);
      if (source) window.open(source.drillDownRoute, "_blank", "noopener,noreferrer");
    },
    workspace,
  };
}

export interface ManualDraft {
  value: string;
  reason: string;
}

export interface ReleaseDraft {
  sourceDomain: SupplySourceReleaseCommand["sourceDomain"];
  sourceRecordId: string;
  sourceVersion: string;
  roleCode: string;
  sourceFieldCode: string;
  qualityState: SupplySourceReleaseCommand["qualityState"];
}

interface QueryAccount {
  key: string;
  account?: SupplyAccount;
  accounts: readonly SupplyAccount[];
}
interface QueryWorkspace {
  key: string;
  workspace: SupplyInputWorkspace;
}
interface QuerySelections {
  key: string;
  values: Readonly<Record<string, string>>;
  reason: string;
}
interface QueryManager {
  key: string;
  manualDrafts: Readonly<Record<string, ManualDraft>>;
  releaseDraft: ReleaseDraft;
}
interface QueryRunner {
  key: string;
  command: SupplyRunCommand;
}
interface ContextValue<T> {
  key: string;
  value: T;
}

function selectionsFor(
  workspace: SupplyInputWorkspace,
  current?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    workspace.roles.map((role) => {
      const currentValue = current?.[role.code];
      const validCurrent = Boolean(
        currentValue && role.releases.some((release) => release.id === currentValue),
      );
      return [
        role.code,
        validCurrent && currentValue
          ? currentValue
          : (role.selectedReleaseId ?? role.releases[0]?.id ?? ""),
      ] as const;
    }),
  );
}

function accountPage(account: SupplyAccount | undefined, pageSize: number) {
  return {
    items: account
      ? account.sources.map((source) => ({
          id: `${account.id}:${source.roleCode}`,
          values: {
            SUP_GROUP: roleGroupLabel(source.groupCode),
            SUP_ITEM: source.roleLabel,
            SUP_SOURCE_VALUE: source.sourceValue,
            SUP_ADOPTED_VALUE: source.adoptedValue,
            SUP_REASON: source.reason,
            SUP_SOURCE_STATUS: `${approvalStateLabel(source.approvalState)} · ${qualityStateLabel(source.qualityState)}`,
            SUP_RESULT_STATE: account.resultState,
          },
          allowedActions: ["VIEW_SOURCE"],
        }))
      : [],
    pageNumber: 0,
    pageSize,
    totalElements: account?.sources.length ?? 0,
    totalPages: account ? 1 : 0,
  };
}

function emptyManualDraft(): ManualDraft {
  return { value: "", reason: "" };
}

function emptyReleaseDraft(): ReleaseDraft {
  return {
    sourceDomain: "PRODUCTION",
    sourceRecordId: "",
    sourceVersion: "0",
    roleCode: "",
    sourceFieldCode: "",
    qualityState: "PASSED",
  };
}

function inContext<T>(state: ContextValue<T> | undefined, key: string) {
  return state?.key === key ? state.value : undefined;
}

function queryKey(productCode: string, values: Readonly<Record<string, string>>) {
  return [
    productCode,
    values.regionCode ?? "",
    values.periodCode ?? "",
    values.resultState ?? "",
    values.version ?? "",
  ].join("|");
}

function emptyPage(pageSize: number) {
  return { items: [], pageNumber: 0, pageSize, totalElements: 0, totalPages: 0 };
}

function requireProduct(key: BusinessPageKey) {
  if (!key.productCode) throw new Error("Supply account page requires product context");
  return key.productCode;
}
