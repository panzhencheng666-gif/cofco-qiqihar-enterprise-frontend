import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SamplePointMapSymbol } from "./TerrainReliefBoundaryMap";

describe("historical sample role symbols", () => {
  it.each(["PRODUCTION", "MARKET", "LOGISTICS"] as const)(
    "uses the same visible asset as current %s samples",
    (code) => {
      const roles = [
        {
          code,
          name: code,
          iconKey: (
            {
              PRODUCTION: "production",
              MARKET: "market",
              LOGISTICS: "logistics",
            } as const
          )[code],
        },
      ];
      const current = render(
        <SamplePointMapSymbol
          iconKey={code.toLowerCase()}
          layerType="ANNUAL_ACTUAL"
          roles={roles}
        />,
      );
      const src = current.container.querySelector("img")?.getAttribute("src");
      expect(src).toBeTruthy();
      const historical = render(
        <SamplePointMapSymbol
          iconKey={code.toLowerCase()}
          layerType="HISTORICAL_ACTUAL"
          roles={roles}
        />,
      );
      expect(historical.container.querySelector("img")?.getAttribute("src")).toBe(src);
    },
  );
});
