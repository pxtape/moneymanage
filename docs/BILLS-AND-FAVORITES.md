# Monthly bills and expense favorites

Recurring bills are estimates, separate from expense budgets and actual transactions. Defining a bill creates no expense, reserve, or savings entry. This is an in-app due-date list, with no bank connection, automatic payment or background notification.

## Bill flow

- Budgets → Bills → Set bill: name, estimated amount, category, optional pocket, monthly due day and first month. Days 29–31 clamp to the last day of shorter months, preserving the original day for the next month.
- Home shows the next three unpaid bills, including earlier unpaid cycles. Its current-money hero separately estimates **money after savings minus unpaid bills**, regardless of the selected historical month. This estimate includes only configured bills; it is not a guarantee that other costs have been covered.
- Confirm payment offers **not recorded yet** (review actual amount/date, then create one expense) or **already recorded** (link an existing expense, changing no cash/expense total). Candidates are the latest 50 unlinked personal expenses with the same account/category, from the bill-cycle start through today. Load failure never falls back to creating a new expense.
- One live payment is allowed per bill/month and per expense. The locked financial writer, unique indexes, and idempotent receipts prevent concurrent or retried payments from duplicating expenses. A stale bill or existing expense requires refreshing before retrying.
- Paid bills retain their name, due date and expected amount as snapshots; actual amount follows the linked expense. Definition edits affect unpaid/future cycles only. Stop removes unpaid/future cycles; existing paid history and real expenses remain.
- Paid bill → View entry opens normal edit/delete/refund/audit actions, including expenses older than the 100-entry ledger preview. Deleting a linked expense atomically voids its payment and reopens that cycle if the bill is still active. A refund keeps the bill paid and uses existing refund accounting. Deleting an expense with refunds still requires removing refunds first.
- For a bill already paid before the starting balance was recorded, start the schedule in the next unpaid month. Do not create a second expense for it.
- Limits: 50 bill definitions; new/edited first month is within 11 months before through 24 months after the current month. Monthly recurrence only. `next_due` is legacy metadata; generated schedule + payment receipts are authoritative for this feature.

## Favorites

Home offers reusable shortcuts containing name, amount and category. Tapping one opens the ordinary expense form with amount/category prefilled. Nothing is written until explicit Save; amount/details remain editable. Settings offers rename, change amount/category and delete. Removing a shortcut never rewrites past transactions. Archived categories disable the shortcut until edited. Current category defaults determine new envelope/tag values. Limit: 24 shortcuts.

## Data and security

Migration adds opt-in bill fields to `recurring_rules`, `bill_payments`, and `expense_templates`, with NUMERIC amounts, composite ownership FKs, indexes, RLS and audited writes. No legacy rules are converted. Direct client writes are revoked; changes use `moneyspace_write` with its existing owner lock, request receipts and transaction protections. Snapshot money + bill estimates come from one database statement; no success state is shown before confirmed server response. A confirmed write followed by refresh failure explicitly requests reloading.

## Validation and manual acceptance

Automated: integer amount/due-date tests; local PostgreSQL authorization, versioning, rollback, history and concurrent-payment tests; Playwright mobile/desktop workflows with API mocks. Mocked browser tests do not demonstrate a real user's end-to-end server session. No financial test entries are inserted into the live project.

1. Set a 500-baht bill; cash and monthly expenses stay unchanged. Check the current-money estimate decreases by 500.
2. Pay it at 499.99; cash drops only 499.99, pending disappears, monthly expense is 499.99. Refresh and check persistence.
3. For an already logged expense, choose Already recorded and link it; actual cash/expenses must remain unchanged. A duplicate confirmation must not add another expense.
4. Rename/stop a paid bill; its historical paid name and expense remain. Delete the linked expense and verify its active bill cycle becomes unpaid again; refund first if required by the existing guard.
5. Test day 31 in February; inspect due dates and a future first month.
6. Add a favorite, tap then cancel: no expense. Tap again, change amount, save: one expense. Edit/delete favorite in Settings; historical expenses do not change.
7. Check Tape and Pat cannot see or edit each other's bills, receipts or favorites. Disconnect during save; no unconfirmed success should appear.

Unchanged remaining scope: PWA/offline writes, CSV/backups and full-history search are not delivered by this addition.

## Release checks (2026-10-26 UTC)

- Lint, TypeScript and production build passed; Vite retains the existing large initial-bundle warning.
- 48 unit tests passed; 26 distinct Playwright mobile/desktop cases passed (24 regression cases plus two additional link/read-retry cases).
- Twelve rollback SQL suites passed on disposable PostgreSQL 17, including all migrations from a fresh database; four concurrency scenarios passed.
- Supabase migration `20261026172401_recurring_bills_and_expense_templates` applied successfully. Security advisor reports no new table/RLS finding. Existing Auth warning remains: [leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No authentication setting or password was changed in this release.
- Performance advisor reports informational unused-index notices, including new FK-supporting indexes; retained for relational integrity and future usage.
