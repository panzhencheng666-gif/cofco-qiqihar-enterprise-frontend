import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import type { SupplyRunCommand } from "../../domain/supplyAccount";

const formulaSchema = z.object({
  code: z.string(),
  version: z.number().int(),
  name: z.string(),
  precision: z.number().int(),
  scale: z.number().int(),
  roundingMode: z.string(),
  tolerance: z.string(),
  differenceCode: z.string(),
  differenceLabel: z.string(),
  differenceExpression: z.string(),
  expressions: z.array(
    z.object({
      resultCode: z.string(),
      label: z.string(),
      expression: z.string(),
      sortOrder: z.number().int(),
    }),
  ),
});
const sourceSchema = z.object({
  roleCode: z.string(),
  roleLabel: z.string(),
  groupCode: z.string(),
  sourceDomain: z.string(),
  sourceRecordId: z.string(),
  sourceVersion: z.number().int(),
  sourceFieldCode: z.string(),
  unitCode: z.string(),
  approvalState: z.string(),
  approvedAt: z.string(),
  qualityState: z.string(),
  sourceValue: z.string(),
  adoptedValue: z.string(),
  reason: z.string(),
  drillDownRoute: z.string(),
});
const accountSchema = z.object({
  id: z.string(),
  productCode: z.string(),
  regionCode: z.string(),
  marketingYear: z.string(),
  resultVersion: z.number().int(),
  decisionVersion: z.number().int(),
  resultState: z.string(),
  validationCodes: z.array(z.string()),
  totalSupply: z.string().nullable(),
  totalUse: z.string().nullable(),
  calculatedEndingInventory: z.string().nullable(),
  approvedAdjustment: z.string().nullable(),
  adoptedEndingInventory: z.string().nullable(),
  surveyedEndingInventory: z.string().nullable(),
  inventoryReconciliationDifference: z.string().nullable(),
  inputSetId: z.string().nullable(),
  legacyReadOnly: z.boolean(),
  balanced: z.boolean(),
  publishable: z.boolean(),
  balanceReason: z.string(),
  adjustmentProposal: z
    .object({
      value: z.string(),
      reason: z.string(),
      requestedBy: z.string(),
      requestedAt: z.string(),
    })
    .nullable(),
  adjustmentAudit: z
    .object({
      value: z.string().nullable(),
      reason: z.string().nullable(),
      actor: z.string().nullable(),
      decidedAt: z.string().nullable(),
      decisionVersion: z.number().int(),
    })
    .nullable(),
  formula: formulaSchema,
  sources: z.array(sourceSchema),
});

export class HttpSupplyAccountRepository implements SupplyAccountRepository {
  constructor(private readonly http: HttpClient) {}
  async find(criteria: Parameters<SupplyAccountRepository["find"]>[0]) {
    return (
      await this.http.get(
        `/api/v1/supply-accounts${queryString(criteria)}`,
        z.object({ data: z.array(accountSchema) }),
      )
    ).data;
  }
  async run(command: SupplyRunCommand) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (
      await this.http.post(
        "/api/v1/supply-accounts/runs",
        command,
        z.object({ data: accountSchema }),
      )
    ).data;
  }
}
