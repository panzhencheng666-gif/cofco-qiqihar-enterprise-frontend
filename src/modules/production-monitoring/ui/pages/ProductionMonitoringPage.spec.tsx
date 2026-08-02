import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductionMonitoringPage } from "./ProductionMonitoringPage";
import { useProductionCommands } from "../hooks/useProductionCommands";
import {
  ProductionRepositoryFailure,
  type ProductionRecordRepository,
  type ProductionRepositoryFailureKind,
} from "../../application/ports/ProductionRecordRepository";
import type {
  ProductionFormDefinition,
  ProductionRecordDetail,
} from "../../domain/productionRecord";
import type { ListPageDefinition } from "../../../../shared/application/page-definition";

describe("ProductionMonitoringPage", () => {
  it.each(["resolve", "reject"] as const)(
    "releases the mutation owner after mixed VIEW and NEW requests when the mutation %s",
    async (outcome) => {
      const firstSubmit = deferred<ProductionRecordDetail>();
      const staleDetail = deferred<ProductionRecordDetail>();
      const submit = vi
        .fn<ProductionRecordRepository["submit"]>()
        .mockReturnValueOnce(firstSubmit.promise)
        .mockResolvedValueOnce(detail("PENDING_REVIEW", 9));
      const repository = repositoryFixture({
        submit,
        detail: () => staleDetail.promise,
      });
      const refresh = vi.fn(() => Promise.resolve());
      const { result } = renderHook(() =>
        useProductionCommands({
          contextKey: "PRODUCTION/MONITORING/CORN",
          productCode: "CORN",
          records: rowPage("SUBMIT").items,
          refresh,
          repository,
        }),
      );
      await act(async () => Promise.resolve());

      let mutation!: Promise<void>;
      await act(async () => {
        mutation = result.current.dispatch("SUBMIT", "record-1");
        await Promise.resolve();
      });
      expect(result.current.loading).toBe(true);

      await act(async () => {
        void result.current.dispatch("VIEW", "record-1");
        void result.current.dispatch("NEW");
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.editor?.id).toBeUndefined());
      expect(result.current.loading).toBe(true);

      await act(async () => {
        staleDetail.resolve(detail("APPROVED", 17));
        await staleDetail.promise;
      });
      expect(result.current.editor?.id).toBeUndefined();

      await act(async () => {
        if (outcome === "resolve") firstSubmit.resolve(detail("PENDING_REVIEW", 8));
        else firstSubmit.reject(new Error("submit failed"));
        await mutation;
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.dispatch("SUBMIT", "record-1");
      });
      expect(submit).toHaveBeenCalledTimes(2);
    },
  );

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
        repository={repositoryFixture()}
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
        repository={repositoryFixture()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "大豆产情监测" }),
    ).toBeInTheDocument();

    rerender(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: (key) => Promise.resolve(definitions.get(key.productCode!)!),
        }}
        pageKey={{ domain: "PRODUCTION", pageKind: "MONITORING", productCode: "RICE" }}
        repository={repositoryFixture()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "稻谷产情监测" }),
    ).toBeInTheDocument();
  });

  it("renders only allowed database actions and dispatches real submit with version", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => Promise.resolve(detail("PENDING_REVIEW", 8)));
    const repository = repositoryFixture({
      search: () =>
        Promise.resolve({
          items: [
            {
              id: "record-1",
              values: { PROD_STATUS: "草稿" },
              allowedActions: ["VIEW", "SUBMIT"],
              version: 7,
            },
          ],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      submit,
    });

    render(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: () => Promise.resolve(actionDefinition()),
        }}
        pageKey={{
          domain: "PRODUCTION",
          pageKind: "MONITORING",
          productCode: "SOYBEAN",
        }}
        repository={repository}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "提交" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("record-1", 7));
    expect(screen.queryByRole("button", { name: "审核" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退回" })).not.toBeInTheDocument();
  });

  it.each([
    ["CORN", "MOISTURE", "水分"],
    ["SOYBEAN", "PROTEIN", "蛋白"],
    ["RICE", "MILLING_YIELD", "出米率"],
  ] as const)(
    "renders and saves all four migrated fact groups for %s",
    async (productCode, qualityCode, qualityLabel) => {
      const user = userEvent.setup();
      const create = vi.fn(() => Promise.resolve(detail("DRAFT", 0)));
      const repository = repositoryFixture({
        create,
        definition: (_requestedProduct, objectTypeCode) =>
          Promise.resolve(
            confirmedFormDefinition(
              productCode,
              qualityCode,
              qualityLabel,
              objectTypeCode ?? null,
            ),
          ),
      });
      render(
        <ProductionMonitoringPage
          loadRegionChildren={() => Promise.resolve([])}
          pageDefinitionGateway={{
            getDefinition: () => Promise.resolve(actionDefinition(productCode)),
          }}
          pageKey={{ domain: "PRODUCTION", pageKind: "MONITORING", productCode }}
          repository={repository}
        />,
      );

      await user.click(await screen.findByRole("button", { name: "新建填报" }));
      const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
      await user.selectOptions(
        within(dialog).getByRole("combobox", { name: "对象类型" }),
        "FARMER",
      );
      expect(within(dialog).getByRole("group", { name: "质量指标" })).toBeVisible();
      expect(within(dialog).getByRole("group", { name: "生产成本" })).toBeVisible();
      expect(within(dialog).getByRole("group", { name: "农业保险" })).toBeVisible();
      expect(within(dialog).getByRole("group", { name: "农业补贴" })).toBeVisible();
      await user.type(within(dialog).getByLabelText(qualityLabel), "3.0");
      await user.type(within(dialog).getByLabelText("地租"), "4");
      await user.type(within(dialog).getByLabelText("保险金额"), "5");
      await user.type(within(dialog).getByLabelText("补贴金额"), "6");
      await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

      await waitFor(() =>
        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({
            productCode,
            objectTypeCode: "FARMER",
            quality: { [qualityCode]: "3.0" },
            costs: { LAND_RENT: "4" },
            insurance: { INSURANCE_AMOUNT: "5" },
            subsidies: { SUBSIDY_AMOUNT: "6" },
          }),
        ),
      );
    },
  );

  it("loads VIEW details and sends PUT with the loaded version and dynamic facts", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(() => Promise.resolve(detail("DRAFT", 8)));
    const repository = repositoryWithRow("VIEW", { saveDraft });
    renderPage(repository);

    await user.click(await screen.findByRole("button", { name: "查看" }));
    const dialog = await screen.findByRole("dialog", { name: "产情记录详情" });
    const cost = within(dialog).getByLabelText("测试成本");
    await user.clear(cost);
    await user.type(cost, "9.5000");
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(saveDraft).toHaveBeenCalledWith(
        "record-1",
        7,
        expect.objectContaining({ costs: { COST_TEST: "9.5000" } }),
      ),
    );
  });

  it("dispatches approve and return with the row/detail versions", async () => {
    const user = userEvent.setup();
    const approve = vi.fn(() => Promise.resolve(detail("APPROVED", 8)));
    const approvedRepository = repositoryWithRow("APPROVE", { approve });
    const view = renderPage(approvedRepository);
    await user.click(await screen.findByRole("button", { name: "审核" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("record-1", 7));

    view.unmount();
    const returnForCorrection = vi.fn(() => Promise.resolve(detail("RETURNED", 8)));
    renderPage(repositoryWithRow("RETURN", { returnForCorrection }));
    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回产情记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "数据需复核");
    await user.click(within(dialog).getByRole("button", { name: "确认退回" }));
    await waitFor(() =>
      expect(returnForCorrection).toHaveBeenCalledWith("record-1", 7, "数据需复核"),
    );
  });

  it.each([
    ["AUTHENTICATION", "登录已失效，请重新登录。"],
    ["CONFLICT", "记录已被其他用户修改，请刷新后重试。"],
  ] as const)("shows a stable action error for %s", async (kind, message) => {
    const user = userEvent.setup();
    const repository = repositoryWithRow("SUBMIT", {
      submit: () => Promise.reject(repositoryFailure(kind)),
    });
    renderPage(repository);

    await user.click(await screen.findByRole("button", { name: "提交" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(within(alert).getByRole("button", { name: "重试操作" })).toBeVisible();
    expect(within(alert).getByRole("button", { name: "关闭操作错误" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "重试列表查询" }),
    ).not.toBeInTheDocument();
  });

  it("retries an action independently and clears its action-only error", async () => {
    const user = userEvent.setup();
    const submit = vi
      .fn<ProductionRecordRepository["submit"]>()
      .mockRejectedValueOnce(repositoryFailure("CONFLICT"))
      .mockResolvedValueOnce(detail("PENDING_REVIEW", 8));
    renderPage(repositoryWithRow("SUBMIT", { submit }));

    await user.click(await screen.findByRole("button", { name: "提交" }));
    const alert = await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "提交" })).toBeEnabled();
    await user.click(within(alert).getByRole("button", { name: "重试操作" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "重试列表查询" }),
    ).not.toBeInTheDocument();
  });

  it("retries only the refresh after a successful create whose refresh fails", async () => {
    await expectMutationRefreshRetry("CREATE");
  });

  it("retries only the refresh after a successful submit whose refresh fails", async () => {
    await expectMutationRefreshRetry("SUBMIT");
  });

  it("retries only the refresh after a successful return whose refresh fails", async () => {
    await expectMutationRefreshRetry("RETURN");
  });

  it.each(["SAVE", "APPROVE"] as const)(
    "retries only the refresh after a successful %s whose refresh fails",
    expectMutationRefreshRetry,
  );

  it.each(["CREATE", "SAVE", "SUBMIT", "APPROVE", "RETURN"] as const)(
    "guards duplicate %s mutations synchronously and until its refresh settles",
    expectMutationGuard,
  );

  it("ignores a deferred NEW definition after switching product context", async () => {
    const user = userEvent.setup();
    const cornDefinition = deferred<ProductionFormDefinition>();
    const repository = repositoryFixture({
      definition: (productCode) =>
        productCode === "CORN"
          ? cornDefinition.promise
          : Promise.resolve(formDefinition("SOYBEAN", ["SOY_ONLY"])),
    });
    const { rerender } = render(productionPage("CORN", repository));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));

    rerender(productionPage("SOYBEAN", repository));
    cornDefinition.resolve(formDefinition("CORN", ["CORN_ONLY"]));

    await screen.findByRole("heading", { name: "大豆产情监测" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "新建产情填报" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("ignores a deferred VIEW definition after switching product context", async () => {
    const user = userEvent.setup();
    const cornDefinition = deferred<ProductionFormDefinition>();
    const loadDefinition = vi.fn((productCode: string) =>
      productCode === "CORN"
        ? cornDefinition.promise
        : Promise.resolve(formDefinition("SOYBEAN", ["SOY_ONLY"])),
    );
    const repository = repositoryWithRow("VIEW", {
      definition: loadDefinition,
      detail: () => Promise.resolve({ ...detail("DRAFT", 7), productCode: "CORN" }),
    });
    const { rerender } = render(productionPage("CORN", repository));
    await user.click(await screen.findByRole("button", { name: "查看" }));
    await waitFor(() => expect(loadDefinition).toHaveBeenCalledWith("CORN", "FARMER"));

    rerender(productionPage("SOYBEAN", repository));
    await act(async () => {
      cornDefinition.resolve(formDefinition("CORN", ["CORN_ONLY"], "FARMER"));
      await Promise.resolve();
    });

    await screen.findByRole("heading", { name: "大豆产情监测" });
    expect(
      screen.queryByRole("dialog", { name: "产情记录详情" }),
    ).not.toBeInTheDocument();
  });

  it("ignores a deferred RETURN detail after switching product context", async () => {
    const user = userEvent.setup();
    const cornDetail = deferred<ProductionRecordDetail>();
    const loadDetail = vi.fn(() => cornDetail.promise);
    const repository = repositoryWithRow("RETURN", { detail: loadDetail });
    const { rerender } = render(productionPage("CORN", repository));
    await user.click(await screen.findByRole("button", { name: "退回" }));
    await waitFor(() => expect(loadDetail).toHaveBeenCalledWith("record-1"));

    rerender(productionPage("SOYBEAN", repository));
    await act(async () => {
      cornDetail.resolve({ ...detail("PENDING_REVIEW", 7), productCode: "CORN" });
      await Promise.resolve();
    });

    await screen.findByRole("heading", { name: "大豆产情监测" });
    expect(
      screen.queryByRole("dialog", { name: "退回产情记录" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["SUBMIT", "提交", "submit"],
    ["APPROVE", "审核", "approve"],
  ] as const)(
    "does not refresh the new context when a deferred %s write settles",
    async (action, label, method) => {
      const user = userEvent.setup();
      const write = deferred<ProductionRecordDetail>();
      const searches: string[] = [];
      const repository = repositoryWithRow(action, {
        search: (criteria) => {
          searches.push(criteria.productCode);
          return Promise.resolve(rowPage(action));
        },
        [method]: () => write.promise,
      });
      const { rerender } = render(productionPage("CORN", repository));
      await user.click(await screen.findByRole("button", { name: label }));

      rerender(productionPage("SOYBEAN", repository));
      await screen.findByRole("heading", { name: "大豆产情监测" });
      await waitFor(() => expect(searches).toEqual(["CORN", "SOYBEAN"]));
      await act(async () => {
        write.resolve(detail(action === "SUBMIT" ? "PENDING_REVIEW" : "APPROVED", 8));
        await Promise.resolve();
      });

      expect(searches).toEqual(["CORN", "SOYBEAN"]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("does not refresh or reopen after a deferred create settles in an old context", async () => {
    const user = userEvent.setup();
    const createResult = deferred<ProductionRecordDetail>();
    const searches: string[] = [];
    const repository = repositoryFixture({
      create: () => createResult.promise,
      search: (criteria) => {
        searches.push(criteria.productCode);
        return Promise.resolve(emptyPage());
      },
    });
    const { rerender } = render(productionPage("CORN", repository));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    rerender(productionPage("SOYBEAN", repository));
    await screen.findByRole("heading", { name: "大豆产情监测" });
    await waitFor(() => expect(searches).toEqual(["CORN", "SOYBEAN"]));
    await act(async () => {
      createResult.resolve(detail("DRAFT", 1));
      await Promise.resolve();
    });

    expect(searches).toEqual(["CORN", "SOYBEAN"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not refresh or close the new context after a deferred draft update settles", async () => {
    const user = userEvent.setup();
    const saveResult = deferred<ProductionRecordDetail>();
    const searches: string[] = [];
    const repository = repositoryWithRow("VIEW", {
      definition: (productCode, objectTypeCode) =>
        Promise.resolve(
          formDefinition(productCode, ["COST_TEST"], objectTypeCode ?? null),
        ),
      detail: () => Promise.resolve({ ...detail("DRAFT", 7), productCode: "CORN" }),
      saveDraft: () => saveResult.promise,
      search: (criteria) => {
        searches.push(criteria.productCode);
        return Promise.resolve(rowPage("VIEW"));
      },
    });
    const { rerender } = render(productionPage("CORN", repository));
    await user.click(await screen.findByRole("button", { name: "查看" }));
    const dialog = await screen.findByRole("dialog", { name: "产情记录详情" });
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    rerender(productionPage("SOYBEAN", repository));
    await screen.findByRole("heading", { name: "大豆产情监测" });
    await waitFor(() => expect(searches).toEqual(["CORN", "SOYBEAN"]));
    await act(async () => {
      saveResult.resolve(detail("DRAFT", 8));
      await Promise.resolve();
    });

    expect(searches).toEqual(["CORN", "SOYBEAN"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not refresh the new context after a deferred return write settles", async () => {
    const user = userEvent.setup();
    const returnResult = deferred<ProductionRecordDetail>();
    const searches: string[] = [];
    const repository = repositoryWithRow("RETURN", {
      detail: () =>
        Promise.resolve({ ...detail("PENDING_REVIEW", 7), productCode: "CORN" }),
      returnForCorrection: () => returnResult.promise,
      search: (criteria) => {
        searches.push(criteria.productCode);
        return Promise.resolve(rowPage("RETURN"));
      },
    });
    const { rerender } = render(productionPage("CORN", repository));
    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回产情记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "切换上下文");
    await user.click(within(dialog).getByRole("button", { name: "确认退回" }));

    rerender(productionPage("SOYBEAN", repository));
    await screen.findByRole("heading", { name: "大豆产情监测" });
    await waitFor(() => expect(searches).toEqual(["CORN", "SOYBEAN"]));
    await act(async () => {
      returnResult.resolve(detail("RETURNED", 8));
      await Promise.resolve();
    });

    expect(searches).toEqual(["CORN", "SOYBEAN"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the newest object definition and prunes hidden fact values", async () => {
    const user = userEvent.setup();
    const a = deferred<ProductionFormDefinition>();
    const b = deferred<ProductionFormDefinition>();
    const create = vi.fn(() => Promise.resolve(detail("DRAFT", 0)));
    const repository = repositoryFixture({
      create,
      definition: (_productCode, objectTypeCode) => {
        if (objectTypeCode === "TYPE_A") return a.promise;
        if (objectTypeCode === "TYPE_B") return b.promise;
        return Promise.resolve(formDefinition("SOYBEAN", ["SHARED", "A_ONLY"]));
      },
    });
    render(productionPage("SOYBEAN", repository, twoObjectDefinition()));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
    expect(
      within(dialog).getByRole("combobox", { name: "动态地区 第1级" }),
    ).toBeVisible();
    expect(within(dialog).getByLabelText("动态日期")).toHaveAttribute("type", "date");
    expect(within(dialog).getByRole("combobox", { name: "动态品种" })).toBeVisible();
    expect(within(dialog).getByLabelText("动态面积")).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(within(dialog).getByText("动态面积（动态亩）")).toBeVisible();
    expect(within(dialog).getByLabelText("动态亩产")).toBeVisible();
    await user.type(within(dialog).getByLabelText("仅 A 字段"), "8.0000");
    await user.type(within(dialog).getByLabelText("共享字段"), "3.0000");

    const objectType = within(dialog).getByRole("combobox", { name: "动态对象" });
    await user.selectOptions(objectType, "TYPE_A");
    await user.selectOptions(objectType, "TYPE_B");
    b.resolve(formDefinition("SOYBEAN", ["SHARED", "B_ONLY"], "TYPE_B"));
    a.resolve(formDefinition("SOYBEAN", ["SHARED", "A_ONLY"], "TYPE_A"));

    expect(await within(dialog).findByLabelText("仅 B 字段")).toBeVisible();
    expect(within(dialog).queryByLabelText("仅 A 字段")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ costs: { SHARED: "3.0000" } }),
      ),
    );
  });

  it("rolls back an object switch failure so dismiss and save cannot mix B with A facts", async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => Promise.resolve(detail("DRAFT", 0)));
    const repository = repositoryFixture({
      create,
      definition: (_productCode, objectTypeCode) => {
        if (objectTypeCode === "TYPE_B") {
          return Promise.reject(repositoryFailure("UNEXPECTED"));
        }
        return Promise.resolve(
          formDefinition("SOYBEAN", ["SHARED", "A_ONLY"], objectTypeCode ?? null),
        );
      },
    });
    render(productionPage("SOYBEAN", repository, twoObjectDefinition()));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
    const objectType = within(dialog).getByRole("combobox", { name: "动态对象" });
    await user.selectOptions(objectType, "TYPE_A");
    await user.type(within(dialog).getByLabelText("共享字段"), "3.0000");
    await user.type(within(dialog).getByLabelText("仅 A 字段"), "8.0000");

    await user.selectOptions(objectType, "TYPE_B");
    const alert = await screen.findByRole("alert");
    expect(objectType).toHaveValue("TYPE_A");
    expect(within(dialog).getByLabelText("仅 A 字段")).toHaveValue("8.0000");
    await user.click(within(alert).getByRole("button", { name: "关闭操作错误" }));
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          objectTypeCode: "TYPE_A",
          costs: { SHARED: "3.0000", A_ONLY: "8.0000" },
        }),
      ),
    );
  });

  it("retries a failed object switch atomically and prunes only after B succeeds", async () => {
    const user = userEvent.setup();
    const b = deferred<ProductionFormDefinition>();
    const create = vi.fn(() => Promise.resolve(detail("DRAFT", 0)));
    let bAttempts = 0;
    const repository = repositoryFixture({
      create,
      definition: (_productCode, objectTypeCode) => {
        if (objectTypeCode === "TYPE_B") {
          bAttempts += 1;
          return bAttempts === 1
            ? Promise.reject(repositoryFailure("UNEXPECTED"))
            : b.promise;
        }
        return Promise.resolve(
          formDefinition("SOYBEAN", ["SHARED", "A_ONLY"], objectTypeCode ?? null),
        );
      },
    });
    render(productionPage("SOYBEAN", repository, twoObjectDefinition()));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
    const objectType = within(dialog).getByRole("combobox", { name: "动态对象" });
    await user.selectOptions(objectType, "TYPE_A");
    await user.type(within(dialog).getByLabelText("共享字段"), "3.0000");
    await user.type(within(dialog).getByLabelText("仅 A 字段"), "8.0000");
    await user.selectOptions(objectType, "TYPE_B");
    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "重试操作" }));

    await act(async () => {
      b.resolve(formDefinition("SOYBEAN", ["SHARED", "B_ONLY"], "TYPE_B"));
      await Promise.resolve();
    });
    expect(objectType).toHaveValue("TYPE_B");
    expect(await within(dialog).findByLabelText("仅 B 字段")).toBeVisible();
    expect(within(dialog).queryByLabelText("仅 A 字段")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          objectTypeCode: "TYPE_B",
          costs: { SHARED: "3.0000" },
        }),
      ),
    );
  });

  it("rejects a definition response paired with a different object context", async () => {
    const user = userEvent.setup();
    const repository = repositoryFixture({
      definition: (_productCode, objectTypeCode) =>
        Promise.resolve(
          formDefinition(
            "SOYBEAN",
            ["SHARED", "A_ONLY"],
            objectTypeCode === "TYPE_B" ? "TYPE_A" : (objectTypeCode ?? null),
          ),
        ),
    });
    render(productionPage("SOYBEAN", repository, twoObjectDefinition()));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
    const objectType = within(dialog).getByRole("combobox", { name: "动态对象" });
    await user.selectOptions(objectType, "TYPE_A");
    await user.selectOptions(objectType, "TYPE_B");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "操作失败，请稍后重试。",
    );
    expect(objectType).toHaveValue("TYPE_A");
  });
});

