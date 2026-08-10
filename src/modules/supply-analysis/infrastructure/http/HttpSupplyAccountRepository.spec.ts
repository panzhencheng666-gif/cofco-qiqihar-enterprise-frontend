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
          periodCode: "2026-Q3",
          surveyYear: 2026,
          surveyQuarter: "Q3",
          periodPrecision: "QUARTER",
          marketingYear: "2026/27",
          resultVersion: 1,
          supersedesResultVersion: null,
          decisionVersion: 0,
          resultState: "PUBLISHED",
          temporalGovernanceState: "CONFIRMED",
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
      periodCode: "2026-Q3",
      resultState: "PUBLISHED",
    });

    expect(requested).toContain("periodCode=2026-Q3");
    expect(requested).toContain("resultState=PUBLISHED");
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

  it("loads database-owned input roles and writes manual, released, and selected inputs", async () => {
    const paths: string[] = [];
    const release = {
      data: {
        id: "release-1",
        sourceDomain: "MANUAL",
        sourceRecordId: "manual-1",
        sourceVersion: 0,
        roleCode: "OPENING_INVENTORY",
        sourceFieldCode: "MANUAL_APPROVED_VALUE",
        value: "3.0000",
        unitCode: "万吨",
        approvalState: "APPROVED",
        qualityState: "PASSED",
      },
    };
    const http: HttpClient = {
      get: (path, schema) => {
        paths.push(path);
        return Promise.resolve(
          schema.parse({
            data: {
              productCode: "CORN",
              regionCode: "230200",
              periodCode: "2026-Q3",
              surveyYear: 2026,
              surveyQuarter: "Q3",
              periodPrecision: "QUARTER",
              marketingYear: "2026/27",
              inputSetVersion: 0,
              latestInputSetId: null,
              decisionVersion: 0,
              roles: [
                {
                  code: "OPENING_INVENTORY",
                  label: "期初库存",
                  groupCode: "SUPPLY",
                  required: true,
                  sortOrder: 10,
                  manualAllowed: true,
                  manualDecisionVersion: 0,
                  selectedReleaseId: null,
                  releases: [],
                },
              ],
            },
          }),
        );
      },
      post: (path, _body, schema) => {
        paths.push(path);
        return Promise.resolve(
          schema.parse(
            path === "/api/v1/supply-input-sets"
              ? {
                  data: {
                    id: "input-set-1",
                    version: 1,
                    productCode: "CORN",
                    regionCode: "230200",
                    periodCode: "2026-Q3",
                    surveyYear: 2026,
                    surveyQuarter: "Q3",
                    periodPrecision: "QUARTER",
                    marketingYear: "2026/27",
                  },
                }
              : release,
          ),
        );
      },
    };
    const repository = new HttpSupplyAccountRepository(http);
    const context = {
      productCode: "CORN",
      regionCode: "230200",
      periodCode: "2026-Q3",
    };

    const workspace = await repository.loadInputWorkspace(context);
    await repository.approveManualInput({
      ...context,
      roleCode: "OPENING_INVENTORY",
      value: "3",
      reason: "盘点核定",
      expectedVersion: 0,
    });
    await repository.releaseSource({
      ...context,
      sourceDomain: "PRODUCTION",
      sourceRecordId: "production-1",
      sourceVersion: 2,
      roleCode: "LOCAL_PRODUCTION",
      sourceFieldCode: "PROD_ESTIMATED_OUTPUT",
      qualityState: "PASSED",
    });
    const inputSet = await repository.createInputSet({
      ...context,
      reason: "采用核定来源",
      expectedVersion: 0,
      items: [{ roleCode: "OPENING_INVENTORY", sourceReleaseId: "release-1" }],
    });

    expect(workspace.roles[0]?.label).toBe("期初库存");
    expect(inputSet.id).toBe("input-set-1");
    expect(paths).toEqual([
      "/api/v1/supply-input-workspaces?productCode=CORN&regionCode=230200&periodCode=2026-Q3",
      "/api/v1/supply-inputs/manual-decisions",
      "/api/v1/supply-sources/releases",
      "/api/v1/supply-input-sets",
    ]);
  });
});
