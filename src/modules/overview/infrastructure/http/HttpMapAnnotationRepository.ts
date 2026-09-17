import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import type {
  MapAnnotationRepository,
  SaveMapAnnotation,
} from "../../application/ports/MapAnnotationRepository";

const annotation = z.object({
  type: z.enum(["POINT", "RECTANGLE"]),
  minLongitude: z.coerce.number(),
  minLatitude: z.coerce.number(),
  maxLongitude: z.coerce.number(),
  maxLatitude: z.coerce.number(),
  regionCode: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? undefined),
  administrativeLevel: z
    .enum(["CITY", "COUNTY", "TOWNSHIP", "VILLAGE"])
    .nullable()
    .optional()
    .transform((value) => value ?? undefined),
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
const currentResponse = z.object({ data: annotation.nullable() });
const saveResponse = z.object({ data: annotation });
const deleteResponse = z.object({ data: z.object({ deleted: z.boolean() }) });

export class HttpMapAnnotationRepository implements MapAnnotationRepository {
  constructor(private readonly http: HttpClient) {}
  async current() {
    return (
      (await this.http.get("/api/v1/overview/map-annotation", currentResponse)).data ??
      undefined
    );
  }
  async save(command: SaveMapAnnotation) {
    if (!this.http.put) throw new Error("HTTP PUT is unavailable");
    const coordinate = (value: number) => Number(value.toFixed(8));
    const payload = {
      ...command,
      minLongitude: coordinate(command.minLongitude),
      minLatitude: coordinate(command.minLatitude),
      maxLongitude:
        command.maxLongitude == null
          ? command.maxLongitude
          : coordinate(command.maxLongitude),
      maxLatitude:
        command.maxLatitude == null
          ? command.maxLatitude
          : coordinate(command.maxLatitude),
    };
    return (
      await this.http.put("/api/v1/overview/map-annotation", payload, saveResponse)
    ).data;
  }
  async delete() {
    if (!this.http.delete) throw new Error("HTTP DELETE is unavailable");
    return (await this.http.delete("/api/v1/overview/map-annotation", deleteResponse))
      .data.deleted;
  }
}
