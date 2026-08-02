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
});
