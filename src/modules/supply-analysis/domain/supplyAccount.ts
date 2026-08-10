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
  periodCode: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  periodPrecision: "YEAR" | "QUARTER";
  marketingYear: string;
  resultVersion: number;
  supersedesResultVersion: number | null;
  decisionVersion: number;
  resultState: string;
  temporalGovernanceState: string;
  validationCodes: readonly string[];
  totalSupply: string | null;
  totalUse: string | null;
  calculatedEndingInventory: string | null;
  approvedAdjustment: string | null;
  adoptedEndingInventory: string | null;
  surveyedEndingInventory: string | null;
  inventoryReconciliationDifference: string | null;
  inputSetId: string | null;
  legacyReadOnly: boolean;
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
  periodCode: string;
  inputSetId: string;
  adjustmentProposalValue: string;
  adjustmentProposalReason: string;
  expectedDecisionVersion: number;
  publish: boolean;
}

export interface SupplyInputRelease {
  id: string;
  sourceDomain: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceFieldCode: string;
  value: string;
  unitCode: string;
  qualityState: string;
  approvedAt: string;
}

export interface SupplyInputRole {
  code: string;
  label: string;
  groupCode: string;
  required: boolean;
  sortOrder: number;
  manualAllowed: boolean;
  manualDecisionVersion: number;
  selectedReleaseId: string | null;
  releases: readonly SupplyInputRelease[];
}

export interface SupplyInputWorkspace {
  productCode: string;
  regionCode: string;
  periodCode: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  periodPrecision: "YEAR" | "QUARTER";
  marketingYear: string;
  inputSetVersion: number;
  latestInputSetId: string | null;
  decisionVersion: number;
  roles: readonly SupplyInputRole[];
}

export interface SupplyManualInputCommand {
  productCode: string;
  regionCode: string;
  periodCode: string;
  roleCode: string;
  value: string;
  reason: string;
  expectedVersion: number;
}

export interface SupplySourceReleaseCommand {
  sourceDomain: "PRODUCTION" | "LOGISTICS";
  sourceRecordId: string;
  sourceVersion: number;
  productCode: string;
  regionCode: string;
  periodCode: string;
  roleCode: string;
  sourceFieldCode: string;
  qualityState: "PASSED" | "WARNING" | "BLOCKING";
}

export interface SupplyInputSetCommand {
  productCode: string;
  regionCode: string;
  periodCode: string;
  reason: string;
  expectedVersion: number;
  items: readonly { roleCode: string; sourceReleaseId: string }[];
}

export interface SupplyInputSet {
  id: string;
  version: number;
  productCode: string;
  regionCode: string;
  periodCode: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  periodPrecision: "YEAR" | "QUARTER";
  marketingYear: string;
}
