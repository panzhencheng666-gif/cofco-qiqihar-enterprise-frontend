import { z } from "zod";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import type { ReportingRepository } from "../../application/ports/ReportingRepository";

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
export class HttpReportingRepository implements ReportingRepository {
  constructor(private readonly http: HttpClient) {}
  async options() {
    return (
      await this.http.get(
        "/api/v1/reports/parameter-options",
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
    ).data;
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
}
