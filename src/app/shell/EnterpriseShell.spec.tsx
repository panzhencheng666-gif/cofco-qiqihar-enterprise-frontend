import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EnterpriseShell } from "./EnterpriseShell";

describe("EnterpriseShell", () => {
  beforeEach(() => window.history.replaceState(null, "", "#/"));

  it("keeps the accepted enterprise shell and consolidates duplicated work menus", () => {
    render(
      <EnterpriseShell>
        <div>业务内容</div>
      </EnterpriseShell>,
    );

    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "业务应用" })).toBeVisible();

    const sidebar = screen.getByRole("navigation", { name: "业务目录" });
    expect(within(sidebar).getByRole("button", { name: "待办任务" })).toBeVisible();
    expect(within(sidebar).getByRole("button", { name: "已办事项" })).toBeVisible();
    expect(within(sidebar).queryByText("待我处理")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("退回与异常")).not.toBeInTheDocument();
    expect(screen.getByText("业务内容")).toBeVisible();
    expect(screen.getByRole("button", { name: "待办" })).toBeVisible();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
  });

  it("routes the two work entries to the production workbench locations", async () => {
    const user = userEvent.setup();
    render(<EnterpriseShell>业务内容</EnterpriseShell>);

    await user.click(screen.getByRole("button", { name: "待办任务" }));
    expect(window.location.hash).toBe("#/work/pending");
    await user.click(screen.getByRole("button", { name: "已办事项" }));
    expect(window.location.hash).toBe("#/work/completed");
  });

  it("uses the first dynamically loaded product for the production entry", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseShell products={[{ id: "SOYBEAN", name: "大豆" }]}>
        业务内容
      </EnterpriseShell>,
    );

    await user.click(screen.getByRole("button", { name: "产情填报" }));
    expect(window.location.hash).toBe("#/pages/PRODUCTION/MONITORING/SOYBEAN");
  });

  it("activates work navigation by hash pathname and exposes aria-current", () => {
    window.history.replaceState(
      null,
      "",
      "#/work/pending?page=3&pageSize=20&status=TO_REVIEW",
    );

    render(<EnterpriseShell>业务内容</EnterpriseShell>);

    const pending = screen.getByRole("button", { name: "待办任务" });
    expect(pending).toHaveClass("is-active");
    expect(pending).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "已办事项" })).not.toHaveClass(
      "is-active",
    );
    const workApplication = screen.getByRole("button", { name: "我的工作" });
    expect(workApplication).toHaveClass("is-active");
    expect(workApplication).toHaveAttribute("aria-current", "page");
  });

  it("navigates top applications and user tools through stable hash routes", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseShell products={[{ id: "SOYBEAN", name: "大豆" }]}>
        业务内容
      </EnterpriseShell>,
    );

    await user.click(screen.getByRole("button", { name: "报表中心" }));
    expect(decodeURIComponent(window.location.hash)).toBe("#/报表中心");
    expect(screen.queryByRole("button", { name: "综合报告" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "我的工作" }));
    expect(window.location.hash).toBe("#/work/pending");

    await user.click(screen.getByRole("button", { name: "产情监测" }));
    expect(window.location.hash).toBe("#/pages/PRODUCTION/MONITORING/SOYBEAN");
    await user.click(screen.getByRole("button", { name: "待办" }));
    expect(window.location.hash).toBe("#/work/pending");
    await user.click(screen.getByRole("button", { name: /^通知/ }));
    expect(window.location.hash).toBe("#/notifications");
    await user.click(screen.getByRole("button", { name: "帮助" }));
    expect(window.location.hash).toBe("#/help");
    await user.click(screen.getByRole("button", { name: "系统设置" }));
    expect(window.location.hash).toBe("#/settings");
    await user.click(screen.getByRole("button", { name: "个人账户：王洋" }));
    expect(window.location.hash).toBe("#/account");
  });

  it("returns to overview when clicking the brand", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "#/pages/MARKET/MONITORING/SOYBEAN");
    render(
      <EnterpriseShell products={[{ id: "SOYBEAN", name: "大豆" }]}>
        业务内容
      </EnterpriseShell>,
    );

    await user.click(screen.getByRole("button", { name: "返回市场采集首页" }));
    expect(window.location.hash).toBe("#/overview");
  });
});
