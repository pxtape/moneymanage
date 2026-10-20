# M3: real personal accounts, budgets and transactions

## Delivered

The authenticated space is a real financial dashboard, isolated from demo data. Bank/cash/e-wallet accounts use exact opening balances plus non-deleted ledger movements. Quick expense entry needs only amount and category; merchant defaults to category. Categories map to an optional personal envelope. Additional fields and envelope overrides remain optional. There is no email or registration change; tape/pat keep their existing credentials.

Income, expenses, transfers and linked partial refunds are live. Transactions can be edited and soft-deleted, with optimistic updated_at checks and full before/after versions in RLS-protected Supabase rows. Refunds inherit the original account/category/envelope, cannot precede the expense, and cannot exceed its remaining refundable amount. Expenses with linked refunds cannot be changed/deleted until the refund is removed. Refunds themselves are corrected by deleting/recreating them. Type changes are intentionally rejected.

Envelope allocations are a separate ledger and never reduce cash or count as expenses. Allocations specify the month's total amount, not an increment. Modes: none, positive-only carry, or full carry including negative balances. Missing calendar months are filled between the earliest open month and the current month, with zero new allocations. Opening a month never copies income or charges cash. Historical edits recalculate carryovers forward. Rollover mode is chosen at envelope creation and remains fixed in M3.

Savings goals use earmarks against a physical account. Cash and consumption do not change. Reserved savings cannot be spent/transferred until released. A contribution can be released without creating income. Physical transfers between accounts are separate from savings earmarks.

## Financial definitions

- Actual cash: current balances of personal bank/cash/e-wallet accounts. It includes reserved budget and earmarked savings; those are still cash.
- Spendable after savings: cash minus outstanding earmarks. It includes envelope money.
- Current envelope reserve: sum of positive current-month remaining envelope balances. Negative/full rollover debt does not create negative reserves.
- Unallocated: cash minus earmarked savings minus positive current-month envelope reserves.
- Monthly net expense: expenses minus linked refunds dated in that month. Transfers, allocations and earmarks are excluded.
- Safe daily budget: floor to satang of positive current-month envelope remainders, limited by cash after savings, divided by remaining calendar days including today. No calendar-day analytics average is claimed here (M4).

The account header is always current; when browsing a past month, only monthly expenses, transactions and envelope balances are historical. This is explained in the UI. The current reserve returned by the API is independent of the browsed month.

## Correctness/security

`moneyspace_write` is a public SECURITY INVOKER wrapper over a non-exposed private SECURITY DEFINER function. The private function requires auth.uid(), locks that user's completed profile, verifies every account/category/envelope/goal owner and personal scope, validates precise nonnegative amounts, caps refunds, performs writes, recalculates rollover, checks account liquidity/reserves, and writes a request receipt in the same transaction. Failures roll everything back. No shared financial writes are opened in M3.

Per-user serialization also protects independent requests arriving concurrently. Request UUID + exact operation/payload returns the original result on retry; reusing a UUID for different input fails. Browser retry keys remain in memory for the current page; they survive a failed response while the form is open, but not a full page reload. No offline queue or optimistic financial writes exist. After an uncertain response, retry the same form; after a full reload, inspect the confirmed ledger before entering it again. Persistent offline draft/retry behavior remains M6.

Only a server-confirmed response is labeled saved. If a write confirms but refreshing the snapshot fails, the app says the write was saved and the summary is stale, rather than falsely saying nothing was written. No real financial payload is stored in local/session storage. Auth tokens and theme settings are the existing standard client state.

Direct account INSERT and client changes to onboarding-completed state are revoked. Atomic onboarding still works through its authenticated private implementation and remains idempotent. Private request receipts explicitly deny client access. Read projections use security_invoker=true and RLS. Every new app table has RLS. Monetary API values are decimal strings parsed into safe integer satang; aggregate cash is bounded to the JavaScript exact-integer range. NUMERIC inputs reject NaN/infinity/fractional satang before storage.

Transaction history is append-only for clients. UI displays the latest 30 versions; the ledger displays the latest 100 transactions of a selected month, labeled with its total. Server summaries include every transaction, not just the displayed subset. Search/filter applies to displayed rows. Complete pagination, CSV import/export for real records, and wider history UX remain M6.

## Verification

- Lint, typecheck, production build and 12 Vitest tests passed locally.
- 12 Playwright tests passed at 390px and 1440px, using mocked Auth/financial API responses for browser isolation. They include minimal quick entry, category reuse, onboarding, server-confirmed changes, failed-response retry with the same UUID, and allocation/transfer neutrality. They do not claim a live email flow.
- `supabase/tests/financial.sql` passed against actual Supabase Postgres: decimals, allocation neutrality, historical positive/full/none rollover, transfers, capped refunds, savings, rollback, idempotency, stale edits, soft deletion and version privacy.
- Existing authorization SQL passed again on the deployed database.
- Live concurrent SQL requests each attempted an expense of 80 against 100: exactly one committed, the other was rejected, final balance 20.00. The synthetic fixture was removed; only tape and pat remain in auth.users. Their data/passwords were not used for testing.
- CI repeats migrations, role/RLS assertions, financial assertions, registration closure and a two-process concurrency harness on PostgreSQL 17 before deployment. The concurrency harness refuses non-stub auth.users schemas and runs only against the ephemeral CI database.

The new transaction-version FK index was added after the performance advisor identified it. Unused-index INFO findings are expected on lightly used tables. Supabase's known leaked-password protection setting remains disabled; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No paid feature was enabled.

Supabase CLI cannot write its required home directory in this environment (documented in M2). Migration files use the exact versions returned by remote apply_migration; no local CLI generation is claimed. Historical migrations are preserved, including the variable-qualification correction found by the financial edit test.

## Manual acceptance

1. Sign in, create a physical cash account if needed, and verify account balances after reload.
2. Add a real expense by amount/category only; check cash and monthly net spending. Category+envelope mapping is managed under Settings via your name in the header.
3. Create a personal envelope and choose rollover mode. Map a category to it. Set a monthly allocation; cash and spending must remain unchanged. Future expenses in the category reduce that envelope.
4. Transfer between two accounts. Each balance changes, while total cash and spending stay unchanged.
5. Open an expense → refund part of it. Cash rises and monthly net expense falls. A refund exceeding the original's remaining amount must fail without a partial write.
6. Edit a transaction or delete it; inspect history. Two tabs editing the same version must require reload on the stale tab.
7. Create a goal, earmark funds, then release them. Cash and expense stay unchanged; unallocated/spendable funds change. Attempting to spend earmarked account money should fail.
8. Review previous months if real historical data exists. No need to enter fabricated finances to test rollover; the SQL suite already covers historical scenarios.
9. Disconnect network during saving: no synced-success message before confirmation. Retry the unchanged form; do not create a second request manually after a reload without checking the ledger.
10. Check tape/pat private isolation and sign out on a shared device.

## Boundaries

M4 analytics/coaching and M5 family mutations are clearly marked, without invented figures. Debt-account operations, recurring-rule execution and settlements are not enabled in M3. Account names/opening balances and envelope rollover modes are fixed after creation in this milestone; correcting an erroneous baseline requires a reviewed operator update rather than mislabeling it as income. Negative physical balances/overdraft are rejected. PWA installation/offline caches, real CSV and backup flows remain M6. The production build still warns about bundle size (about 993 kB before gzip); optimization is outstanding.
