import type { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpReportingRepository } from "./HttpReportingRepository";

describe("HttpReportingRepository activity reports", () => {
  it("uses the governed personal and system report endpoints", async () => {
    const get = vi.fn((_path: string, schema: z.ZodType) =>
      Promise.resolve(parse(schema, { data: activityReport })),
    );
    const repository = new HttpReportingRepository({
      get: get as HttpClient["get"],
    });

    await expect(repository.personalActivity(7)).resolves.toEqual(activityReport);
    await expect(repository.systemActivity(30)).resolves.toEqual(activityReport);
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/api/v1/activity-reports/personal?days=7",
      expect.anything(),
      undefined,
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/activity-reports/system?days=30",
      expect.anything(),
      undefined,
    );
  });

  it("creates and downloads a system DOCX export", async () => {
    const post = vi.fn((_path: string, _body: unknown, schema: z.ZodType) =>
      Promise.resolve(
        parse(schema, {
          data: {
            id: "export-1",
            filename: "全系统周期总结.docx",
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sha256: "a".repeat(64),
            generatedAt: "2026-09-18T00:00:00Z",
          },
        }),
      ),
    );
    const download = vi.fn<NonNullable<HttpClient["download"]>>(() =>
      Promise.resolve({
        filename: "全系统周期总结.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        content: new Blob(),
      }),
    );
    const repository = new HttpReportingRepository({
      get: vi.fn(),
      post: post as NonNullable<HttpClient["post"]>,
      download,
    });

    await repository.exportSystemActivity(7);
    await repository.downloadSystemActivity("export-1");
    expect(post).toHaveBeenCalledWith(
      "/api/v1/activity-reports/system/exports?days=7",
      {},
      expect.anything(),
    );
    expect(download).toHaveBeenCalledWith(
      "/api/v1/activity-reports/system/exports/export-1/content",
    );
  });
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

const activityReport = {
  kind: "PERSONAL" as const,
  periodDays: 7 as const,
  periodStart: "2026-09-11T00:00:00Z",
  periodEnd: "2026-09-18T00:00:00Z",
  eventCutoff: "2026-09-18T00:00:00Z",
  subject: {
    subjectId: "user-1",
    displayName: "张三",
    workUnitName: "克山直属库",
  },
  effectiveUserCount: 1,
  totalEvents: 2,
  samplePointsCreated: 1,
  samplePointsDeleted: 0,
  actions: [{ code: "CREATED", label: "新增", count: 1 }],
  domains: [{ code: "SAMPLE_NETWORK", label: "样本网络", count: 1 }],
  workUnits: [{ code: "230229", label: "克山直属库", count: 2 }],
  scopeNotice: "实际审计事件。",
};
