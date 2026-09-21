import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpMasterDataRepository } from "./HttpMasterDataRepository";

describe("HttpMasterDataRepository region hierarchy", () => {
  it("reuses successful read requests and keeps applicability keys separate", async () => {
    const get = vi.fn((_path: string, schema: Parameters<HttpClient["get"]>[1]) =>
      Promise.resolve(schema.parse({ data: [{ code: "CORN", name: "玉米" }] })),
    );
    const repository = new HttpMasterDataRepository({ get: get as HttpClient["get"] });

    const first = repository.getProducts("MARKET", "MONITORING");
    const second = repository.getProducts("MARKET", "MONITORING");
    await expect(Promise.all([first, second])).resolves.toEqual([
      [{ id: "CORN", name: "玉米" }],
      [{ id: "CORN", name: "玉米" }],
    ]);
    await repository.getProducts("MARKET", "MONITORING");
    await repository.getProducts("PRODUCTION", "MONITORING");

    expect(get).toHaveBeenCalledTimes(2);
  });

  it("evicts a failed read so the next attempt can recover", async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation((_path: string, schema: Parameters<HttpClient["get"]>[1]) =>
        Promise.resolve(schema.parse({ data: [] })),
      );
    const repository = new HttpMasterDataRepository({ get });

    await expect(repository.getProducts()).rejects.toThrow("offline");
    await expect(repository.getProducts()).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("loads governed business periods with their marketing-year ownership", async () => {
    const http: HttpClient = {
      get: (path, schema) => {
        expect(path).toBe("/api/v1/master-data/business-periods");
        return Promise.resolve(
          schema.parse({
            data: [
              {
                code: "2026-Q3",
                name: "2026年第三季度",
                startsOn: "2026-07-01",
                endsOn: "2026-09-30",
                marketingYearCode: "2026/27",
                marketingYearName: "2026/27营销年度",
              },
            ],
          }),
        );
      },
    };

    await expect(
      new HttpMasterDataRepository(http).getBusinessPeriods(),
    ).resolves.toEqual([
      expect.objectContaining({ id: "2026-Q3", marketingYearCode: "2026/27" }),
    ]);
  });

  it("loads supply survey years and nullable quarters without manufactured dates", async () => {
    const http: HttpClient = {
      get: (path, schema) => {
        expect(path).toBe("/api/v1/master-data/supply-survey-periods");
        return Promise.resolve(
          schema.parse({
            data: [
              {
                code: "2026",
                name: "2026年度",
                surveyYear: 2026,
                surveyQuarter: null,
                precision: "YEAR",
                marketingYearCode: "2026/27",
                marketingYearName: "2026/27营销年度",
              },
              {
                code: "2026-Q3",
                name: "2026年第三季度",
                surveyYear: 2026,
                surveyQuarter: "Q3",
                precision: "QUARTER",
                marketingYearCode: "2026/27",
                marketingYearName: "2026/27营销年度",
              },
            ],
          }),
        );
      },
    };

    await expect(
      new HttpMasterDataRepository(http).getSupplySurveyPeriods(),
    ).resolves.toEqual([
      expect.objectContaining({ id: "2026", surveyQuarter: null, precision: "YEAR" }),
      expect.objectContaining({ id: "2026-Q3", surveyQuarter: "Q3" }),
    ]);
  });

  it("normalizes backend code/name options for product navigation", async () => {
    const http: HttpClient = {
      get: (_path, schema) =>
        Promise.resolve(
          schema.parse({
            data: [
              { code: "CORN", name: "玉米" },
              { code: "SOYBEAN", name: "大豆" },
            ],
          }),
        ),
    };

    await expect(
      new HttpMasterDataRepository(http).getProducts("MARKET", "MONITORING"),
    ).resolves.toEqual([
      { id: "CORN", name: "玉米" },
      { id: "SOYBEAN", name: "大豆" },
    ]);
  });

  it("loads roots and direct children through separate requests", async () => {
    const paths: string[] = [];
    const http: HttpClient = {
      get: (path, schema) => {
        paths.push(path);
        return Promise.resolve(
          schema.parse({
            data: [{ id: "region", label: "测试地区", level: "PREFECTURE" }],
          }),
        );
      },
    };
    const repository = new HttpMasterDataRepository(http);

    await repository.getRegionChildren();
    await repository.getRegionChildren("230200");

    expect(paths).toEqual(["/api/v1/regions", "/api/v1/regions?parentCode=230200"]);
  });

  it("loads all database products for product-independent workflow filters", async () => {
    const paths: string[] = [];
    const http: HttpClient = {
      get: (path, schema) => {
        paths.push(path);
        return Promise.resolve(schema.parse({ data: [] }));
      },
    };

    await new HttpMasterDataRepository(http).getProducts();

    expect(paths).toEqual(["/api/v1/master-data/products"]);
  });
});
