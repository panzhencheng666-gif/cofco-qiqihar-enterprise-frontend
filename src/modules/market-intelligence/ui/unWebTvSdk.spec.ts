import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.querySelectorAll("script[data-un-webtv-sdk]").forEach((s) => s.remove());
});

it("shares a bounded fixed-origin SDK load and resolves the actual global API", async () => {
  const { loadUnWebTvSdk } = await import("./unWebTvPlayer");
  const first = loadUnWebTvSdk();
  const second = loadUnWebTvSdk();
  expect(first).toBe(second);
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    "script[data-un-webtv-sdk]",
  );
  expect(scripts).toHaveLength(1);
  expect(scripts[0]!.src).toBe(
    "https://cdnapisec.kaltura.com/p/2503451/embedPlaykitJs/uiconf_id/49754663",
  );
  const api = { setup: vi.fn() };
  vi.stubGlobal("KalturaPlayer", api);
  scripts[0]!.dispatchEvent(new Event("load"));
  await expect(first).resolves.toBe(api);
});

it("rejects a loaded script without API and permits a fresh retry", async () => {
  const { loadUnWebTvSdk } = await import("./unWebTvPlayer");
  const first = loadUnWebTvSdk();
  const check = expect(first).rejects.toThrow();
  document.querySelector("script[data-un-webtv-sdk]")!.dispatchEvent(new Event("load"));
  await check;
  expect(document.querySelector("script[data-un-webtv-sdk]")).toBeNull();
  const retry = loadUnWebTvSdk();
  const failed = expect(retry).rejects.toThrow();
  document
    .querySelector("script[data-un-webtv-sdk]")!
    .dispatchEvent(new Event("error"));
  await failed;
});

it("times out a silent SDK request and removes its handlers", async () => {
  vi.useFakeTimers();
  const { loadUnWebTvSdk } = await import("./unWebTvPlayer");
  const request = loadUnWebTvSdk();
  const failed = expect(request).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(12000);
  await failed;
  expect(document.querySelector("script[data-un-webtv-sdk]")).toBeNull();
});
