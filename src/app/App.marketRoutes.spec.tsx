import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../modules/market-intelligence/ui/MarketIntelligencePage", () => ({
  MarketIntelligencePage: () => <main>商情路由目标</main>,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("market routes on official application shell", () => {
  it.each([
    "#/market-intelligence",
    "#/market-intelligence/tools",
    "#/market-intelligence/analysis/quotes/corn",
  ])("keeps %s independent of product navigation", async (hash) => {
    const fetch = vi.fn().mockRejectedValue(new Error("unexpected request"));
    vi.stubGlobal("fetch", fetch);
    window.history.replaceState(null, "", hash);

    render(<App />);
    expect(screen.getByText("商情路由目标")).toBeVisible();
    await act(async () => Promise.resolve());
    expect(window.location.hash).toBe(hash);
    expect(fetch).not.toHaveBeenCalled();
  });
});
