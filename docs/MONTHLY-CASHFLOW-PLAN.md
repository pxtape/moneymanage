# Beginning-of-month cashflow planning

Both Home and Monthly Budgets now lead with the same monthly blueprint:

**Expected income − planned expense pockets − intended monthly saving = planned reserve.**

For example, ฿30,000 expected income, ฿20,000 budgeted spending and ฿5,000 intended saving leave ฿5,000 as a contingency reserve. If spending plus saving exceeds expected income, the interface shows the deficit explicitly instead of a positive reserve. A stacked bar and percentage labels show the planned balance; a deficit means committed percentages may exceed 100%.

## Behavior

- Add, rename, change or remove up to 20 expected income sources (salary, side work, etc.). Zero is allowed; empty or invalid amounts are rejected. Source amounts remain decimal strings and DB NUMERIC values.
- Expense targets come directly from the selected month’s existing envelopes. They are not entered twice, and the calculation uses original targets rather than remaining balances. Existing category mappings, budget edits and the planned-expense donut still work.
- Monthly saving intent is distinct from cumulative goal targets and actual earmarked savings. Saving a blueprint never creates income, consumption, transfers or earmarks.
- A planned reserve is conditional on receiving forecast income and following the plan. It is not current cash or a guaranteed emergency fund. Current recorded cash, actual income/expenses and earmarked savings remain visible separately below the plan.
- Each month has its own income/saving plan. An unset plan shows unset values, not a fabricated zero-income forecast. Opening a new month does not silently inherit a forecast; the form offers explicit copying from the latest earlier saved plan. Expense budgets continue their existing monthly reset/default behavior.
- Saves require Supabase confirmation, use idempotent retry keys and reject stale versions. Editing one month does not overwrite another month. Plan edits have audit metadata.
- The payday countdown, regular salary setting and salary-confirmation UI were removed. Their mutation actions now reject new operations. Historical salary records and any already recorded actual income are preserved; legacy salary tables no longer have client SELECT grants.

## Persistence and security

`monthly_cashflow_plans` uses a UUID primary key, ownership FK, unique owner/month key (also supporting owner-scoped reads), timestamps, JSON source list and NUMERIC(16,2) saving target. RLS permits only owner SELECT; direct client INSERT/UPDATE/DELETE is denied. Writes run through the established private transaction writer after auth.uid(), onboarding and profile-lock checks. No service key is added to the browser. Snapshot reads use the existing invoker function.

Migration: `20261020070930_monthly_cashflow_plan_replaces_payday.sql`. The managed environment’s CLI still cannot create its state directory in the read-only home; migration generation was attempted, and the connected migration tool’s returned version was saved verbatim. The complete schema plus rollback tests were verified before applying the migration.

## Verification

- Lint, typecheck and production build passed. The existing bundle-size warning remains.
- 34 unit tests and 20 Playwright mobile/desktop scenarios passed.
- Rollback-only SQL tests cover exact forecast decimals, unchanged cash/actual income/expenses/savings/budgets, empty/deficit plans, stale versions, idempotency, source validation, independent months, foreign/anonymous access and retired salary actions.
- CI runs all prior SQL authorization/finance suites and concurrent monthly edits (one succeeds, the stale edit fails; actual balances and transaction count stay unchanged) before deployment.
- No new schema security finding. The existing [leaked password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains.

## Manual acceptance

1. On Home, choose เริ่มวางแผนเดือนนี้. Add multiple income sources and a monthly saving target; verify the preview and save.
2. Check income source names, planned expense pocket names, totals and reserve in both Home and Monthly Budgets. Actual cash/income must stay unchanged.
3. Edit an expense pocket: its revised target should immediately affect the blueprint reserve. Spending against it must not change the original planned expense total.
4. Rename/remove an income source or reduce expected income below spending plus saving. Verify the deficit warning and unchanged real finances.
5. Switch months and reload: plans should remain separate. For an unset later month, explicitly copy the latest earlier plan if desired.
6. Check mobile, desktop, dark/light themes, and confirm that no payday option appears in Settings or Home.

M6 offline/PWA, CSV, backups and full-history search remain pending.
