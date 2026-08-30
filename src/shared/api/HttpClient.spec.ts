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

  it("returns the readable XSRF cookie on writes but never on reads", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const schema = z.object({ ok: z.literal(true) });
    const client = new FetchHttpClient(
      "",
      () => "theme=dark; XSRF-TOKEN=csrf%2Ftoken%2Bvalue",
    );

    await client.get("/api/v1/items", schema);
    await client.post("/api/v1/items", { name: "item" }, schema);
    await client.put("/api/v1/items/1", { name: "updated" }, schema);

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/items");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has("X-XSRF-TOKEN")).toBe(
      false,
    );
    for (const call of [2, 3]) {
      expect(
        new Headers(fetcher.mock.calls[call - 1]?.[1]?.headers).get("X-XSRF-TOKEN"),
      ).toBe("csrf/token+value");
    }
  });

  it("does not fabricate an XSRF header for a malformed cookie", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await new FetchHttpClient("", () => "XSRF-TOKEN=%E0%A4%A").post(
      "/api/v1/items",
      {},
      z.object({ ok: z.literal(true) }),
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/items");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has("X-XSRF-TOKEN")).toBe(
      false,
    );
  });

  it("passes an AbortSignal to fetch for cancellable reads", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    await new FetchHttpClient().get(
      "/api/v1/items",
      z.object({ ok: z.literal(true) }),
      { signal: controller.signal },
    );

    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});
