import type { Page } from "@playwright/test";

type Snapshot = {
  cash?: string;
  savings?: string;
  income: string;
  expenses: string;
  transactions?: Array<Record<string, unknown>>;
  envelopes?: Array<{
    id: string;
    name: string;
    icon?: string;
    allocated: string;
    spent: string;
    remaining: string;
  }>;
};
export async function mockHome(page: Page, getSnapshot: () => Snapshot) {
  await page.route("**/rest/v1/rpc/moneyspace_home", (route) => {
    const state = getSnapshot();
    const date = route.request().postDataJSON().p_date as string;
    const cash = state.cash || "0";
    const savings = state.savings || "0";
    const spendable = (Number(cash) - Number(savings)).toFixed(2);
    const transactions = (state.transactions || []).map((t, index) => ({
      id: String(t.id ?? index),
      kind: String(t.kind ?? "expense"),
      amount: String(t.amount ?? "0"),
      merchant: String(t.merchant ?? "รายการ"),
      category: String(t.category_name_snapshot ?? "ไม่ระบุหมวด"),
      icon: String(t.category_icon_snapshot ?? "✳️"),
    }));
    const budgets = (state.envelopes || []).map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon || "👛",
      target: e.allocated,
      spent: e.spent,
      remaining: e.remaining,
    }));
    return route.fulfill({
      json: {
        selected_date: date,
        cycle_day: 1,
        cycle_from: date.slice(0, 7) + "-01",
        cycle_through: date.slice(0, 7) + "-31",
        money: { total: cash, savings, spendable },
        cycle: {
          income: state.income,
          expenses: state.expenses,
          budget_total: String(
            budgets.reduce((n, b) => n + Number(b.target), 0),
          ),
          budget_spent: String(
            budgets.reduce((n, b) => n + Number(b.spent), 0),
          ),
        },
        daily: {
          target: "0",
          expenses: state.expenses,
          transactions,
          categories: [],
          types: [],
        },
        weekly: {
          from: date,
          through: date,
          previous_from: date,
          previous_through: date,
          days: Array.from({ length: 7 }, () => ({
            date,
            current: "0",
            previous: "0",
          })),
        },
        monthly: { budgets },
        yearly: [],
      },
    });
  });
}