function productionPage(
  productCode: string,
  repository: ProductionRecordRepository,
  loadedDefinition: ListPageDefinition = actionDefinition(productCode),
) {
  return (
    <ProductionMonitoringPage
      loadRegionChildren={() => Promise.resolve([])}
      pageDefinitionGateway={{ getDefinition: () => Promise.resolve(loadedDefinition) }}
      pageKey={{ domain: "PRODUCTION", pageKind: "MONITORING", productCode }}
      repository={repository}
    />
  );
}

function renderPage(repository: ProductionRecordRepository) {
  return render(
    <ProductionMonitoringPage
      loadRegionChildren={() => Promise.resolve([])}
      pageDefinitionGateway={{
        getDefinition: () => Promise.resolve(actionDefinition()),
      }}
      pageKey={{
        domain: "PRODUCTION",
        pageKind: "MONITORING",
        productCode: "SOYBEAN",
      }}
      repository={repository}
    />,
  );
}

async function expectMutationRefreshRetry(
  scenario: "CREATE" | "SAVE" | "SUBMIT" | "APPROVE" | "RETURN",
) {
  const user = userEvent.setup();
  const initialAction =
    scenario === "SAVE" ? "VIEW" : scenario === "CREATE" ? undefined : scenario;
  const search = vi
    .fn<ProductionRecordRepository["search"]>()
    .mockResolvedValueOnce(initialAction ? rowPage(initialAction) : emptyPage())
    .mockRejectedValueOnce(new Error("refresh failed"))
    .mockResolvedValueOnce(emptyPage());
  const mutation = vi.fn(() =>
    Promise.resolve(
      detail(
        scenario === "SUBMIT"
          ? "PENDING_REVIEW"
          : scenario === "APPROVE"
            ? "APPROVED"
            : scenario === "RETURN"
              ? "RETURNED"
              : "DRAFT",
        8,
      ),
    ),
  );
  const repository = repositoryFixture({
    search,
    ...(scenario === "CREATE" ? { create: mutation } : {}),
    ...(scenario === "SAVE" ? { saveDraft: mutation } : {}),
    ...(scenario === "SUBMIT" ? { submit: mutation } : {}),
    ...(scenario === "APPROVE" ? { approve: mutation } : {}),
    ...(scenario === "RETURN" ? { returnForCorrection: mutation } : {}),
  });
  renderPage(repository);

  if (scenario === "CREATE") {
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "新建产情填报" })).getByRole(
        "button",
        { name: "保存草稿" },
      ),
    );
  } else if (scenario === "SAVE") {
    await user.click(await screen.findByRole("button", { name: "查看" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "产情记录详情" })).getByRole(
        "button",
        { name: "保存草稿" },
      ),
    );
  } else if (scenario === "RETURN") {
    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回产情记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "刷新失败测试");
    await user.click(within(dialog).getByRole("button", { name: "确认退回" }));
  } else {
    await user.click(
      await screen.findByRole("button", {
        name: scenario === "SUBMIT" ? "提交" : "审核",
      }),
    );
  }

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(
    scenario === "CREATE" || scenario === "SAVE"
      ? "记录已保存，但列表刷新失败"
      : "状态已变更，但列表刷新失败",
  );
  await user.click(within(alert).getByRole("button", { name: "重试操作" }));
  await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
  expect(mutation).toHaveBeenCalledTimes(1);
}

