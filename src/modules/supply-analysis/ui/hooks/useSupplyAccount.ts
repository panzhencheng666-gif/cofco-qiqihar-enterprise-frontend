import { useEffect, useRef, useState } from "react";

import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import type { SupplyAccount, SupplyRunCommand } from "../../domain/supplyAccount";
import type {
  BusinessPageKey,
  ListQueryState,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import { useListPageController } from "../../../../shared/ui/list-workbench";

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
      const marketingYear = query.values.marketingYear;
      if (!regionCode || !marketingYear) {
        if (token === requestVersion.current) setAccountState(undefined);
        return emptyPage(query.pageSize);
      }
      const accounts = await repository.find({
        productCode,
        regionCode,
        marketingYear,
        ...(query.values.resultState ? { resultState: query.values.resultState } : {}),
        ...(query.values.version
          ? { version: Number.parseInt(query.values.version, 10) }
          : {}),
      });
      const latest = accounts[0];
      if (token === requestVersion.current) setAccountState({ key, account: latest });
      return {
        items: latest
          ? latest.sources.map((source) => ({
              id: `${latest.id}:${source.roleCode}`,
              values: {
                SUP_GROUP: source.groupCode,
                SUP_ITEM: source.roleLabel,
                SUP_SOURCE_VALUE: source.sourceValue,
                SUP_ADOPTED_VALUE: source.adoptedValue,
                SUP_REASON: source.reason,
                SUP_SOURCE_STATUS: `${source.approvalState} / ${source.qualityState}`,
                SUP_RESULT_STATE: latest.resultState,
              },
              allowedActions: ["VIEW_SOURCE"],
            }))
          : [],
        pageNumber: 0,
        pageSize: query.pageSize,
        totalElements: latest?.sources.length ?? 0,
        totalPages: latest ? 1 : 0,
      };
    },
  });
  const currentKey = queryKey(productCode, controller.query?.values ?? {});
  const account = accountState?.key === currentKey ? accountState.account : undefined;
  const runner = runnerState?.key === currentKey ? runnerState.command : undefined;
  const busy = inContext(busyState, currentKey) ?? false;
  const issue = inContext(issueState, currentKey) ?? "";

  useEffect(() => {
    activeQueryKey.current = currentKey;
  }, [currentKey]);

  function openRunner() {
    const regionCode = controller.query?.values.regionCode;
    const marketingYear = controller.query?.values.marketingYear;
    if (
      !regionCode ||
      !marketingYear ||
      !account ||
      !account.inputSetId ||
      account.legacyReadOnly
    ) {
      setIssueState({ key: currentKey, value: "请先查询具有明确输入集的供需账户。" });
      return;
    }
    setRunnerState({
      key: currentKey,
      command: {
        productCode,
        regionCode,
        marketingYear,
        inputSetId: account.inputSetId,
        adjustmentProposalValue: account.approvedAdjustment ?? "",
        adjustmentProposalReason: "",
        expectedDecisionVersion: account.decisionVersion,
        publish: false,
      },
    });
  }

  async function run() {
    if (!runner || !runner.adjustmentProposalReason.trim()) return;
    const runnerKey = currentKey;
    setBusyState({ key: runnerKey, value: true });
    setIssueState({ key: runnerKey, value: "" });
    try {
      const result = await repository.run(runner);
      setAccountState({ key: runnerKey, account: result });
      setRunnerState((state) => (state?.key === runnerKey ? undefined : state));
      if (activeQueryKey.current === runnerKey) await controller.refreshLatest();
    } catch {
      if (activeQueryKey.current === runnerKey)
        setIssueState({
          key: runnerKey,
          value: "计算或发布失败：请检查明确输入集、调整建议和并发版本。",
        });
    } finally {
      if (activeQueryKey.current === runnerKey)
        setBusyState({ key: runnerKey, value: false });
    }
  }

  return {
    account,
    busy,
    closeRunner: () => setRunnerState(undefined),
    controller,
    issue,
    openRunner,
    run,
    runner,
    setRunner: (command: SupplyRunCommand) =>
      setRunnerState({ key: currentKey, command }),
    viewSource: (rowId: string) => {
      if (!account) return;
      const role = rowId.slice(rowId.lastIndexOf(":") + 1);
      const source = account.sources.find((candidate) => candidate.roleCode === role);
      if (source) window.open(source.drillDownRoute, "_blank", "noopener,noreferrer");
    },
  };
}

interface QueryAccount {
  key: string;
  account?: SupplyAccount;
}
interface QueryRunner {
  key: string;
  command: SupplyRunCommand;
}
interface ContextValue<T> {
  key: string;
  value: T;
}

function inContext<T>(state: ContextValue<T> | undefined, key: string) {
  return state?.key === key ? state.value : undefined;
}

function queryKey(productCode: string, values: Readonly<Record<string, string>>) {
  return [
    productCode,
    values.regionCode ?? "",
    values.marketingYear ?? "",
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
