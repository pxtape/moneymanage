import { decimalSatang } from "./ledger";

export type HomeRange = "day" | "week" | "month" | "year";
export interface HomeTransaction {
  id: string;
  kind: "income" | "expense" | "refund" | "transfer";
  amount: string;
  merchant: string;
  category: string;
  icon: string;
}
export interface HomeCategory {
  name: string;
  icon: string;
  amount: string;
}
export interface HomeType {
  name: string;
  type: "income" | "expense";
  amount: string;
}
export interface HomeBudget {
  id: string;
  name: string;
  icon: string;
  target: string;
  spent: string;
  remaining: string;
}
export interface HomeDashboardData {
  selected_date: string;
  cycle_day: number;
  cycle_from: string;
  cycle_through: string;
  money: { total: string; savings: string; spendable: string };
  cycle: {
    income: string;
    expenses: string;
    budget_total: string;
    budget_spent: string;
  };
  daily: {
    target: string;
    expenses: string;
    transactions: HomeTransaction[];
    categories: HomeCategory[];
    types: HomeType[];
  };
  weekly: {
    from: string;
    through: string;
    previous_from: string;
    previous_through: string;
    days: { date: string; current: string; previous: string }[];
  };
  monthly: { budgets: HomeBudget[] };
  yearly: {
    month: string;
    from: string;
    through: string;
    income: string;
    expenses: string;
    savings: string;
  }[];
}
// Derived NUMERIC values (for example a monthly budget / 31 days) can
// contain more than two decimals. Round their display value in decimal
// space while keeping the strict ledger parser for recorded amounts.
export function homeMoney(value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error("Invalid decimal");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents = decimalSatang(`${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`);
  const rounded = cents + (Number(fraction[2] || "0") >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(rounded)) throw new Error("Amount exceeds safe range");
  return negative ? -rounded : rounded;
}
export function gaugePercent(spent: string, target: string) {
  const goal = homeMoney(target);
  const used = homeMoney(spent);
  return goal <= 0
    ? used > 0
      ? 100
      : 0
    : Math.max(0, Math.min(100, (used / goal) * 100));
}
export function budgetPercent(spent: string, target: string) {
  const goal = homeMoney(target);
  return goal <= 0
    ? 0
    : Math.max(0, spent === "0" ? 0 : (homeMoney(spent) / goal) * 100);
}