async function expectMutationGuard(
  scenario: "CREATE" | "SAVE" | "SUBMIT" | "APPROVE" | "RETURN",
) {
  const user = userEvent.setup();
  const refresh = deferred<Awaited<ReturnType<ProductionRecordRepository["search"]>>>();
  const initialAction =
    scenario === "SAVE" ? "VIEW" : scenario === "CREATE" ? undefined : scenario;
  const initialPage = initialAction ? rowPage(initialAction) : emptyPage();
  const search = vi
    .fn<ProductionRecordRepository["search"]>()
    .mockResolvedValueOnce(initialPage)
    .mockReturnValueOnce(refresh.promise);
  const mutationResult = deferred<ProductionRecordDetail>();
  const mutation = vi.fn(() => mutationResult.promise);
  const result = detail(
    scenario === "SUBMIT"
      ? "PENDING_REVIEW"
      : scenario === "APPROVE"
        ? "APPROVED"
        : scenario === "RETURN"
          ? "RETURNED"
          : "DRAFT",
    8,
  );
  const repository = repositoryFixture({
    search,
    ...(scenario === "CREATE" ? { create: mutation } : {}),
    ...(scenario === "SAVE" ? { saveDraft: mutation } : {}),
    ...(scenario === "SUBMIT" ? { submit: mutation } : {}),
    ...(scenario === "APPROVE" ? { approve: mutation } : {}),
    ...(scenario === "RETURN" ? { returnForCorrection: mutation } : {}),
  });
  renderPage(repository);

  let mutationButton: HTMLButtonElement;
  if (scenario === "CREATE") {
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    mutationButton = within(
      await screen.findByRole("dialog", { name: "新建产情填报" }),
    ).getByRole("button", { name: "保存草稿" });
  } else if (scenario === "SAVE") {
    await user.click(await screen.findByRole("button", { name: "查看" }));
    mutationButton = within(
      await screen.findByRole("dialog", { name: "产情记录详情" }),
    ).getByRole("button", { name: "保存草稿" });
  } else if (scenario === "RETURN") {
    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回产情记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "重复保护");
    mutationButton = within(dialog).getByRole("button", { name: "确认退回" });
  } else {
    mutationButton = await screen.findByRole("button", {
      name: scenario === "SUBMIT" ? "提交" : "审核",
    });
  }

  await act(async () => {
    mutationButton.click();
    mutationButton.click();
    await Promise.resolve();
  });
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(mutationButton).toBeDisabled();
  mutationButton.click();
  expect(mutation).toHaveBeenCalledTimes(1);

  await act(async () => {
    mutationResult.resolve(result);
    await mutationResult.promise;
  });
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "新建填报" })).toBeDisabled();
  expect(mutation).toHaveBeenCalledTimes(1);

  await act(async () => {
    refresh.resolve(initialPage);
    await refresh.promise;
  });
  const actionName =
    scenario === "CREATE"
      ? "新建填报"
      : scenario === "SAVE"
        ? "查看"
        : scenario === "SUBMIT"
          ? "提交"
          : scenario === "APPROVE"
            ? "审核"
            : "退回";
  const actionButton = await screen.findByRole("button", { name: actionName });
  await waitFor(() => expect(actionButton).toBeEnabled());
  expect(mutation).toHaveBeenCalledTimes(1);
}

