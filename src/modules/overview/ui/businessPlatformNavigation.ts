const BUSINESS_PLATFORM_LEDGER_HASH = "#/work/pending";
const BUSINESS_PLATFORM_PATH = "/";

function normalizeBusinessPlatformBaseUrl(value: string): string {
  return value.replace(/\/+$/u, "");
}

function parsePositivePort(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return undefined;
  return parsed;
}

function businessPlatformHost(): string {
  const configuredHost = (import.meta.env.VITE_BUSINESS_PLATFORM_HOST || "").trim();
  if (configuredHost) return configuredHost;
  if (typeof window === "undefined") {
    return "127.0.0.1";
  }
  return window.location.hostname;
}

function businessPlatformPort(): number | undefined {
  const configuredPort = parsePositivePort(
    (import.meta.env.VITE_BUSINESS_PLATFORM_PORT || "").trim(),
  );
  if (configuredPort) return configuredPort;
  if (typeof window === "undefined") return undefined;
  return parsePositivePort(window.location.port) || undefined;
}

function protocolFallback(): string {
  if (typeof window === "undefined") return "http:";
  return window.location.protocol;
}

/**
 * The map is a separate frontend, but its business actions belong to the
 * confirmed enterprise platform. Keep that boundary explicit so a map action
 * never falls through to the map app's incomplete legacy shell.
 */
export function businessPlatformLedgerUrl(): string {
  const configured = import.meta.env.VITE_BUSINESS_PLATFORM_URL?.trim();
  if (configured) {
    return `${normalizeBusinessPlatformBaseUrl(configured)}${BUSINESS_PLATFORM_PATH}${BUSINESS_PLATFORM_LEDGER_HASH}`;
  }
  const businessPlatformPortValue = businessPlatformPort();
  const port = businessPlatformPortValue ? `:${businessPlatformPortValue}` : "";
  return `${protocolFallback()}//${businessPlatformHost()}${port}${BUSINESS_PLATFORM_PATH}${BUSINESS_PLATFORM_LEDGER_HASH}`;
}
