import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpMarketCollectionRepository } from "./HttpMarketCollectionRepository";
import type { MarketRepositoryFailure } from "../../application/ports/MarketCollectionRepository";

describe("HttpMarketCollectionRepository canonical paging contract", () => {
  it("requests the canonical market-records endpoint and preserves server page metadata", async () => {
    const paths: string[] = [];
    const http: HttpClient = {
      get: (path, schema) => {
        paths.push(path);
        return Promise.resolve(
          schema.parse({
            data: {
              items: [
                {
                  id: "record-41",
                  values: { subjectName: "记录41", score: "41.5", note: null },
                  allowedActions: ["VIEW"],
                  version: 4,
                },
              ],
              pageNumber: 2,
              pageSize: 20,
              totalElements: 41,
              totalPages: 3,
            },
          }),
        );
      },
    };

    const result = await new HttpMarketCollectionRepository(http).search({
      productCode: "SOYBEAN",
      pageKind: "MONITORING",
      pageNumber: 2,
      pageSize: 20,
      values: { keyword: "北安" },
    });

    expect(paths).toEqual([
      "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=2&pageSize=20&filter.keyword=%E5%8C%97%E5%AE%89",
    ]);
    expect(result).toEqual({
      items: [
        {
          id: "record-41",
          values: { subjectName: "记录41", score: "41.5", note: null },
          allowedActions: ["VIEW"],
          version: 4,
        },
      ],
      pageNumber: 2,
      pageSize: 20,
      totalElements: 41,
      totalPages: 3,
    });
  });

  it("does not derive a second page or totals from the item array", async () => {
    const http: HttpClient = {
      get: (_path, schema) =>
        Promise.resolve(
          schema.parse({
            data: {
              items: [{ id: "record-11", values: {}, allowedActions: [], version: 0 }],
              pageNumber: 1,
              pageSize: 10,
              totalElements: 101,
              totalPages: 11,
            },
          }),
        ),
    };

    const result = await new HttpMarketCollectionRepository(http).search({
      productCode: "SOYBEAN",
      pageKind: "MONITORING",
      pageNumber: 1,
      pageSize: 10,
      values: {},
    });

    expect(result.pageNumber).toBe(1);
    expect(result.totalElements).toBe(101);
    expect(result.totalPages).toBe(11);
  });

  it("accepts a database-defined supported core field without a frontend code enum", async () => {
    const http: HttpClient = {
      get: (_path, schema) =>
        Promise.resolve(
          schema.parse({
            data: {
              productCode: "CORN",
              objectTypeCode: null,
              coreFields: [
                {
                  code: "MKT_SOURCE_NOTE",
                  label: "来源说明",
                  controlType: "TEXT",
                  capability: "GENERIC",
                  required: false,
                  unit: null,
                  precision: null,
                  scale: null,
                  sortOrder: 10,
                  options: [],
                },
              ],
              groups: [],
            },
          }),
        ),
    };

    await expect(
      new HttpMarketCollectionRepository(http).definition("CORN"),
    ).resolves.toEqual(
      expect.objectContaining({
        coreFields: [expect.objectContaining({ code: "MKT_SOURCE_NOTE" })],
      }),
    );
  });

  it.each([
    ["MARKDOWN", "GENERIC"],
    ["TEXT", "SERVER_ONLY_MAGIC"],
  ])(
    "fails closed for unsupported %s / %s definition semantics",
    async (controlType, capability) => {
      const http: HttpClient = {
        get: (_path, schema) =>
          Promise.resolve(
            schema.parse({
              data: {
                productCode: "CORN",
                objectTypeCode: null,
                coreFields: [
                  {
                    code: "DB_FUTURE_FIELD",
                    label: "未来字段",
                    controlType,
                    capability,
                    required: false,
                    unit: null,
                    precision: null,
                    scale: null,
                    sortOrder: 10,
                    options: [],
                  },
                ],
                groups: [],
              },
            }),
          ),
      };

      await expect(
        new HttpMarketCollectionRepository(http).definition("CORN"),
      ).rejects.toEqual(
        expect.objectContaining<Partial<MarketRepositoryFailure>>({
          kind: "DEFINITION",
        }),
      );
    },
  );
});
