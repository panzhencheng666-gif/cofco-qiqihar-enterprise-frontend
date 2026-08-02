import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpWorkItemRepository } from "./HttpWorkItemRepository";

describe("HttpWorkItemRepository", () => {
  it("sends the canonical server-paged workflow query and maps table values", async () => {
    const calls: string[] = [];
    const http: HttpClient = {
      get: (path, schema) => {
        calls.push(path);
        return Promise.resolve(
          schema.parse({
            data: {
              items: [
                {
                  id: "7",
                  task: "8月大豆复核",
                  domain: "MARKET",
                  region: "龙沙区",
                  product: "大豆",
                  businessPeriod: "2026年8月",
                  dueAt: "2026-08-10T01:00:00Z",
                  workflowNode: "经营部复核",
                  status: "待审核",
                  responsibleParty: "李明",
                },
              ],
              pageNumber: 1,
              pageSize: 20,
              totalElements: 21,
              totalPages: 2,
            },
          }),
        );
      },
    };

    const result = await new HttpWorkItemRepository(http).search({
      scope: "PENDING",
      status: "TO_REVIEW",
      domain: "MARKET",
      regionId: "230202",
      productCode: "SOYBEAN",
      pageNumber: 1,
      pageSize: 20,
    });

    expect(calls).toEqual([
      "/api/v1/work-items?scope=PENDING&status=TO_REVIEW&domain=MARKET&regionId=230202&productCode=SOYBEAN&page=1&pageSize=20",
    ]);
    expect(result.items[0]?.values).toMatchObject({
      WORK_TASK_NAME: "8月大豆复核",
      WORK_REGION_NAME: "龙沙区",
      WORK_STATUS_LABEL: "待审核",
    });
    expect(result.totalElements).toBe(21);
  });
});
