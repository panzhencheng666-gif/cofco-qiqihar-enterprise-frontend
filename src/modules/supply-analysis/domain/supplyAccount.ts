export interface SupplyFormula {
  code: string;
  version: number;
  name: string;
  precision: number;
  scale: number;
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
  version: number;
  resultState: string;
  validationCodes: readonly string[];
  totalSupply: string | null;
  totalUse: string | null;
  calculatedEndingInventory: string | null;
  approvedAdjustment: string | null;
  adoptedEndingInventory: string | null;
  surveyedEndingInventory: string | null;
  inventoryReconciliationDifference: string | null;
  balanced: boolean;
  formula: SupplyFormula;
  sources: readonly SupplySource[];
}

export interface SupplyRunCommand {
  productCode: string;
  regionCode: string;
  marketingYear: string;
  approvedAdjustment: string;
  adoptionReason: string;
  adjustmentReason: string;
  expectedDecisionVersion: number;
  publish: boolean;
}
