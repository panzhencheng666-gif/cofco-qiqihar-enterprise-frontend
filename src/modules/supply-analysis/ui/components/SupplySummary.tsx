import type { SupplyAccount } from "../../domain/supplyAccount";
import {
  balanceReasonLabel,
  chineseDateTime,
  formulaExpressionLabel,
  resultStateLabel,
  validationCodeLabel,
} from "../supplyDisplay";

export function SupplySummary({
  account,
  accounts,
  onVersionChange,
}: {
  account: SupplyAccount;
  accounts: readonly SupplyAccount[];
  onVersionChange: (resultId: string) => void;
}) {
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
          {account.formula.name} <small>公式第{account.formula.version}版</small>
        </h1>
        <span
          className={`supply-state supply-state--${account.resultState.toLowerCase()}`}
        >
          {resultStateLabel(account.resultState)}
        </span>
      </header>
      <p className="supply-sign-rule">
        {account.formula.differenceLabel}：
        {formulaExpressionLabel(account.formula.differenceExpression)}；允许差额{" "}
        {account.formula.tolerance}
      </p>
      <p>
        当前范围：产品 {account.productCode}；调查期间 {account.surveyYear}年
        {account.surveyQuarter ? ` ${account.surveyQuarter}` : "（年度）"}；营销年度
        {account.marketingYear}；地区 {account.regionCode}；结果状态
        {resultStateLabel(account.resultState)}
      </p>
      <p>
        <label>
          结果版本
          <select
            aria-label="历史结果版本"
            onChange={(event) => onVersionChange(event.target.value)}
            value={account.id}
          >
            {accounts.map((version) => (
              <option key={version.id} value={version.id}>
                {version.surveyQuarter ?? "年度"} · 第{version.resultVersion}版 ·{" "}
                {resultStateLabel(version.resultState)}
              </option>
            ))}
          </select>
        </label>
        ；核定第{account.decisionVersion}版；平衡状态：
        {account.balanced ? "已平衡" : "未平衡"}（
        {balanceReasonLabel(account.balanceReason)}）；
        {account.publishable ? "可发布" : "不可发布"}
      </p>
      {account.legacyReadOnly && <p>历史运行来源快照仅供只读查看。</p>}
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
          {chineseDateTime(account.adjustmentAudit.decidedAt)}
        </p>
      )}
      <div className="supply-total-grid">
        {totals.map((item) => (
          <article key={item.resultCode}>
            <span>{item.label}</span>
            <strong>{item.value ?? "—"}</strong>
            <small>{formulaExpressionLabel(item.expression)}</small>
          </article>
        ))}
      </div>
      {account.validationCodes.length > 0 && (
        <div className="page-alert">
          {account.validationCodes.map(validationCodeLabel).join("；")}
        </div>
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
