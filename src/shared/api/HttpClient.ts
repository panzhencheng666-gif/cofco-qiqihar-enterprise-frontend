import type { ZodType } from "zod";

export interface HttpClient {
  get<T>(path: string, schema: ZodType<T>): Promise<T>;
  post?<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
  put?<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class FetchHttpClient implements HttpClient {
  constructor(private readonly baseUrl = "") {}

  async get<T>(path: string, schema: ZodType<T>): Promise<T> {
    return this.request("GET", path, undefined, schema);
  }

  async post<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T> {
    return this.request("POST", path, body, schema);
  }

  async put<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T> {
    return this.request("PUT", path, body, schema);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    schema: ZodType<T>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new HttpError(response.status, `请求失败：${response.status}`);
    }
    return schema.parse(await response.json());
  }
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
