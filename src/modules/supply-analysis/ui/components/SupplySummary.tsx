import type { SupplyAccount } from "../../domain/supplyAccount";

export function SupplySummary({ account }: { account: SupplyAccount }) {
  const totals = account.formula.expressions.map((expression) => ({
    ...expression,
    value: resultField[expression.resultCode]
      ? account[resultField[expression.resultCode]!]
      : null,
  }));
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
      <p>
        结果版本 V{account.resultVersion}；决策版本 V{account.decisionVersion}
        ；平衡状态：
        {account.balanced ? "已平衡" : "未平衡"}（{account.balanceReason}）；
        {account.publishable ? "可发布" : "不可发布"}
      </p>
      {account.adjustmentProposal && (
        <p>
          试算调整建议：{account.adjustmentProposal.value}；
          {account.adjustmentProposal.reason}； 申请人{" "}
          {account.adjustmentProposal.requestedBy}；
          {account.adjustmentProposal.requestedAt}
        </p>
      )}
      {account.adjustmentAudit && (
        <p>
          正式批准调整：{account.adjustmentAudit.value ?? "—"}；
          {account.adjustmentAudit.reason ?? "无理由"}；决策人{" "}
          {account.adjustmentAudit.actor ?? "未知"}；
          {account.adjustmentAudit.decidedAt ?? "无时间"}
        </p>
      )}
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
const resultField: Readonly<Record<string, SupplyResultField>> = {
  TOTAL_SUPPLY: "totalSupply",
  TOTAL_USE: "totalUse",
  CALCULATED_ENDING_INVENTORY: "calculatedEndingInventory",
  ADOPTED_ENDING_INVENTORY: "adoptedEndingInventory",
  INVENTORY_RECONCILIATION_DIFFERENCE: "inventoryReconciliationDifference",
};
