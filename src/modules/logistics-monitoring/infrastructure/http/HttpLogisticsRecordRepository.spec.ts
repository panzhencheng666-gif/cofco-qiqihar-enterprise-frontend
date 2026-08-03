import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpLogisticsRecordRepository } from "./HttpLogisticsRecordRepository";

describe("HttpLogisticsRecordRepository", () => {
  it("keeps rail/road filters and optimistic versions in the REST contract", async () => {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const record = {
      data: {
        id: "event-1",
        productCode: "RICE",
        values: { LOG_TRANSPORT_MODE: "铁路" },
        status: "DRAFT",
        returnReason: null,
        allowedActions: ["VIEW", "SUBMIT"],
        version: 4,
      },
    };
    const http: HttpClient = {
      get: (path, schema) => {
        calls.push({ method: "GET", path });
        return Promise.resolve(
          schema.parse(
            path.includes("pageNumber")
              ? {
                  data: {
                    items: [record.data],
                    pageNumber: 0,
                    pageSize: 20,
                    totalElements: 1,
                    totalPages: 1,
                  },
                }
              : record,
          ),
        );
      },
      post: (path, body, schema) => {
        calls.push({ method: "POST", path, body });
        return Promise.resolve(schema.parse(record));
      },
    };
    const repository = new HttpLogisticsRecordRepository(http);

    await repository.search({
      productCode: "RICE",
      pageNumber: 0,
      pageSize: 20,
      values: { transportModeCode: "RAIL" },
    });
    await repository.submit("event-1", 4);
    await repository.returnForCorrection("event-1", 4, "补充运单");

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/api/v1/logistics-records?productCode=RICE&pageNumber=0&pageSize=20&filter.transportModeCode=RAIL",
      },
      {
        method: "POST",
        path: "/api/v1/logistics-records/event-1/submit",
        body: { version: 4 },
      },
      {
        method: "POST",
        path: "/api/v1/logistics-records/event-1/return",
        body: { version: 4, reason: "补充运单" },
      },
    ]);
  });
});
