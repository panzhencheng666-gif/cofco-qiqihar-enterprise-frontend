import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpMasterDataRepository } from "./HttpMasterDataRepository";

describe("HttpMasterDataRepository region hierarchy", () => {
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
