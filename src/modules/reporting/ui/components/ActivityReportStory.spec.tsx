import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivityReport } from "../../domain/activityReport";
import { ActivityReportStory } from "./ActivityReportStory";

describe("ActivityReportStory", () => {
  beforeEach(() => setReducedMotion(false));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("advances the six-slide review while auto-play is enabled", () => {
    vi.useFakeTimers();
    render(
      <ActivityReportStory
        autoPlay
        onAutoPlayChange={vi.fn()}
        report={sampleActivityReport}
      />,
    );

    expect(screen.getByRole("heading", { name: /这是您的周期足迹/ })).toBeVisible();
    void act(() => vi.advanceTimersByTime(6_000));
    expect(
      screen.getByRole("heading", { name: "您的工作覆盖这些业务领域" }),
    ).toBeVisible();
  });

  it("keeps manual navigation available when reduced motion is requested", () => {
    setReducedMotion(true);
    vi.useFakeTimers();
    render(
      <ActivityReportStory
        autoPlay
        onAutoPlayChange={vi.fn()}
        report={sampleActivityReport}
      />,
    );

    void act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByRole("heading", { name: /这是您的周期足迹/ })).toBeVisible();
    expect(screen.getByText(/减少动态效果/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(
      screen.getByRole("heading", { name: "您的工作覆盖这些业务领域" }),
    ).toBeVisible();
  });
});

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

const sampleActivityReport: ActivityReport = {
  kind: "PERSONAL",
  periodDays: 7,
  periodStart: "2026-09-11T00:00:00Z",
  periodEnd: "2026-09-18T00:00:00Z",
  eventCutoff: "2026-09-18T00:00:00Z",
  subject: {
    subjectId: "user-1",
    displayName: "张三",
    workUnitName: "克山直属库",
  },
  effectiveUserCount: 1,
  totalEvents: 8,
  samplePointsCreated: 2,
  samplePointsDeleted: 1,
  actions: [
    { code: "SUBMITTED", label: "提交", count: 2 },
    { code: "UPDATED", label: "修改", count: 3 },
  ],
  domains: [{ code: "SAMPLE_NETWORK", label: "样本网络", count: 4 }],
  workUnits: [{ code: "230229", label: "克山直属库", count: 8 }],
  scopeNotice: "仅统计当前用户在周期内已写入审计日志的实际操作。",
};
