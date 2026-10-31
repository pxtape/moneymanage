import { describe, expect, it } from "vitest";
import { budgetPercent, gaugePercent, homeMoney } from "../src/home-dashboard";
describe("home dashboard money math", () => {
  it("renders PostgreSQL division results without crashing", () => {
    expect(homeMoney("564.5161290322580645")).toBe(56452);
    expect(homeMoney("0.00000000000000000000")).toBe(0);
    expect(homeMoney("-12.3450000000000000")).toBe(-1235);
    expect(gaugePercent("30.00", "193.5483870967741935")).toBeGreaterThan(15);
  });
  it("keeps exact decimal amounts in satang", () =>
    expect(homeMoney("1234.56")).toBe(123456));
  it("caps the visual gauge but exposes overspending through the amounts", () =>
    expect(gaugePercent("180.00", "150.00")).toBe(100));
  it("calculates an uncapped budget percentage", () =>
    expect(budgetPercent("180.00", "150.00")).toBe(120));
  it("handles a missing target without dividing by zero", () =>
    expect(budgetPercent("10.00", "0.00")).toBe(0));
});
