import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import type { MapImageryMetadata } from "../../ui/components/mapImageryMetadata";

const mapImageryMetadataSchema = z.object({
  data: z.object({
    provider: z.string(),
    attribution: z.string(),
    updateCadence: z.string(),
    imageryPeriod: z.string(),
    acquisitionFrom: z.string().nullable(),
    acquisitionTo: z.string().nullable(),
    commercialConfigured: z.boolean(),
    automaticWeeklyPeriod: z.boolean(),
    syncedAt: z.string().nullable(),
    spatialResolutionMeters: z.number().int().positive().nullable(),
    cloudCoveragePercent: z.number().min(0).max(100).nullable(),
    status: z.string(),
    sourceProductIds: z.array(z.string()),
    truthStatement: z.string(),
  }),
});

export class HttpMapImageryRepository {
  constructor(private readonly http: HttpClient) {}

  async metadata(signal?: AbortSignal): Promise<MapImageryMetadata> {
    return (
      await this.http.get(
        "/api/v1/overview/map-imagery/metadata",
        mapImageryMetadataSchema,
        signal ? { signal } : undefined,
      )
    ).data;
  }
}
