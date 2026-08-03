import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpSupplyAccountRepository } from "./HttpSupplyAccountRepository";

describe("HttpSupplyAccountRepository", () => {
  it("preserves formula provenance, reasons and the surveyed-minus-adopted sign contract", async () => {
    const response = {
      data: [
        {
          id: "run-1",
          productCode: "CORN",
          regionCode: "230200",
          marketingYear: "2026/27",
          resultVersion: 1,
          decisionVersion: 0,
          resultState: "FORMAL",
          validationCodes: [],
          totalSupply: "10.000",
          totalUse: "8.000",
          calculatedEndingInventory: "2.000",
          approvedAdjustment: "1.000",
          adoptedEndingInventory: "3.000",
          surveyedEndingInventory: "2.750",
          inventoryReconciliationDifference: "-0.250",
          inputSetId: null,
          legacyReadOnly: true,
          balanced: true,
          publishable: true,
          balanceReason: "WITHIN_TOLERANCE",
          adjustmentProposal: null,
          adjustmentAudit: {
            value: "1.000",
            reason: "库存差异经复核",
            actor: "reviewer",
            decidedAt: "2026-08-03T00:00:00Z",
            decisionVersion: 0,
          },
          formula: {
            code: "SUPPLY_BALANCE",
            version: 1,
            name: "供需平衡账户",
            precision: 18,
            scale: 3,
            roundingMode: "HALF_UP",
            tolerance: "0.500",
            differenceCode: "INVENTORY_RECONCILIATION_DIFFERENCE",
            differenceLabel: "库存核对差额（调查期末库存－采用后账面期末库存）",
            differenceExpression:
              "SURVEYED_ENDING_INVENTORY - ADOPTED_ENDING_INVENTORY",
            expressions: [],
          },
          sources: [
            {
              roleCode: "EXTERNAL_INFLOW",
              roleLabel: "区域外流入",
              groupCode: "SUPPLY",
              sourceDomain: "LOGISTICS",
              sourceRecordId: "event-1",
              sourceVersion: 2,
              sourceFieldCode: "ROUTE_VOLUME",
              unitCode: "万吨",
              approvalState: "APPROVED",
              approvedAt: "2026-08-03T00:00:00Z",
              qualityState: "PASSED",
              sourceValue: "1.0000",
              adoptedValue: "1.0000",
              reason: "采用核定物流来源",
              drillDownRoute: "/api/v1/logistics-records/event-1",
            },
          ],
        },
      ],
    };
    let requested = "";
    const http: HttpClient = {
      get: (path, schema) => {
        requested = path;
        return Promise.resolve(schema.parse(response));
      },
    };

    const accounts = await new HttpSupplyAccountRepository(http).find({
      productCode: "CORN",
      regionCode: "230200",
      marketingYear: "2026/27",
      resultState: "FORMAL",
    });

    expect(requested).toContain("resultState=FORMAL");
    expect(accounts[0]?.formula.differenceExpression).toBe(
      "SURVEYED_ENDING_INVENTORY - ADOPTED_ENDING_INVENTORY",
    );
    expect(accounts[0]?.inventoryReconciliationDifference).toBe("-0.250");
    expect(accounts[0]?.inputSetId).toBeNull();
    expect(accounts[0]?.legacyReadOnly).toBe(true);
    expect(accounts[0]?.sources[0]).toMatchObject({
      approvalState: "APPROVED",
      reason: "采用核定物流来源",
      sourceVersion: 2,
    });
  });
});
