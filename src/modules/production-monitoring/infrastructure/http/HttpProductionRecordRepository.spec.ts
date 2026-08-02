import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpProductionRecordRepository } from "./HttpProductionRecordRepository";

describe("HttpProductionRecordRepository", () => {
  it("consumes database-driven rows without hard-coded PROD mapping", async () => {
    const http: HttpClient = {
      get: (_path, schema) =>
        Promise.resolve(
          schema.parse({
            data: {
              items: [
                {
                  id: "record-1",
                  values: { DYNAMIC_DB_FIELD: "数据库标签值" },
                  allowedActions: ["VIEW", "SUBMIT"],
                  version: 7,
                },
              ],
              pageNumber: 0,
              pageSize: 20,
              totalElements: 1,
              totalPages: 1,
            },
          }),
        ),
    };

    const page = await new HttpProductionRecordRepository(http).search({
      productCode: "SOYBEAN",
      pageKind: "MONITORING",
      pageNumber: 0,
      pageSize: 20,
      values: {},
    });

    expect(page.items[0]).toEqual({
      id: "record-1",
      values: { DYNAMIC_DB_FIELD: "数据库标签值" },
      allowedActions: ["VIEW", "SUBMIT"],
      version: 7,
    });
  });

  it("dispatches detail create save submit approve and return with explicit versions", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const response = {
      data: {
        id: "record-1",
        productCode: "SOYBEAN",
        objectTypeCode: "FARMER",
        regionCode: "230202",
        cultivarCode: null,
        surveyDate: "2026-08-01",
        reportedAt: "2026-08-02T08:00:00+08:00",
        cultivatedAreaMu: "1.0000",
        yieldPerMuKilograms: "2.0000",
        estimatedOutputKilograms: "2.0000",
        status: "DRAFT",
        returnReason: null,
        quality: {},
        costs: {},
        insurance: {},
        subsidies: {},
        allowedActions: ["SAVE", "SUBMIT"],
        version: 3,
      },
    };
    const http: HttpClient = {
      get: (path, schema) => {
        calls.push({ method: "GET", path });
        return Promise.resolve(schema.parse(response));
      },
      post: (path, body, schema) => {
        calls.push({ method: "POST", path, body });
        return Promise.resolve(schema.parse(response));
      },
      put: (path, body, schema) => {
        calls.push({ method: "PUT", path, body });
        return Promise.resolve(schema.parse(response));
      },
    };
    const repository = new HttpProductionRecordRepository(http);
    const draft = {
      productCode: "SOYBEAN",
      objectTypeCode: "FARMER",
      regionCode: "230202",
      cultivarCode: null,
      surveyDate: "2026-08-01",
      cultivatedAreaMu: "1.0000",
      yieldPerMuKilograms: "2.0000",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
    };

    await repository.detail("record-1");
    await repository.create(draft);
    await repository.saveDraft("record-1", 3, draft);
    await repository.submit("record-1", 3);
    await repository.approve("record-1", 3);
    await repository.returnForCorrection("record-1", 3, "补充依据");

    expect(calls).toEqual([
      { method: "GET", path: "/api/v1/production-records/record-1" },
      { method: "POST", path: "/api/v1/production-records", body: draft },
      {
        method: "PUT",
        path: "/api/v1/production-records/record-1",
        body: { ...draft, version: 3 },
      },
      {
        method: "POST",
        path: "/api/v1/production-records/record-1/submit",
        body: { version: 3 },
      },
      {
        method: "POST",
        path: "/api/v1/production-records/record-1/approve",
        body: { version: 3 },
      },
      {
        method: "POST",
        path: "/api/v1/production-records/record-1/return",
        body: { version: 3, reason: "补充依据" },
      },
    ]);
  });
});
