import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { ProxyOptions } from "vite";

export const localDevelopmentActor = "wang-yang";
const overviewAuditContractVersion = "overview-audit-v2";
const overviewAuditFields = [
  "formula",
  "sourceRelation",
  "dataCutoff",
  "coverageScope",
  "coverageStatus",
  "calculationVersion",
] as const;

export function localLoopbackProxyTarget(value: string | undefined, fallback: string) {
  if (value === undefined || value.trim() === "") return fallback;
  const target = new URL(value);
  if (
    target.protocol !== "http:" ||
    target.hostname !== "127.0.0.1" ||
    target.port === "" ||
    target.username !== "" ||
    target.password !== "" ||
    target.pathname !== "/" ||
    target.search !== "" ||
    target.hash !== ""
  ) {
    throw new Error(
      "Local acceptance proxy target must be an explicit numeric loopback HTTP origin",
    );
  }
  return target.origin;
}

export const localApiProxy: ProxyOptions = {
  target: localLoopbackProxyTarget(
    process.env["COFCO_OVERVIEW_API_PROXY_TARGET"],
    "http://127.0.0.1:8090",
  ),
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest) => {
      proxyRequest.removeHeader("x-actor");
      proxyRequest.setHeader("X-Actor", localDevelopmentActor);
    });
  },
};

export async function verifyLocalOverviewContract(
  fetchContract: typeof fetch = fetch,
): Promise<void> {
  if (typeof localApiProxy.target !== "string") {
    throw new Error("CONTRACT_GATE_CONFIG: local overview API target is unavailable");
  }
  const endpoint = new URL(
    "/api/v1/overview/indicators?productCode=CORN&regionCode=230200&year=2026",
    localApiProxy.target,
  );
  const response = await fetchContract(endpoint, {
    headers: { "X-Actor": localDevelopmentActor },
  });
  const traceId = response.headers.get("X-Trace-Id") ?? "missing";
  if (!response.ok) {
    throw new Error(
      `CONTRACT_GATE_UNAVAILABLE endpoint=${endpoint.pathname} status=${response.status} trace=${traceId}`,
    );
  }
  const payload: unknown = await response.json();
  const record =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : undefined;
  if (record === undefined) {
    throw new Error(
      `CONTRACT_MISMATCH endpoint=${endpoint.pathname} expected=object received=${typeof payload} trace=${traceId}`,
    );
  }
  const received = record["contractVersion"];
  if (received !== overviewAuditContractVersion) {
    throw new Error(
      `CONTRACT_MISMATCH endpoint=${endpoint.pathname} expected=${overviewAuditContractVersion} received=${diagnosticValue(received)} trace=${traceId}`,
    );
  }
  const data = record["data"];
  if (!Array.isArray(data)) {
    throw new Error(
      `CONTRACT_MISMATCH endpoint=${endpoint.pathname} expected=data[] received=${typeof data} trace=${traceId}`,
    );
  }
  data.forEach((indicator, index) => {
    const missing = overviewAuditFields.filter(
      (field) =>
        typeof indicator !== "object" ||
        indicator === null ||
        !Object.prototype.hasOwnProperty.call(indicator, field),
    );
    if (missing.length > 0) {
      throw new Error(
        `CONTRACT_MISMATCH endpoint=${endpoint.pathname} indicator=${index} missing=${missing.join(",")} trace=${traceId}`,
      );
    }
  });
}

function diagnosticValue(value: unknown): string {
  if (value === undefined || value === null) return "missing";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return value.toString();
  try {
    return JSON.stringify(value) ?? typeof value;
  } catch {
    return typeof value;
  }
}

export const localAcceptanceContractGatePlugin = {
  name: "cofco-local-overview-contract-gate",
  async configureServer() {
    if (
      process.env["VITEST"] === "true" ||
      process.env["COFCO_OVERVIEW_E2E_FIXTURE_MODE"] === "true"
    ) {
      return;
    }
    await verifyLocalOverviewContract();
  },
};

export default defineConfig({
  base: "/overview-monitoring/",
  plugins: [localAcceptanceContractGatePlugin, react()],
  server: {
    host: "127.0.0.1",
    port: 63200,
    strictPort: true,
    allowedHosts: ["all"],
    proxy: {
      "/api": localApiProxy,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/testing/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
