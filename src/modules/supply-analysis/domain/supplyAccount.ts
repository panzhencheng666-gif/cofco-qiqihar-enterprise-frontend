export interface SupplyFormula {
  code: string;
  version: number;
  name: string;
  precision: number;
  scale: number;
  roundingMode: string;
  tolerance: string;
  differenceCode: string;
  differenceLabel: string;
  differenceExpression: string;
  expressions: readonly {
    resultCode: string;
    label: string;
    expression: string;
    sortOrder: number;
  }[];
}

export interface SupplySource {
  roleCode: string;
  roleLabel: string;
  groupCode: string;
  sourceDomain: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceFieldCode: string;
  unitCode: string;
  approvalState: string;
  approvedAt: string;
  qualityState: string;
  sourceValue: string;
  adoptedValue: string;
  reason: string;
  drillDownRoute: string;
}

export interface SupplyAccount {
  id: string;
  productCode: string;
  regionCode: string;
  marketingYear: string;
  resultVersion: number;
  decisionVersion: number;
  resultState: string;
  validationCodes: readonly string[];
  totalSupply: string | null;
  totalUse: string | null;
  calculatedEndingInventory: string | null;
  approvedAdjustment: string | null;
  adoptedEndingInventory: string | null;
  surveyedEndingInventory: string | null;
  inventoryReconciliationDifference: string | null;
  inputSetId: string;
  balanced: boolean;
  publishable: boolean;
  balanceReason: string;
  adjustmentProposal: {
    value: string;
    reason: string;
    requestedBy: string;
    requestedAt: string;
  } | null;
  adjustmentAudit: {
    value: string | null;
    reason: string | null;
    actor: string | null;
    decidedAt: string | null;
    decisionVersion: number;
  } | null;
  formula: SupplyFormula;
  sources: readonly SupplySource[];
}

export interface SupplyRunCommand {
  productCode: string;
  regionCode: string;
  marketingYear: string;
  inputSetId: string;
  adjustmentProposalValue: string;
  adjustmentProposalReason: string;
  expectedDecisionVersion: number;
  publish: boolean;
}
