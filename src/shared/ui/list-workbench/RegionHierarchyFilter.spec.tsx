import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RegionNode } from "../../application/page-definition";
import { RegionHierarchyFilter } from "./RegionHierarchyFilter";

describe("RegionHierarchyFilter", () => {
  const city: RegionNode = { id: "city", label: "测试市", level: "PREFECTURE" };
  const county: RegionNode = {
    id: "county",
    label: "测试县",
    level: "COUNTY",
  };

  it("reconstructs and synchronizes a controlled selected path", async () => {
    const { rerender } = render(
      <RegionHierarchyFilter
        label="业务地区"
        loadChildren={(parentId) =>
          Promise.resolve(parentId === undefined ? [city] : [county])
        }
        loadPath={() => Promise.resolve([city, county])}
        onChange={() => undefined}
        placeholder="请选择地区"
        value="county"
      />,
    );

    expect(await screen.findByRole("combobox", { name: "业务地区 第1级" })).toHaveValue(
      "city",
    );
    expect(screen.getByRole("combobox", { name: "业务地区 第2级" })).toHaveValue(
      "county",
    );

    rerender(
      <RegionHierarchyFilter
        label="业务地区"
        loadChildren={(parentId) =>
          Promise.resolve(parentId === undefined ? [city] : [county])
        }
        loadPath={() => Promise.resolve([])}
        onChange={() => undefined}
        placeholder="请选择地区"
        value=""
      />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("combobox", { name: "业务地区 第2级" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("combobox", { name: "业务地区 第1级" })).toHaveValue("");
  });

  it("falls back to the nearest selected ancestor when a lower level is cleared", async () => {
    const user = userEvent.setup();
    const changes: string[] = [];

    render(
      <RegionHierarchyFilter
        label="业务地区"
        loadChildren={(parentId) =>
          Promise.resolve(parentId === undefined ? [city] : [county])
        }
        loadPath={() => Promise.resolve([city, county])}
        onChange={(value) => changes.push(value)}
        placeholder="请选择地区"
        value="county"
      />,
    );

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "业务地区 第2级" }),
      "",
    );
    expect(changes).toEqual(["city"]);
  });

  it("shows Chinese loading and retry UI", async () => {
    const user = userEvent.setup();
    let rootAttempts = 0;
    const loadChildren = () => {
      rootAttempts += 1;
      return rootAttempts === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve([city]);
    };
    render(
      <RegionHierarchyFilter
        label="业务地区"
        loadChildren={loadChildren}
        loadPath={() => Promise.resolve([])}
        onChange={() => undefined}
        placeholder="请选择地区"
        value=""
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "地区加载失败，请重试。",
    );
    await user.click(screen.getByRole("button", { name: "重试地区加载" }));
    expect(
      await screen.findByRole("combobox", { name: "业务地区 第1级" }),
    ).toBeVisible();
  });

  it("ignores stale path responses", async () => {
    const firstPath = deferred<readonly RegionNode[]>();
    const secondPath = deferred<readonly RegionNode[]>();
    const { rerender } = render(
      <RegionHierarchyFilter
        label="业务地区"
        loadChildren={() => Promise.resolve([city])}
        loadPath={() => firstPath.promise}
        onChange={() => undefined}
        placeholder="请选择地区"
        value="old"
      />,
    );

    rerender(
      <RegionHierarchyFilter
        label="业务地区"
        loadChildren={() => Promise.resolve([city])}
        loadPath={() => secondPath.promise}
        onChange={() => undefined}
        placeholder="请选择地区"
        value="new"
      />,
    );
    secondPath.resolve([city]);
    expect(await screen.findByRole("combobox", { name: "业务地区 第1级" })).toHaveValue(
      "city",
    );
    firstPath.resolve([county]);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "业务地区 第1级" })).toHaveValue(
        "city",
      ),
    );
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
