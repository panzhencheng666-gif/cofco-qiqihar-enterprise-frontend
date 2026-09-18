import { z } from "zod";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import type { ReportingRepository } from "../../application/ports/ReportingRepository";
import { ReadRequestCache } from "../../../../shared/api/ReadRequestCache";

const option = z.object({ code: z.string(), label: z.string() });
const preview = z.object({
  id: z.string(),
  definitionCode: z.string(),
  datasetId: z.string(),
  title: z.string(),
  dataCutoffLabel: z.string(),
  lines: z.array(z.object({ label: z.string(), value: z.string(), note: z.string() })),
  sections: z.array(
    z.object({ code: z.string(), title: z.string(), body: z.string() }),
  ),
  expiresAt: z.string(),
  version: z.number().int(),
  legacyReadOnly: z.boolean(),
});
const activityCount = z.object({
  code: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
});
const activityReport = z.object({
  kind: z.enum(["PERSONAL", "SYSTEM"]),
  periodDays: z.union([z.literal(7), z.literal(30)]),
  periodStart: z.string(),
  periodEnd: z.string(),
  eventCutoff: z.string(),
  subject: z
    .object({
      subjectId: z.string(),
      displayName: z.string(),
      workUnitName: z.string(),
    })
    .nullable(),
  effectiveUserCount: z.number().int().nonnegative(),
  totalEvents: z.number().int().nonnegative(),
  samplePointsCreated: z.number().int().nonnegative(),
  samplePointsDeleted: z.number().int().nonnegative(),
  actions: z.array(activityCount),
  domains: z.array(activityCount),
  workUnits: z.array(activityCount),
  scopeNotice: z.string(),
});
export class HttpReportingRepository implements ReportingRepository {
  private readonly reads = new ReadRequestCache();

  constructor(private readonly http: HttpClient) {}
  async options() {
    const path = "/api/v1/reports/parameter-options";
    return this.reads.get(
      path,
      async () =>
        (
          await this.http.get(
            path,
            z.object({
              data: z.object({
                definitions: z.array(
                  z.object({
                    code: z.string(),
                    name: z.string(),
                    businessDomain: z.string(),
                    businessSubtype: z.string(),
                    frequencyCode: z.string(),
                    version: z.number().int(),
                    sections: z.array(
                      z.object({
                        code: z.string(),
                        title: z.string(),
                        sortOrder: z.number().int(),
                      }),
                    ),
                  }),
                ),
                products: z.array(option),
                cultivars: z.array(option),
                regionLevels: z.array(option),
                regions: z.array(option),
                periods: z.array(option),
                formats: z.array(option),
              }),
            }),
          )
        ).data,
    );
  }
  async preview(command: Parameters<ReportingRepository["preview"]>[0]) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (
      await this.http.post(
        "/api/v1/reports/previews",
        command,
        z.object({ data: preview }),
      )
    ).data;
  }
  async export(previewId: string, formatCode: string) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (
      await this.http.post(
        `/api/v1/reports/previews/${encodeURIComponent(previewId)}/exports`,
        { formatCode },
        z.object({
          data: z.object({
            id: z.string(),
            previewId: z.string(),
            formatCode: z.string(),
            filename: z.string(),
            contentType: z.string(),
            requestedAt: z.string(),
          }),
        }),
      )
    ).data;
  }
  async download(exportTaskId: string) {
    if (!this.http.download) throw new Error("HTTP client does not support downloads");
    return this.http.download(
      `/api/v1/reports/exports/${encodeURIComponent(exportTaskId)}/content`,
    );
  }
  async publish(previewId: string, exportTaskId: string, expectedVersion: number) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (
      await this.http.post(
        `/api/v1/reports/previews/${encodeURIComponent(previewId)}/publications`,
        { exportTaskId, expectedVersion },
        z.object({
          data: z.object({
            id: z.string(),
            previewId: z.string(),
            exportTaskId: z.string(),
            publishedAt: z.string(),
            version: z.number().int(),
          }),
        }),
      )
    ).data;
  }

  async personalActivity(days: 7 | 30, signal?: AbortSignal) {
    return (
      await this.http.get(
        `/api/v1/activity-reports/personal?days=${days}`,
        z.object({ data: activityReport }),
        signal ? { signal } : undefined,
      )
    ).data;
  }

  async systemActivity(days: 7 | 30, signal?: AbortSignal) {
    return (
      await this.http.get(
        `/api/v1/activity-reports/system?days=${days}`,
        z.object({ data: activityReport }),
        signal ? { signal } : undefined,
      )
    ).data;
  }

  async exportSystemActivity(days: 7 | 30) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (
      await this.http.post(
        `/api/v1/activity-reports/system/exports?days=${days}`,
        {},
        z.object({
          data: z.object({
            id: z.string(),
            filename: z.string(),
            contentType: z.string(),
            sha256: z.string().length(64),
            generatedAt: z.string(),
          }),
        }),
      )
    ).data;
  }

  async downloadSystemActivity(exportId: string) {
    if (!this.http.download) throw new Error("HTTP client does not support downloads");
    return this.http.download(
      `/api/v1/activity-reports/system/exports/${encodeURIComponent(exportId)}/content`,
    );
  }
}
