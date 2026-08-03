import { useState } from "react";

import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import type { SupplyAccount, SupplyRunCommand } from "../../domain/supplyAccount";
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

export function SupplyAccountPage({
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
  repository: SupplyAccountRepository;
  routeQuery?: RouteListQuery;
}) {
  const productCode = requireProduct(pageKey);
  const [account, setAccount] = useState<SupplyAccount>();
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [runner, setRunner] = useState<SupplyRunCommand>();
  const controller = useListPageController({
    controllerKey: `${pageKey.domain}/${pageKey.pageKind}/${productCode}`,
    loadDefinition: () => pageDefinitionGateway.getDefinition(pageKey),
    onQueryCommitted,
    onQueryNormalized,
    pageKey,
    routeQuery,
    search: async (query) => {
      const regionCode = query.values.regionCode;
      const marketingYear = query.values.marketingYear;
      if (!regionCode || !marketingYear) {
        setAccount(undefined);
        return {
          items: [],
          pageNumber: 0,
          pageSize: query.pageSize,
          totalElements: 0,
          totalPages: 0,
        };
      }
      const accounts = await repository.find({
        productCode,
        regionCode,
        marketingYear,
        ...(query.values.resultState ? { resultState: query.values.resultState } : {}),
      });
      const latest = accounts[0];
      setAccount(latest);
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

  function openRunner() {
    const regionCode = controller.query?.values.regionCode;
    const marketingYear = controller.query?.values.marketingYear;
    if (!regionCode || !marketingYear) {
      setIssue("请先选择地区并填写营销年度。");
      return;
    }
    setRunner({
      productCode,
      regionCode,
      marketingYear,
      approvedAdjustment: account?.approvedAdjustment ?? "",
      adoptionReason: "",
      adjustmentReason: "",
      expectedDecisionVersion: Math.max(0, (account?.version ?? 1) - 1),
      publish: false,
    });
  }

  async function run() {
    if (!runner || !runner.adoptionReason.trim() || !runner.adjustmentReason.trim())
      return;
    setBusy(true);
    setIssue("");
    try {
      const result = await repository.run(runner);
      setAccount(result);
      setRunner(undefined);
      await controller.refreshLatest();
    } catch {
      setIssue("计算或发布失败：请检查核定来源、理由和并发版本。");
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
      {account && <SupplySummary account={account} />}
      <ListWorkbench
        actionsDisabled={busy}
        definition={controller.definition}
        errorMessage={controller.listError}
        loadRegionChildren={loadRegionChildren}
        {...(loadRegionPath ? { loadRegionPath } : {})}
        loading={controller.loading}
        onAction={(action, rowId) => {
          if (action === "RUN" || action === "ADJUST") openRunner();
          if (action === "VIEW_SOURCE" && rowId && account) {
            const role = rowId.slice(rowId.lastIndexOf(":") + 1);
            const source = account.sources.find(
              (candidate) => candidate.roleCode === role,
            );
            if (source)
              window.open(source.drillDownRoute, "_blank", "noopener,noreferrer");
          }
        }}
        onQueryChange={controller.changeQuery}
        onRetry={() => void controller.executeSearch(controller.query!)}
        onSearch={controller.submitSearch}
        query={controller.query}
        result={controller.result}
      />
      {runner && (
        <div
          aria-labelledby="supply-run-title"
          className="production-dialog supply-run-dialog"
          role="dialog"
        >
          <h2 id="supply-run-title">声明采用值并重新计算</h2>
          <label>
            批准调整值
            <input
              aria-label="批准调整值"
              value={runner.approvedAdjustment}
              onChange={(event) =>
                setRunner({ ...runner, approvedAdjustment: event.target.value })
              }
            />
          </label>
          <label>
            来源采用理由
            <textarea
              aria-label="来源采用理由"
              value={runner.adoptionReason}
              onChange={(event) =>
                setRunner({ ...runner, adoptionReason: event.target.value })
              }
            />
          </label>
          <label>
            调整理由
            <textarea
              aria-label="调整理由"
              value={runner.adjustmentReason}
              onChange={(event) =>
                setRunner({ ...runner, adjustmentReason: event.target.value })
              }
            />
          </label>
          <label>
            <input
              checked={runner.publish}
              onChange={(event) =>
                setRunner({ ...runner, publish: event.target.checked })
              }
              type="checkbox"
            />
            发布为正式结果
          </label>
          <button
            disabled={
              busy ||
              !runner.approvedAdjustment.trim() ||
              !runner.adoptionReason.trim() ||
              !runner.adjustmentReason.trim()
            }
            onClick={() => void run()}
          >
            执行计算
          </button>
          <button onClick={() => setRunner(undefined)}>取消</button>
        </div>
      )}
    </>
  );
}

function SupplySummary({ account }: { account: SupplyAccount }) {
  const totals = account.formula.expressions.map((expression) => {
    const key: Readonly<Record<string, SupplyResultField>> = {
      TOTAL_SUPPLY: "totalSupply",
      TOTAL_USE: "totalUse",
      CALCULATED_ENDING_INVENTORY: "calculatedEndingInventory",
      ADOPTED_ENDING_INVENTORY: "adoptedEndingInventory",
      INVENTORY_RECONCILIATION_DIFFERENCE: "inventoryReconciliationDifference",
    };
    return {
      ...expression,
      value: key[expression.resultCode] ? account[key[expression.resultCode]!] : null,
    };
  });
  return (
    <section aria-label="供需计算说明" className="supply-summary ledger-panel">
      <header>
        <h1>
          {account.formula.name} <small>V{account.formula.version}</small>
        </h1>
        <span
          className={`supply-state supply-state--${account.resultState.toLowerCase()}`}
        >
          {account.resultState}
        </span>
      </header>
      <p className="supply-sign-rule">
        {account.formula.differenceLabel}：{account.formula.differenceExpression}；容差{" "}
        {account.formula.tolerance}
      </p>
      <div className="supply-total-grid">
        {totals.map((item) => (
          <article key={item.resultCode}>
            <span>{item.label}</span>
            <strong>{item.value ?? "—"}</strong>
            <small>{item.expression}</small>
          </article>
        ))}
      </div>
      {account.validationCodes.length > 0 && (
        <div className="page-alert">{account.validationCodes.join("；")}</div>
      )}
    </section>
  );
}

type SupplyResultField =
  | "totalSupply"
  | "totalUse"
  | "calculatedEndingInventory"
  | "adoptedEndingInventory"
  | "inventoryReconciliationDifference";

function requireProduct(key: BusinessPageKey) {
  if (!key.productCode) throw new Error("Supply account page requires product context");
  return key.productCode;
}
