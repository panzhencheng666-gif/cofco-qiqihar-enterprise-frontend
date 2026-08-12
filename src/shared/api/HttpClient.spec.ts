import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { FetchHttpClient, HttpContractError } from "./HttpClient";

describe("FetchHttpClient contract diagnostics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("classifies a successful legacy response as a traceable contract mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [] }), {
            headers: {
              "Content-Type": "application/json",
              "X-Trace-Id": "trace-def-101",
            },
            status: 200,
          }),
        ),
      ),
    );
    const schema = z
      .object({
        contractVersion: z.literal("overview-audit-v2"),
        data: z.array(z.unknown()),
      })
      .describe("overview-audit-v2");

    const failure = await new FetchHttpClient()
      .get("/api/v1/overview/indicators", schema)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpContractError);
    expect(failure).toMatchObject({
      endpoint: "/api/v1/overview/indicators",
      expectedContractVersion: "overview-audit-v2",
      kind: "CONTRACT_MISMATCH",
      receivedContractVersion: null,
      traceId: "trace-def-101",
    });
  });
});
