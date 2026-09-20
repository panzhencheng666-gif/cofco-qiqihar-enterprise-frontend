export function createTerrainTileCache(
  fetcher: typeof fetch = fetch,
  options: { maxBytes?: number; now?: () => number } = {},
) {
  const now = options.now ?? Date.now;
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const cache = new Map<string, { data: ArrayBuffer; expires: number }>();
  const pending = new Map<string, Promise<ArrayBuffer>>();
  let retainedBytes = 0;
  const drop = (key: string) => {
    retainedBytes -= cache.get(key)?.data.byteLength ?? 0;
    cache.delete(key);
  };
  return async (url: string): Promise<ArrayBuffer> => {
    const cached = cache.get(url);
    if (cached && cached.expires > now()) {
      cache.delete(url);
      cache.set(url, cached);
      return cached.data.slice(0);
    }
    if (cached) drop(url);
    let request = pending.get(url);
    if (!request) {
      request = (async () => {
        const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Terrain tile HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        const policy = response.headers.get("cache-control") ?? "";
        // Static DEM responses often omit cache headers. Keep those only five
        // minutes in this bounded in-memory cache; explicit no-cache still wins.
        const maxAge = Number(/(?:^|,)\s*max-age=(\d+)/i.exec(policy)?.[1] ?? 300);
        const age = Number(response.headers.get("age") ?? 0);
        const ttl = Math.min(1800, Math.max(0, maxAge - age));
        if (
          !/no-store|no-cache/i.test(policy) &&
          ttl > 0 &&
          data.byteLength <= maxBytes
        ) {
          cache.set(url, { data, expires: now() + ttl * 1000 });
          retainedBytes += data.byteLength;
          while (retainedBytes > maxBytes && cache.size)
            drop(cache.keys().next().value!);
        }
        return data;
      })().finally(() => pending.delete(url));
      pending.set(url, request);
    }
    // MapLibre transfers buffers to workers; never detach the shared cache copy.
    return (await request).slice(0);
  };
}
