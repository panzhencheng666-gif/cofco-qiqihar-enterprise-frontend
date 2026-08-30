import type { ZodType } from "zod";

export interface HttpClient {
  get<T>(path: string, schema: ZodType<T>, options?: HttpRequestOptions): Promise<T>;
  post?<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
  put?<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
  download?(path: string): Promise<HttpDownload>;
}

export interface HttpRequestOptions {
  signal?: AbortSignal;
}

export interface HttpDownload {
  filename: string;
  contentType: string;
  content: Blob;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class HttpContractError extends Error {
  readonly kind = "CONTRACT_MISMATCH" as const;
  readonly endpoint: string;
  readonly expectedContractVersion: string;
  readonly receivedContractVersion: string | null;
  readonly traceId: string | null;

  constructor(details: {
    endpoint: string;
    expectedContractVersion: string;
    receivedContractVersion: string | null;
    traceId: string | null;
    cause?: unknown;
  }) {
    super(
      `Response contract mismatch at ${details.endpoint}; expected ${details.expectedContractVersion}`,
      { cause: details.cause },
    );
    this.name = "HttpContractError";
    this.endpoint = details.endpoint;
    this.expectedContractVersion = details.expectedContractVersion;
    this.receivedContractVersion = details.receivedContractVersion;
    this.traceId = details.traceId;
  }
}

export class FetchHttpClient implements HttpClient {
  constructor(
    private readonly baseUrl = "",
    private readonly cookieSource: () => string = () =>
      typeof document === "undefined" ? "" : document.cookie,
  ) {}

  async get<T>(
    path: string,
    schema: ZodType<T>,
    options?: HttpRequestOptions,
  ): Promise<T> {
    return this.request("GET", path, undefined, schema, options);
  }

  async post<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T> {
    return this.request("POST", path, body, schema);
  }

  async put<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T> {
    return this.request("PUT", path, body, schema);
  }

  async download(path: string): Promise<HttpDownload> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: "same-origin",
      headers: { Accept: "application/octet-stream" },
    });
    if (!response.ok) {
      throw new HttpError(response.status, `下载失败：${response.status}`);
    }
    return {
      filename:
        filenameFrom(response.headers.get("Content-Disposition")) ?? "report-export",
      contentType: response.headers.get("Content-Type") ?? "application/octet-stream",
      content: await response.blob(),
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    schema: ZodType<T>,
    options?: HttpRequestOptions,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...csrfHeaders(method, this.cookieSource()),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) {
      throw new HttpError(response.status, `请求失败：${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpContractError({
        endpoint: path,
        expectedContractVersion: schema.description ?? "declared-response-contract",
        receivedContractVersion: contractVersionFrom(payload),
        traceId: response.headers.get("X-Trace-Id"),
        cause: parsed.error,
      });
    }
    return parsed.data;
  }
}

function csrfHeaders(method: string, cookieHeader: string): Record<string, string> {
  if (method === "GET") return {};
  const token = csrfTokenFromCookies(cookieHeader);
  return token ? { "X-XSRF-TOKEN": token } : {};
}

function csrfTokenFromCookies(cookieHeader: string): string | undefined {
  const encoded = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="))
    ?.slice("XSRF-TOKEN=".length);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function contractVersionFrom(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const version = (payload as Record<string, unknown>)["contractVersion"];
  return typeof version === "string" ? version : null;
}

function filenameFrom(contentDisposition: string | null): string | undefined {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition ?? "")?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/i.exec(contentDisposition ?? "")?.[1];
}

export function queryString(
  values: Readonly<Record<string, string | number | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}
