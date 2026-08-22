import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import viteConfig, {
  localAcceptanceContractGatePlugin,
  localDevelopmentActor,
  localApiProxy,
  localLoopbackProxyTarget,
  verifyLocalOverviewContract,
} from "./vite.config";

describe("local overview API development proxy", () => {
  it("serves every map document and asset below the business platform gateway prefix", () => {
    expect(viteConfig.base).toBe("/overview-monitoring/");
  });

  it("binds the default development server to numeric loopback", () => {
    expect(viteConfig.server).toMatchObject({ host: "127.0.0.1", port: 63200 });
  });

  it("runs source E2E on a port isolated from the managed runtime copy", () => {
    const playwrightConfig = readFileSync(
      resolve(process.cwd(), "playwright.config.ts"),
      "utf8",
    );

    expect(playwrightConfig).toContain('baseURL: "http://127.0.0.1:63210"');
    expect(playwrightConfig).toContain('url: "http://127.0.0.1:63210"');
    expect(playwrightConfig).toContain("reuseExistingServer: false");
  });

  it("allows only an explicit numeric loopback origin for an isolated acceptance stack", () => {
    expect(
      localLoopbackProxyTarget("http://127.0.0.1:18090", "http://127.0.0.1:8090"),
    ).toBe("http://127.0.0.1:18090");
    expect(() =>
      localLoopbackProxyTarget("http://localhost:18090", "http://127.0.0.1:8090"),
    ).toThrow(/numeric loopback/);
    expect(() =>
      localLoopbackProxyTarget("https://example.com", "http://127.0.0.1:8090"),
    ).toThrow(/numeric loopback/);
  });

  it("forces the loopback development actor after removing browser input", () => {
    let proxyRequestHandler:
      | ((request: {
          removeHeader(name: string): void;
          setHeader(name: string, value: string): void;
        }) => void)
      | undefined;
    const proxy = {
      on: vi.fn((event: string, handler: typeof proxyRequestHandler) => {
        if (event === "proxyReq") proxyRequestHandler = handler;
      }),
    };

    expect(localApiProxy.configure).toBeTypeOf("function");
    localApiProxy.configure?.(proxy as never, {});
    const request = { removeHeader: vi.fn(), setHeader: vi.fn() };
    proxyRequestHandler?.(request);

    expect(localApiProxy.target).toBe("http://127.0.0.1:8090");
    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith("X-Actor", localDevelopmentActor);
  });

  it("stops local acceptance when the backend still serves the legacy overview contract", async () => {
    const fetchContract = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                code: "PRODUCTION_CULTIVATED_AREA",
                name: "核定播种面积",
                sourceCount: 1,
                sourceDomain: "PRODUCTION",
                sourcePath: "/api/v1/production-records",
                unitCode: "亩",
                value: "10",
              },
            ],
          }),
          { headers: { "X-Trace-Id": "trace-def-101" }, status: 200 },
        ),
      ),
    );

    await expect(verifyLocalOverviewContract(fetchContract)).rejects.toThrow(
      /CONTRACT_MISMATCH.*trace-def-101/,
    );
    expect(viteConfig.plugins).toEqual(
      expect.arrayContaining([localAcceptanceContractGatePlugin]),
    );
  });

  it("skips the live startup probe only for the isolated E2E fixture mode", async () => {
    vi.stubEnv("VITEST", "false");
    vi.stubEnv("COFCO_OVERVIEW_E2E_FIXTURE_MODE", "true");
    const fetchContract = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("live backend must not be called"));

    try {
      await expect(
        localAcceptanceContractGatePlugin.configureServer(),
      ).resolves.toBeUndefined();
      expect(fetchContract).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