function repositoryWithRow(
  action: "VIEW" | "SUBMIT" | "APPROVE" | "RETURN",
  overrides: Partial<ProductionRecordRepository> = {},
) {
  return repositoryFixture({
    search: () => Promise.resolve(rowPage(action)),
    detail: () => Promise.resolve(detail("DRAFT", 7)),
    ...overrides,
  });
}

function rowPage(action: "VIEW" | "SUBMIT" | "APPROVE" | "RETURN") {
  return {
    items: [
      {
        id: "record-1",
        values: { PROD_STATUS: "草稿" },
        allowedActions: [action],
        version: 7,
      },
    ],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 1,
    totalPages: 1,
  };
}

function emptyPage() {
  return {
    items: [],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 0,
    totalPages: 0,
  };
}

function repositoryFixture(
  overrides: Partial<ProductionRecordRepository> = {},
): ProductionRecordRepository {
  return {
    search: () => Promise.resolve(emptyPage()),
    detail: () => Promise.resolve(detail("DRAFT", 0)),
    definition: (productCode, objectTypeCode) =>
      Promise.resolve({
        productCode,
        objectTypeCode: objectTypeCode ?? null,
        groups: [
          { category: "QUALITY", label: "质量指标", sortOrder: 10, fields: [] },
          {
            category: "COST",
            label: "生产成本",
            sortOrder: 20,
            fields: [
              {
                code: "COST_TEST",
                label: "测试成本",
                valueType: "DECIMAL",
                unit: null,
                description: null,
                precision: 18,
                scale: 4,
                sortOrder: 200,
              },
            ],
          },
          { category: "INSURANCE", label: "农业保险", sortOrder: 30, fields: [] },
          { category: "SUBSIDY", label: "农业补贴", sortOrder: 40, fields: [] },
        ],
      }),
    create: () => Promise.resolve(detail("DRAFT", 0)),
    saveDraft: () => Promise.resolve(detail("DRAFT", 1)),
    submit: () => Promise.resolve(detail("PENDING_REVIEW", 1)),
    approve: () => Promise.resolve(detail("APPROVED", 2)),
    returnForCorrection: () => Promise.resolve(detail("RETURNED", 2)),
    ...overrides,
  };
}

