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
  });
});

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
