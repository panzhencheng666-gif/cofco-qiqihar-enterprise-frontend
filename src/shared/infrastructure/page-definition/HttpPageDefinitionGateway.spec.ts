import type { HttpClient } from "../../api/HttpClient";
import { HttpPageDefinitionGateway } from "./HttpPageDefinitionGateway";

describe("HttpPageDefinitionGateway", () => {
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