function detail(status: string, version: number): ProductionRecordDetail {
  return {
    id: "record-1",
    productCode: "SOYBEAN",
    objectTypeCode: "FARMER",
    regionCode: "230202",
    cultivarCode: null,
    surveyDate: "2026-08-01",
    reportedAt: "2026-08-02T08:00:00+08:00",
    cultivatedAreaMu: "1.0000",
    yieldPerMuKilograms: "2.0000",
    estimatedOutputKilograms: "2.0000",
    status,
    returnReason: null,
    quality: {},
    costs: { COST_TEST: "3.0000" },
    insurance: {},
    subsidies: {},
    allowedActions: status === "DRAFT" ? ["SAVE", "SUBMIT"] : [],
    version,
  };
}

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

function actionDefinition(productCode = "SOYBEAN") {
  return {
    ...definition(
      productCode,
      productCode === "CORN"
        ? "玉米产情监测"
        : productCode === "RICE"
          ? "稻谷产情监测"
          : "大豆产情监测",
    ),
    filters: [
      {
        id: "objectTypeCode",
        label: "对象类型",
        control: "select",
        placeholder: "全部对象类型",
        options: [{ value: "FARMER", label: "农户" }],
      },
    ],
    columnGroups: [
      {
        id: "report",
        label: "填报信息",
        fields: [
          { id: "PROD_OBJECT_TYPE", label: "对象类型", valueType: "TEXT" },
          { id: "PROD_REGION", label: "地区", valueType: "TEXT" },
          { id: "PROD_SURVEY_DATE", label: "调查日期", valueType: "DATE" },
          { id: "PROD_CULTIVAR", label: "品种", valueType: "TEXT" },
          { id: "PROD_AREA_MU", label: "种植面积（亩）", valueType: "DECIMAL" },
          {
            id: "PROD_YIELD_PER_MU",
            label: "亩产（公斤/亩）",
            valueType: "DECIMAL",
          },
          { id: "PROD_STATUS", label: "状态", valueType: "TEXT" },
        ],
      },
    ],
    actions: [
      { id: "NEW", label: "新建填报", scope: "page" },
      { id: "VIEW", label: "查看", scope: "row" },
      { id: "SUBMIT", label: "提交", scope: "row" },
      { id: "APPROVE", label: "审核", scope: "row" },
      { id: "RETURN", label: "退回", scope: "row" },
    ],
  } as const;
}

