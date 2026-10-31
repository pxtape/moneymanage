import { describe, expect, it } from "vitest";
import { budgetPercent, gaugePercent, homeMoney } from "../src/home-dashboard";
describe("home dashboard money math", () => {
  it("keeps exact decimal amounts in satang", () =>
    expect(homeMoney("1234.56")).toBe(123456));
  it("caps the visual gauge but exposes overspending through the amounts", () =>
    expect(gaugePercent("180.00", "150.00")).toBe(100));
  it("calculates an uncapped budget percentage", () =>
    expect(budgetPercent("180.00", "150.00")).toBe(120));
  it("handles a missing target without dividing by zero", () =>
    expect(budgetPercent("10.00", "0.00")).toBe(0));
});
