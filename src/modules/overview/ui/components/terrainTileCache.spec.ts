import { describe, expect, it, vi } from "vitest";
import { createTerrainTileCache } from "./terrainTileCache";

const tile = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "cache-control": "public, max-age=60" },
  });
describe("terrain tile download cache", () => {
  it("briefly retains immutable elevation tiles when no expiry is supplied", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(new Uint8Array([1]))));
    const load = createTerrainTileCache(fetcher);
    await load("tile");
    await load("tile");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("shares concurrent terrain/shadow downloads and returns independent buffers", async () => {
    const fetcher = vi.fn(() => Promise.resolve(tile()));
    const load = createTerrainTileCache(fetcher);
    const [a, b] = await Promise.all([load("tile"), load("tile")]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).not.toBe(b);
    expect([...new Uint8Array(a)]).toEqual([1, 2, 3]);
    new Uint8Array(a)[0] = 9;
    expect([...new Uint8Array(await load("tile"))]).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not retain no-store responses or failures", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(new Response("x", { headers: { "cache-control": "no-store" } })),
    );
    const load = createTerrainTileCache(fetcher);
    await load("tile");
    await load("tile");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const failure = vi.fn(() => Promise.resolve(new Response("", { status: 503 })));
    const retry = createTerrainTileCache(failure);
    await expect(retry("tile")).rejects.toThrow("503");
    await expect(retry("tile")).rejects.toThrow("503");
    expect(failure).toHaveBeenCalledTimes(2);
  });
  it("expires cached tiles and bounds retained bytes", async () => {
    let now = 0;
    const fetcher = vi.fn(() => Promise.resolve(tile()));
    const load = createTerrainTileCache(fetcher, { maxBytes: 3, now: () => now });
    await load("a");
    await load("b");
    await load("a");
    expect(fetcher).toHaveBeenCalledTimes(3);
    now = 61000;
    await load("a");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
