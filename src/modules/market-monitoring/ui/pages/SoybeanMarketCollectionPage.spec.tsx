import { render, screen, within } from "@testing-library/react";

import { SoybeanMarketCollectionPage } from "./SoybeanMarketCollectionPage";

describe("SoybeanMarketCollectionPage", () => {
  it("preserves the accepted enterprise page structure and uses repository data", async () => {
    render(
      <SoybeanMarketCollectionPage
        masterDataRepository={{
          getCultivars: () =>
            Promise.resolve([
              { id: "soy-heinong-84", name: "黑农84" },
              { id: "soy-dongsheng-22", name: "东生22" },
            ]),
          getMarketObjectTypes: () =>
            Promise.resolve([
              { id: "trader", name: "贸易商" },
              { id: "deep-processing", name: "深加工企业" },
            ]),
          getMonitoringPeriods: () =>
            Promise.resolve([{ id: "2026-W31", name: "2026 年第 31 周" }]),
          getRegionRoots: () =>
            Promise.resolve([
              { id: "qiqihar", name: "齐齐哈尔市", level: "PREFECTURE" },
            ]),
        }}
        marketCollectionRepository={{
          getDefinition: () =>
            Promise.resolve({
              productCode: "SOYBEAN",
              productName: "大豆",
              fieldGroups: [
                {
                  id: "procurement",
                  name: "采购与成交",
                  fields: [
                    {
                      id: "transactionPrice",
                      name: "实际成交价",
                      unit: "元/吨",
                      note: "含车板、包装、运费",
                    },
                    { id: "wagonPrice", name: "车板价", unit: "元/吨" },
                    { id: "freight", name: "运费", unit: "元/吨" },
                  ],
                },
                {
                  id: "quality",
                  name: "大豆质量",
                  fields: [
                    { id: "protein", name: "蛋白", unit: "%" },
                    { id: "oilYield", name: "出油率", unit: "%" },
                  ],
                },
                {
                  id: "processing",
                  name: "加工生产",
                  fields: [{ id: "dailyInput", name: "加工投入量", unit: "吨/日" }],
                },
                {
                  id: "inventory",
                  name: "库存",
                  fields: [{ id: "endingInventory", name: "期末库存", unit: "吨" }],
                },
              ],
            }),
          search: () => Promise.resolve([]),
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "大豆市场采集表" })).toBeVisible();
    expect(screen.getByRole("search", { name: "大豆市场查询条件" })).toBeVisible();

    const objectTypes = await screen.findByRole("combobox", {
      name: "对象类型",
    });
    expect(within(objectTypes).getByRole("option", { name: "贸易商" })).toBeVisible();

    const cultivars = await screen.findByRole("combobox", {
      name: "具体品种",
    });
    expect(within(cultivars).getByRole("option", { name: "黑农84" })).toBeVisible();

    const table = screen.getByRole("table", { name: "大豆市场采集表" });
    for (const heading of [
      "采购与成交",
      "大豆质量",
      "加工生产",
      "库存",
      "实际成交价",
      "车板价",
      "运费",
      "蛋白",
      "出油率",
    ]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeVisible();
    }
  });
});
