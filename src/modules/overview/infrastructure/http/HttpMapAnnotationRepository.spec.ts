import { afterEach, expect, it, vi } from "vitest";
import type { SaveMapAnnotation } from "../../application/ports/MapAnnotationRepository";
import { FetchHttpClient } from "../../../../shared/api/HttpClient";
import { HttpMapAnnotationRepository } from "./HttpMapAnnotationRepository";

afterEach(() => vi.unstubAllGlobals());
it.each(["POINT", "RECTANGLE"] as const)(
  "sends %s coordinates within the backend eight-decimal contract",
  async (type) => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const command = JSON.parse(init.body as string) as SaveMapAnnotation;
      const coordinates = [
        command.minLongitude,
        command.minLatitude,
        command.maxLongitude,
        command.maxLatitude,
      ].filter((v) => v !== null && v !== undefined);
      const valid = coordinates.every(
        (v) => (String(v).split(".")[1]?.length ?? 0) <= 8,
      );
      return await Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              ...command,
              maxLongitude: command.maxLongitude ?? command.minLongitude,
              maxLatitude: command.maxLatitude ?? command.minLatitude,
              version: 1,
              updatedAt: "2026-09-17T00:00:00Z",
            },
          }),
          { status: valid ? 200 : 400 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const command = {
      type,
      minLongitude: 123.123456789123,
      minLatitude: 47.234567891234,
      maxLongitude: type === "POINT" ? null : 124.345678912345,
      maxLatitude: type === "POINT" ? null : 48.456789123456,
    };
    await expect(
      new HttpMapAnnotationRepository(new FetchHttpClient()).save(command),
    ).resolves.toMatchObject({
      type,
      minLongitude: 123.12345679,
      minLatitude: 47.23456789,
    });
    expect(command.minLongitude).toBe(123.123456789123);
  },
);
