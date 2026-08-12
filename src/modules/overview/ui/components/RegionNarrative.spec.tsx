import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { OverviewIndicator } from "../../domain/overview";
import { groupOverviewIndicators } from "../presentation/overviewNarrative";
import { RegionNarrative } from "./RegionNarrative";

describe("RegionNarrative", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("presents the selected region as factual monitoring chapters", () => {
    render(
      <RegionNarrative
        chapters={groupOverviewIndicators([
          indicator("area", "核定播种面积", "10", "亩", "PRODUCTION", 2),
          indicator("price", "核定成交价格", "4286", "元/吨", "MARKET", 1),
        ])}
        periodLabel="2026年第三季度"
        productLabel="玉米"
        regionName="黑河市"
        transcript="黑河市玉米粮情讲解"
      />,
    );

    expect(screen.getByRole("heading", { name: "黑河市" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "区域态势" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "产情监测" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "市场监测" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "物流流向" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "供需平衡" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "数据治理" })).toBeVisible();
    expect(screen.getAllByText("核定播种面积")).toHaveLength(2);
    expect(screen.getByText(/2 条核定来源/)).toBeVisible();
    expect(screen.getAllByText(/公式 SUM\(governed metric fact\)/)).toHaveLength(2);
    expect(screen.getAllByText(/截止 2026-08-11T03:20:03Z/)).toHaveLength(2);
    expect(screen.getAllByText(/版本 OVERVIEW_METRIC_V1/)).toHaveLength(2);
    expect(screen.getAllByText("暂无核定数据")).toHaveLength(2);
    expect(screen.getByText("黑河市玉米粮情讲解")).toBeInTheDocument();
  });

  it("controls local browser narration without adding a business edit action", async () => {
    const speech = installSpeechSynthesis();
    render(
      <RegionNarrative
        chapters={groupOverviewIndicators([])}
        productLabel="大豆"
        regionName="齐齐哈尔市"
        transcript="齐齐哈尔市大豆讲解"
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "开始讲解" }));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(screen.getByText("正在讲解")).toBeVisible();
    expect(screen.queryByRole("button", { name: /填报|保存|审核/ })).toBeNull();
  });
});

function indicator(
  code: string,
  name: string,
  value: string,
  unitCode: string,
  sourceDomain: OverviewIndicator["sourceDomain"],
  sourceCount: number,
): OverviewIndicator {
  return {
    code,
    name,
    sourceDomain,
    sourceCount,
    sourcePath: `/sources/${code}`,
    formula: "SUM(governed metric fact)",
    sourceRelation: "production.production_record",
    dataCutoff: "2026-08-11T03:20:03Z",
    coverageScope: "region=230200;product=CORN;year=2026;descendants=included",
    coverageStatus: "AVAILABLE",
    calculationVersion: "OVERVIEW_METRIC_V1",
    unitCode,
    value,
  };
}

class FakeUtterance {
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

function installSpeechSynthesis() {
  const speech = {
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn(),
  };
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", speech);
  return speech;
}
