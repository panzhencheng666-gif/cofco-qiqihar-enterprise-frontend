import { describe, expect, it } from "vitest";
import { calculatorModels, calculateManual } from "./calculatorModels";

function model(id: string) {
  const found = calculatorModels.find((item) => item.id === id);
  if (!found) throw new Error(`Missing tool ${id}`);
  return found;
}

describe("manual grain calculators", () => {
  it("calculates the photographed grain price chain from user inputs", () => {
    expect(
      calculateManual(model("grain-chain"), {
        raw: "4300",
        premium: "150",
        tower: "60",
      }).value,
    ).toBe(4510);
  });

  it("calculates soybean crushing margin with entered yields", () => {
    expect(
      calculateManual(model("soy-domestic"), {
        meal: "3550",
        mealYield: "80",
        oil: "9450",
        oilYield: "16.5",
        soy: "4500",
        processing: "180",
        other: "0",
      }).value,
    ).toBeCloseTo(-280.75);
  });

  it("rejects an incomplete or invalid feed rice blend", () => {
    const values = {
      paddy: "2500",
      fees: "100",
      byproduct: "100",
      yield: "80",
      riceShare: "70",
      alternate: "2200",
      alternateShare: "20",
      finance: "20",
    };
    expect(calculateManual(model("feed-rice"), values).error).toMatch(/100%/);
    expect(calculateManual(model("wet-dry"), {}).value).toBeNull();
  });

  it("does not treat an undefined denominator as a calculated value", () => {
    expect(
      calculateManual(model("stock-use"), { stock: "50", use: "0" }).value,
    ).toBeNull();
  });
});
