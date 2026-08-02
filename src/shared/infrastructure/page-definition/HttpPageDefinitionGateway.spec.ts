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
});