function twoObjectDefinition() {
  const loaded = actionDefinition();
  const labels: Record<string, string> = {
    PROD_OBJECT_TYPE: "动态对象",
    PROD_REGION: "动态地区",
    PROD_SURVEY_DATE: "动态日期",
    PROD_CULTIVAR: "动态品种",
    PROD_AREA_MU: "动态面积",
    PROD_YIELD_PER_MU: "动态亩产",
  };
  return {
    ...loaded,
    filters: [
      {
        ...loaded.filters[0],
        label: "动态对象",
        options: [
          { value: "TYPE_A", label: "A 类型" },
          { value: "TYPE_B", label: "B 类型" },
        ],
      },
    ],
    columnGroups: loaded.columnGroups.map((group) => ({
      ...group,
      fields: group.fields.map((field) =>
        labels[field.id]
          ? {
              ...field,
              label: labels[field.id]!,
              ...(field.id === "PROD_AREA_MU" ? { unit: "动态亩" } : {}),
            }
          : field,
      ),
    })),
  };
}

function formDefinition(
  productCode: string,
  codes: readonly string[],
  objectTypeCode: string | null = null,
): ProductionFormDefinition {
  const labels: Record<string, string> = {
    SHARED: "共享字段",
    A_ONLY: "仅 A 字段",
    B_ONLY: "仅 B 字段",
    SOY_ONLY: "大豆字段",
    CORN_ONLY: "玉米字段",
  };
  return {
    productCode,
    objectTypeCode,
    groups: [
      { category: "QUALITY", label: "质量指标", sortOrder: 10, fields: [] },
      {
        category: "COST",
        label: "生产成本",
        sortOrder: 20,
        fields: codes.map((code) => ({
          code,
          label: labels[code] ?? code,
          valueType: "DECIMAL",
          unit: null,
          description: null,
          precision: 18,
          scale: 4,
          sortOrder: 200 + codes.indexOf(code),
        })),
      },
      { category: "INSURANCE", label: "农业保险", sortOrder: 30, fields: [] },
      { category: "SUBSIDY", label: "农业补贴", sortOrder: 40, fields: [] },
    ],
  };
}

function confirmedFormDefinition(
  productCode: string,
  qualityCode: string,
  qualityLabel: string,
  objectTypeCode: string | null,
): ProductionFormDefinition {
  const field = (code: string, label: string, sortOrder: number) => ({
    code,
    label,
    valueType: "DECIMAL",
    unit: null,
    description: null,
    precision: 18,
    scale: 1,
    sortOrder,
  });
  return {
    productCode,
    objectTypeCode,
    groups: [
      {
        category: "QUALITY",
        label: "质量指标",
        sortOrder: 10,
        fields: [field(qualityCode, qualityLabel, 100)],
      },
      {
        category: "COST",
        label: "生产成本",
        sortOrder: 20,
        fields: [field("LAND_RENT", "地租", 200)],
      },
      {
        category: "INSURANCE",
        label: "农业保险",
        sortOrder: 30,
        fields: [field("INSURANCE_AMOUNT", "保险金额", 300)],
      },
      {
        category: "SUBSIDY",
        label: "农业补贴",
        sortOrder: 40,
        fields: [field("SUBSIDY_AMOUNT", "补贴金额", 400)],
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function repositoryFailure(kind: ProductionRepositoryFailureKind) {
  return new ProductionRepositoryFailure(kind);
}
