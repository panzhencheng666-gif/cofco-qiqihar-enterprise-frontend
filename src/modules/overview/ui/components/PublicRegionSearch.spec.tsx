import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import type { OverviewRegion } from "../../domain/overview";
import { PublicRegionSearch } from "./PublicRegionSearch";

const root = {
  code: "1",
  name: "齐齐哈尔市",
  level: "PREFECTURE",
  approvedRecordCount: null,
  boundaryGeoJson:
    '{"type":"Polygon","coordinates":[[[125,48],[126,48],[126,49],[125,48]]]}',
} satisfies OverviewRegion;
const county: OverviewRegion = {
  code: "11",
  name: "依安县",
  parentCode: "1",
  level: "COUNTY",
  approvedRecordCount: null,
  boundaryGeoJson: root.boundaryGeoJson,
};
it("loads lazily and selects a keyboard result without blocking its host", async () => {
  const regions = vi.fn(() => Promise.resolve([county]));
  const repository = {
    regions,
    locations: vi.fn(() => Promise.resolve([])),
  } as unknown as OverviewRepository;
  const onSelect = vi.fn();
  render(
    <PublicRegionSearch
      repository={repository}
      roots={[root]}
      productCode="CORN"
      year={2026}
      onSelect={onSelect}
    />,
  );
  expect(regions).not.toHaveBeenCalled();
  const input = screen.getByRole("combobox", { name: "搜索市县乡村" });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "依安" } });
  await screen.findByRole("option", { name: /齐齐哈尔市 \/ 依安县/ });
  expect(
    fireEvent.mouseDown(screen.getByRole("option", { name: /齐齐哈尔市 \/ 依安县/ })),
  ).toBe(false);
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(county));
  fireEvent.focus(input);
  expect(regions).toHaveBeenCalledTimes(1);
});

it("keeps completed directory parts when retrying a partial failure", async () => {
  const regions = vi.fn(() => Promise.resolve([county]));
  let villageCalls = 0;
  const locations = vi.fn(({ level }: { level: string }) => {
    if (level === "VILLAGE" && ++villageCalls === 1)
      return Promise.reject(new Error("offline"));
    return Promise.resolve([]);
  });
  render(
    <PublicRegionSearch
      repository={{ regions, locations } as unknown as OverviewRepository}
      roots={[root]}
      productCode="CORN"
      year={2026}
      onSelect={() => undefined}
    />,
  );
  fireEvent.focus(screen.getByRole("combobox", { name: "搜索市县乡村" }));
  await screen.findByRole("button", { name: "重试" });
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument(),
  );
  expect(regions).toHaveBeenCalledTimes(1);
  expect(
    locations.mock.calls.filter(([query]) => query.level === "TOWNSHIP"),
  ).toHaveLength(1);
  expect(villageCalls).toBe(2);
});

it("resolves township boundaries and sends villages as points with a QA warning", async () => {
  const town: OverviewRegion = {
    code: "111",
    name: "新兴镇",
    parentCode: "11",
    level: "TOWNSHIP",
    approvedRecordCount: null,
  };
  const village: OverviewRegion = {
    code: "1111",
    name: "兴福村",
    parentCode: "111",
    level: "VILLAGE",
    approvedRecordCount: null,
    locationGeoJson: '{"type":"Point","coordinates":[125,48]}',
    boundaryGeoJson: root.boundaryGeoJson,
  };
  const regions = vi.fn(({ parentCode }: { parentCode?: string }) =>
    Promise.resolve(
      parentCode === "11"
        ? [{ ...town, boundaryGeoJson: root.boundaryGeoJson }]
        : [county],
    ),
  );
  const locations = vi.fn(({ level }: { level: string }) =>
    Promise.resolve(level === "TOWNSHIP" ? [town] : [village]),
  );
  const onSelect = vi.fn();
  render(
    <PublicRegionSearch
      repository={{ regions, locations } as unknown as OverviewRepository}
      roots={[root]}
      productCode="CORN"
      year={2026}
      onSelect={onSelect}
    />,
  );
  const input = screen.getByRole("combobox", { name: "搜索市县乡村" });
  fireEvent.focus(input);
  await screen.findByRole("option", { name: /兴福村/ });
  fireEvent.click(screen.getByRole("option", { name: /^新兴镇/ }));
  await waitFor(() =>
    expect(onSelect).toHaveBeenCalledWith({
      ...town,
      boundaryGeoJson: root.boundaryGeoJson,
    }),
  );
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("option", { name: /^兴福村/ }));
  await waitFor(() =>
    expect(onSelect).toHaveBeenLastCalledWith({
      ...village,
      boundaryGeoJson: undefined,
    }),
  );
  expect(screen.getByText(/位置待核验；不代表村界/)).toBeVisible();
});

it("finishes each root before requesting the next root", async () => {
  let finish!: (rows: readonly OverviewRegion[]) => void;
  const pending = new Promise<readonly OverviewRegion[]>((resolve) => {
    finish = resolve;
  });
  const nextRoot = { ...root, code: "2", name: "黑河市" };
  const regions = vi.fn(async ({ parentCode }: { parentCode?: string }) =>
    parentCode === "1" ? pending : [],
  );
  const locations = vi.fn(() => Promise.resolve([]));
  render(
    <PublicRegionSearch
      repository={{ regions, locations } as unknown as OverviewRepository}
      roots={[root, nextRoot]}
      productCode="CORN"
      year={2026}
      onSelect={() => undefined}
    />,
  );
  fireEvent.focus(screen.getByRole("combobox", { name: "搜索市县乡村" }));
  expect(screen.getByText(/地图可继续使用/)).toBeVisible();
  expect(regions).toHaveBeenCalledTimes(1);
  expect(locations).toHaveBeenCalledTimes(2);
  finish([county]);
  await waitFor(() => expect(regions).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText(/地图可继续使用/)).not.toBeInTheDocument(),
  );
});

it("does not select a region with no valid point or boundary", async () => {
  const missing: OverviewRegion = { ...county, boundaryGeoJson: "invalid" };
  const onSelect = vi.fn();
  render(
    <PublicRegionSearch
      repository={
        {
          regions: () => Promise.resolve([missing]),
          locations: () => Promise.resolve([]),
        } as unknown as OverviewRepository
      }
      roots={[root]}
      productCode="CORN"
      year={2026}
      onSelect={onSelect}
    />,
  );
  fireEvent.focus(screen.getByRole("combobox", { name: "搜索市县乡村" }));
  fireEvent.click(await screen.findByRole("option", { name: /^依安县/ }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByText(/暂无可定位的边界或点位/)).toBeVisible();
});
