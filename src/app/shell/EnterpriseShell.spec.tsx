import { render, screen, within } from "@testing-library/react";

import { EnterpriseShell } from "./EnterpriseShell";

describe("EnterpriseShell", () => {
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
  });
});
