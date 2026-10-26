import type { LedgerTransaction } from "./ledger";
export interface ExpenseTemplate {
  id: string;
  name: string;
  amount: string;
  category_id: string;
  updated_at: string;
}
export interface BillRule extends ExpenseTemplate {
  envelope_id: string | null;
  first_month: string;
  due_day: number;
}
export interface BillItem {
  rule_id: string;
  period_start: string;
  due_on: string;
  name: string;
  amount: string;
  paid: boolean;
  version?: string;
  transaction?: LedgerTransaction;
}
export interface BillStatus {
  pending_total: string;
  pending_current: BillItem[];
  items: BillItem[];
  rules: BillRule[];
}
/** Use integer arithmetic even for unusually large combined liabilities. */
export function afterBills(spendable: number, pending: string): number | null {
  if (!Number.isSafeInteger(spendable)) return null;
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(pending)) return null;
  const [whole, fraction = ""] = pending.split(".");
  const result =
    BigInt(spendable) -
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  return result > BigInt(Number.MAX_SAFE_INTEGER) ||
    result < BigInt(Number.MIN_SAFE_INTEGER)
    ? null
    : Number(result);
}
export function dueDate(month: string, day: number): string {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month.slice(0, 7)}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
