import { describe, it, expect } from "vitest";
import { afterBills, dueDate } from "../src/bills";
describe("bill estimates", () => {
  it("clamps a day 31 anchor without losing it in the next month", () => {
    expect(dueDate("2026-02-01", 31)).toBe("2026-02-28");
    expect(dueDate("2028-02-01", 31)).toBe("2028-02-29");
    expect(dueDate("2026-03-01", 31)).toBe("2026-03-31");
    expect(dueDate("2026-04-01", 31)).toBe("2026-04-30");
  });
  it("subtracts expected bills separately, retaining precise satang and deficits", () => {
    expect(afterBills(100000, "795.55")).toBe(20445);
    expect(afterBills(100, "2")).toBe(-100);
    expect(afterBills(-100, "0.01")).toBe(-101);
  });
  it("does not double count a paid estimate", () => {
    expect(afterBills(100000, "200.00")).toBe(80000);
    expect(afterBills(80000, "0")).toBe(80000);
  });
  it("handles aggregate liabilities beyond the safe integer range without rounding", () => {
    expect(afterBills(10000, "900719925474099999.99")).toBeNull();
    expect(afterBills(10000, "NaN")).toBeNull();
    expect(afterBills(10000, "1.001")).toBeNull();
  });
});
