import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { LogisticsRecordRepository } from "../../application/ports/LogisticsRecordRepository";
import { LogisticsMonitoringPage } from "./LogisticsMonitoringPage";

describe("LogisticsMonitoringPage", () => {
  it("renders database metadata and closes draft/pending review actions with versions", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<LogisticsRecordRepository["submit"]>((_id, version) =>
      Promise.resolve({ ...draft, status: "PENDING_REVIEW", version: version + 1 }),
    );
    const returned = vi.fn<LogisticsRecordRepository["returnForCorrection"]>(
      (_id, version, reason) =>
        Promise.resolve({
          ...pending,
          status: "RETURNED",
          returnReason: reason,
          version: version + 1,
        }),
    );
    const repository: LogisticsRecordRepository = {
      definition: () => Promise.resolve(editorDefinition),
      search: () =>
        Promise.resolve({
          items: [draft, pending],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 2,
          totalPages: 1,
        }),
      detail: (id) => Promise.resolve(id === draft.id ? draft : pending),
      create: () => Promise.reject(new Error("not called")),
      saveDraft: () => Promise.reject(new Error("not called")),
      submit,
      approve: () => Promise.reject(new Error("not called")),
      returnForCorrection: returned,
    };
    render(
      <LogisticsMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
        pageKey={{ domain: "LOGISTICS", pageKind: "MONITORING", productCode: "CORN" }}
        repository={repository}
      />,
    );

    expect(await screen.findByRole("heading", { name: "玉米物流监测" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /运输方式/ })).toHaveTextContent(
      "运输明细，不单独重复汇总",
    );
    expect(screen.getAllByText("铁路")).toHaveLength(2);
    expect(screen.getAllByText("公路")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "提交" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("draft-1", 7));
    await user.click(screen.getByRole("button", { name: "退回补充" }));
    await user.type(screen.getByRole("textbox", { name: "退回原因" }), "补充运单依据");
    await user.click(screen.getByRole("button", { name: "确认退回" }));
    await waitFor(() =>
      expect(returned).toHaveBeenCalledWith("pending-1", 3, "补充运单依据"),
    );
    await user.click(screen.getByRole("button", { name: "新建物流记录" }));
    expect(screen.getByRole("textbox", { name: "运单编号" })).toBeVisible();
  });

  it("ignores a late field definition after the product context changes", async () => {
    const user = userEvent.setup();
    let resolveCorn!: (value: typeof editorDefinition) => void;
    const corn = new Promise<typeof editorDefinition>((resolve) => {
      resolveCorn = resolve;
    });
    const repository: LogisticsRecordRepository = {
      definition: (product) =>
        product === "CORN"
          ? corn
          : Promise.resolve({
              ...editorDefinition,
              productCode: "SOYBEAN",
              fields: [
                {
                  ...editorDefinition.fields[0]!,
                  code: "SOY_REFERENCE",
                  label: "大豆运单",
                },
              ],
            }),
      search: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      detail: () => Promise.reject(new Error("not called")),
      create: () => Promise.reject(new Error("not called")),
      saveDraft: () => Promise.reject(new Error("not called")),
      submit: () => Promise.reject(new Error("not called")),
      approve: () => Promise.reject(new Error("not called")),
      returnForCorrection: () => Promise.reject(new Error("not called")),
    };
    const gateway = {
      getDefinition: (key: typeof definition.key) =>
        Promise.resolve({
          ...definition,
          key,
          title: key.productCode === "CORN" ? "玉米物流监测" : "大豆物流监测",
        }),
    };
    const view = render(
      <LogisticsMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={gateway}
        pageKey={{ domain: "LOGISTICS", pageKind: "MONITORING", productCode: "CORN" }}
        repository={repository}
      />,
    );
    view.rerender(
      <LogisticsMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={gateway}
        pageKey={{
          domain: "LOGISTICS",
          pageKind: "MONITORING",
          productCode: "SOYBEAN",
        }}
        repository={repository}
      />,
    );
    expect(await screen.findByRole("heading", { name: "大豆物流监测" })).toBeVisible();
    resolveCorn(editorDefinition);
    await user.click(screen.getByRole("button", { name: "新建物流记录" }));
    expect(screen.getByRole("textbox", { name: "大豆运单" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "运单编号" })).not.toBeInTheDocument();
  });
});

const editorDefinition = {
  productCode: "CORN",
  fields: [
    {
      code: "LOG_REFERENCE",
      label: "运单编号",
      controlType: "TEXT" as const,
      unit: null,
      precision: null,
      scale: null,
      required: true,
      readOnly: false,
      sortOrder: 10,
      options: [],
    },
  ],
  actions: [{ code: "NEW", label: "新建物流记录", scope: "PAGE", sortOrder: 10 }],
};

const draft = {
  id: "draft-1",
  productCode: "CORN",
  values: {
    LOG_TRANSPORT_MODE: "铁路",
    LOG_ROUTE_VOLUME: "10.000 吨",
    LOG_STATUS: "草稿",
  },
  status: "DRAFT",
  returnReason: null,
  allowedActions: ["VIEW", "SUBMIT"],
  version: 7,
} as const;
const pending = {
  id: "pending-1",
  productCode: "CORN",
  values: {
    LOG_TRANSPORT_MODE: "公路",
    LOG_ROUTE_VOLUME: "8.000 吨",
    LOG_STATUS: "待审核",
  },
  status: "PENDING_REVIEW",
  returnReason: null,
  allowedActions: ["VIEW", "APPROVE", "RETURN"],
  version: 3,
} as const;
const definition = {
  key: { domain: "LOGISTICS", pageKind: "MONITORING", productCode: "CORN" },
  title: "玉米物流监测",
  breadcrumbs: [{ id: "LOGISTICS", label: "物流监测" }],
  filters: [
    {
      id: "transportModeCode",
      label: "运输方式",
      control: "select" as const,
      placeholder: "全部运输方式",
      options: [
        { value: "RAIL", label: "铁路" },
        { value: "ROAD", label: "公路" },
      ],
    },
  ],
  defaultContext: {},
  columnGroups: [
    {
      id: "ROUTE",
      label: "物流流向与数量",
      fields: [
        {
          id: "LOG_TRANSPORT_MODE",
          label: "运输方式",
          valueType: "TEXT",
          description: "运输明细，不单独重复汇总",
        },
        { id: "LOG_ROUTE_VOLUME", label: "运量", valueType: "DECIMAL", unit: "吨" },
        { id: "LOG_STATUS", label: "状态", valueType: "TEXT" },
      ],
    },
  ],
  actions: [
    { id: "NEW", label: "新建物流记录", scope: "page" as const },
    { id: "VIEW", label: "查看", scope: "row" as const },
    { id: "SUBMIT", label: "提交", scope: "row" as const },
    { id: "APPROVE", label: "审核通过", scope: "row" as const },
    { id: "RETURN", label: "退回补充", scope: "row" as const },
  ],
  pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
};
