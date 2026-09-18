import type { HttpClient } from "../../api/HttpClient";
import { HttpPageDefinitionGateway } from "./HttpPageDefinitionGateway";

describe("HttpPageDefinitionGateway", () => {
  it("reuses a successful definition request and retries after failure", async () => {
    const response = {
      data: {
        domain: "MARKET",
        pageKind: "MONITORING",
        productCode: "CORN",
        title: "玉米市场采集",
        breadcrumbs: [],
        filters: [],
        defaultContext: {},
        columnGroups: [],
        actions: [],
        pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
      },
    };
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation((_path: string, schema: Parameters<HttpClient["get"]>[1]) =>
        Promise.resolve(schema.parse(response)),
      );
    const gateway = new HttpPageDefinitionGateway({ get });
    const key = { domain: "MARKET", pageKind: "MONITORING", productCode: "CORN" };

    await expect(gateway.getDefinition(key)).rejects.toThrow("offline");
    const first = gateway.getDefinition(key);
    const second = gateway.getDefinition(key);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    await gateway.getDefinition(key);

    expect(get).toHaveBeenCalledTimes(2);
  });

  it("uses the canonical page-definition endpoint", async () => {
    const requestedPaths: string[] = [];
    const http: HttpClient = {
      get: (path, schema) => {
        requestedPaths.push(path);
        return Promise.resolve(
          schema.parse({
            data: {
              domain: "MARKET",
              pageKind: "COLLECTION",
              productCode: "SOYBEAN",
              title: "大豆业务清单",
              breadcrumbs: [],
              filters: [],
              defaultContext: {},
              columnGroups: [],
              actions: [],
              pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50] },
            },
          }),
        );
      },
    };

    const definition = await new HttpPageDefinitionGateway(http).getDefinition({
      domain: "MARKET",
      pageKind: "COLLECTION",
      productCode: "SOYBEAN",
    });

    expect(requestedPaths).toEqual([
      "/api/v1/page-definitions/MARKET/COLLECTION?productCode=SOYBEAN",
    ]);
    expect(definition.key.productCode).toBe("SOYBEAN");
  });

  it("omits the product query for a genuinely product-independent page", async () => {
    const paths: string[] = [];
    const http: HttpClient = {
      get: (path, schema) => {
        paths.push(path);
        return Promise.resolve(
          schema.parse({
            data: {
              domain: "WORKFLOW",
              pageKind: "WORK_ITEMS",
              productCode: null,
              title: "任务列表",
              breadcrumbs: [],
              filters: [],
              defaultContext: {},
              columnGroups: [],
              actions: [],
              pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
            },
          }),
        );
      },
    };

    const definition = await new HttpPageDefinitionGateway(http).getDefinition({
      domain: "WORKFLOW",
      pageKind: "WORK_ITEMS",
    });

    expect(paths).toEqual(["/api/v1/page-definitions/WORKFLOW/WORK_ITEMS"]);
    expect(definition.key).not.toHaveProperty("productCode");
  });
});
