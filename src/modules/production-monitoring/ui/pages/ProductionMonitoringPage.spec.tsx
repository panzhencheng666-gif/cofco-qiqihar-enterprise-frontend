import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductionMonitoringPage } from "./ProductionMonitoringPage";

describe("ProductionMonitoringPage", () => {
  it("uses one dynamic workbench for corn soybean and rice definitions", async () => {
    const definitions = new Map([
      ["CORN", definition("CORN", "玉米产情监测")],
      ["SOYBEAN", definition("SOYBEAN", "大豆产情监测")],
      ["RICE", definition("RICE", "稻谷产情监测")],
    ]);
    const { rerender } = render(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: (key) => Promise.resolve(definitions.get(key.productCode!)!),
        }}
        pageKey={{ domain: "PRODUCTION", pageKind: "MONITORING", productCode: "CORN" }}
        repository={{
          search: () =>
            Promise.resolve({
              items: [],
              pageNumber: 0,
              pageSize: 20,
              totalElements: 0,
              totalPages: 0,
            }),
        }}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "玉米产情监测" }),
    ).toBeInTheDocument();

    rerender(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: (key) => Promise.resolve(definitions.get(key.productCode!)!),
        }}
        pageKey={{
          domain: "PRODUCTION",
          pageKind: "MONITORING",
          productCode: "SOYBEAN",
        }}
        repository={{
          search: () =>
            Promise.resolve({
              items: [],
              pageNumber: 0,
              pageSize: 20,
              totalElements: 0,
              totalPages: 0,
            }),
        }}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "大豆产情监测" }),
    ).toBeInTheDocument();
  });
});

function definition(productCode: string, title: string) {
  return {
    key: { domain: "PRODUCTION", pageKind: "MONITORING", productCode },
    title,
    breadcrumbs: [],
    filters: [],
    defaultContext: {},
    columnGroups: [],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  } as const;
}
