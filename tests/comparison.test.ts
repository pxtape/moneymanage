import { describe, it, expect } from "vitest";
import {
  comparisonSeries,
  detailedComparison,
  type ComparisonData,
  type ComparisonDay,
} from "../src/comparison";
import { remindersFor } from "../src/reminders";
import { defaultAppearance } from "../src/appearance";
import type { LedgerSnapshot } from "../src/ledger";
const day = (
  date: string,
  net: string,
  food = "0",
  drink = "0",
): ComparisonDay => ({
  date,
  net,
  food,
  drink,
  count: net === "0" ? 0 : 1,
  food_count: food === "0" ? 0 : 1,
  drink_count: drink === "0" ? 0 : 1,
  refund_count: 0,
});
const data: ComparisonData = {
  status: "ready",
  people: [
    {
      key: "tape",
      name: "Tape",
      daily: [
        day("2026-10-04", "100.25", "60.10", "40.15"),
        day("2026-10-05", "-10.25"),
        day("2026-10-06", "0"),
      ],
    },
    {
      key: "pat",
      name: "Pat",
      daily: [
        day("2026-10-04", "50"),
        day("2026-10-05", "20"),
        day("2026-10-06", "30"),
      ],
    },
  ],
};
describe("private comparison chart data", () => {
  it("uses exact satang and includes refunds in the cumulative line", () => {
    const a = comparisonSeries(data, "net");
    expect(a.daily.map((d) => d.tapeRunning)).toEqual([10025, 9000, 9000]);
    expect(a.summaries[0].calendarAverage).toBe(3000);
    expect(a.breakdown[0]).toEqual({
      name: "Tape",
      food: 6010,
      drink: 4015,
      other: -1025,
    });
  });
  it("splits weeks on Monday and counts only visible days", () => {
    const a = comparisonSeries(data, "net");
    expect(a.weekly.map((w) => [w.days, w.tape, w.pat])).toEqual([
      [1, 10025, 5000],
      [2, -1025, 5000],
    ]);
  });
  it("computes food averages over food purchase days rather than all expense days", () => {
    const a = comparisonSeries(data, "food");
    expect(a.summaries[0].spendingDays).toBe(1);
    expect(a.summaries[0].spendingAverage).toBe(6010);
    expect(a.summaries[1].spendingAverage).toBeNull();
  });
  it("rejects mismatched dates and unsafe aggregates", () => {
    expect(() =>
      comparisonSeries(
        {
          ...data,
          people: [data.people![0], { ...data.people![1], daily: [] }],
        },
        "net",
      ),
    ).toThrow();
    const large = structuredClone(data);
    large.people![0].daily[0].net = "99999999999999999";
    expect(() => comparisonSeries(large, "net")).toThrow();
  });
});
const snapshot = {
  month: "2026-10-01",
  envelopes: [],
} as unknown as LedgerSnapshot;
describe("in-app reminders", () => {
  it("waits until the chosen time and server confirms no expense today", () => {
    const prefs = {
      ...defaultAppearance,
      weeklyReview: false,
      budgetAlerts: false,
    };
    expect(
      remindersFor(prefs, snapshot, "2026-10-27", "19:59", {
        today: "2026-10-27",
        has_expense: false,
      }),
    ).toHaveLength(0);
    expect(
      remindersFor(prefs, snapshot, "2026-10-27", "20:00", {
        today: "2026-10-27",
        has_expense: false,
      }),
    ).toHaveLength(1);
    expect(
      remindersFor(prefs, snapshot, "2026-10-27", "20:00", null),
    ).toHaveLength(0);
    expect(
      remindersFor(prefs, snapshot, "2026-10-27", "20:00", {
        today: "2026-10-27",
        has_expense: true,
      }),
    ).toHaveLength(0);
  });
  it("does not use historical-month budgets for current alerts", () => {
    const old = {
      ...snapshot,
      envelopes: [{ id: "x", name: "Food", allocated: "100", remaining: "5" }],
    } as LedgerSnapshot;
    expect(
      remindersFor(
        { ...defaultAppearance, dailyReminder: false, weeklyReview: false },
        old,
        "2026-11-01",
        "20:00",
        null,
      ),
    ).toHaveLength(0);
  });
});

describe("the four requested comparison charts", () => {
  const recent = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-${String(i + 27).padStart(2, "0")}`,
    net: "1.10",
    count: 1,
  })).map((r, i) => ({
    ...r,
    date: new Date(Date.UTC(2026, 9, 27 + i)).toISOString().slice(0, 10),
  }));
  const richer: ComparisonData = {
    ...data,
    details_ready: true,
    people: data.people!.map((p, i) => ({
      ...p,
      recent_daily: recent,
      categories: [
        {
          name: i ? "อาหารและเครื่องดื่ม" : "อาหาร",
          icon: "🍜",
          net: "80.25",
          gross: "100.25",
          refund: "20",
          count: 1,
        },
      ],
      total_money: i ? "2000" : "1000",
    })),
  };
  it("keeps seven current days across a month boundary and retains independent category names", () => {
    const a = detailedComparison(richer);
    expect(a.recent).toHaveLength(7);
    expect(a.recent[6].date).toBe("2026-11-02");
    expect(a.recentTape).toBe(770);
    expect(a.categories.map((p) => p.rows[0].name)).toEqual([
      "อาหาร",
      "อาหารและเครื่องดื่ม",
    ]);
    expect(a.wealth.map((p) => p.value)).toEqual([100000, 200000]);
    expect(a.categoryDomain).toEqual([0, 8025]);
  });
  it("does not build category or money graphs without extra consent", () => {
    const a = detailedComparison({ ...richer, details_ready: false });
    expect(a.categories).toEqual([]);
    expect(a.wealth).toEqual([]);
  });
});
