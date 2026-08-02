import type { ZodType } from "zod";

export interface HttpClient {
  get<T>(path: string, schema: ZodType<T>): Promise<T>;
}

export class FetchHttpClient implements HttpClient {
  constructor(private readonly baseUrl = "") {}

  async get<T>(path: string, schema: ZodType<T>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
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
