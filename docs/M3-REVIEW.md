# M3 revised: money log and monthly targets

This revision supersedes the earlier funded-envelope/rollover model following user review. M4 analytics and M5 family sharing remain separate milestones.

## Behavior

- One overall money log; no bank-account creation, selectors or transfer entry in the real UI. The existing accounts relation remains an internal ledger anchor with ownership integrity. Actual banks are managed outside MONEYSPACE. Historical records are preserved.
- Current money = opening amount + all income − all expenses + refunds. This is a recorded total, not a connected bank balance. Negative totals are allowed so truthful entries are never blocked by an inferred cash limit.
- Monthly budget targets are comparison thresholds. They never reserve or subtract money. A target can exceed the recorded total.
- Set a recurring target, e.g. Food and drink 6,000 THB, and select multiple reusable categories. New transactions automatically use their category's budget. Mapping changes apply to new entries; existing entries retain their recorded budget and can be edited individually with audit history.
- Every new calendar month starts at the recurring target. Neither unused nor overspent amounts carry. Opening a month repeatedly preserves recorded spending. Initialization happens in a server transaction on first access/write; no paid scheduler is needed.
- Editing the current month's target also changes the recurring default. Editing a historical month changes only that month's target. Creating a target always starts in the current month. Prior months keep their historical amounts; the migration preserves configured amounts, removes personal carry, and uses the latest configured amount as each existing target's recurring default.
- Remaining budget = monthly target − expenses + refunds recorded in that month. Over-budget entries still save and show an excess warning.
- Per-budget daily guide = max(remaining, 0) ÷ remaining calendar days including today, rounded down to a satang. It is not capped by recorded money. Historical months do not show a daily guide for today.
- Month summary shows income, net expenses and their difference. The difference is not automatically called savings. The overall money card is explicitly current, independent of the selected historical month.
- Savings earmarks remain part of total money and never count as consumption. New earmarks are checked against total money minus existing earmarks, independent of budgets. Actual expenses remain recordable even if the tracked total falls below earmarks. Monthly savings movement = earmarks created that month − earmarks released that month (Bangkok calendar dates), distinct from total earmarks and monthly surplus.
- Refunds reference an original expense, inherit category/budget, offset consumption, and cannot exceed the original total. Edit/delete use optimistic versions and append-only before/after history.
- RPC mutations serialize per owner and store request receipts atomically. An uncertain save response shows no success; retrying an identical pending request uses the same UUID. Another device's newer edit requires reload.
- Financial data stays in authenticated Supabase tables. Browser assets contain only public config. RLS and ownership checks remain active; no household financial writes are opened by this revision.

## Validation

Local commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npm run test:e2e`.

Vitest covers exact satang handling and inclusive calendar-day guides (including leap day, over-budget and historical months). Playwright covers mobile/desktop entry, no account picker, uncertain-response retry, budget edits that leave money/expenses unchanged, category reuse, auth and onboarding. Browser backend responses are mocked; SQL tests exercise real PostgreSQL operations.

`supabase/tests/financial.sql` uses rollback-only fixtures to check independent targets, multi-category mapping, monthly reset, refunds, goal earmarks, audit/edit/delete, stale versions, idempotency, precision, atomic rollback and cross-user isolation. Authorization tests remain in `authorization.sql`. CI-only concurrency tests assert both distinct expenses commit exactly, including a negative total, while identical simultaneous request IDs commit once. Never run bootstrap/concurrency fixture scripts on a real Supabase project.

The managed Supabase CLI cannot create its read-only home configuration directory in this workspace. Migration was applied with Supabase MCP and saved using its exact recorded version; it is reproducible in CI in lexical order.

Known existing limitations: demo charts remain illustrative M1 data, real advanced analytics M4, family operations M5, PWA/offline/CSV/backups M6. Build emits a bundle-size warning. Supabase's pre-existing leaked-password-protection warning remains; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No paid feature was enabled.

## Manual acceptance

1. Open the live site, refresh, and sign in as tape or pat. Verify no real bank account setup, account picker or transfer action appears.
2. Set Food and drink to 6,000 THB, check both อาหาร and เครื่องดื่ม, and save. Money total and expenses must not change.
3. Record 80 THB as อาหาร with no title. Remaining budget must be 5,920 THB and its daily guide must use days remaining including today. Record เครื่องดื่ม and verify it reduces the same budget.
4. Set a target above your recorded money total: it should save. Spend beyond a target: the entry should save and the budget show เกินงบ.
5. View a previous month. It must show that month's budget/spending without today's daily guide. Changing its target must not change the recurring default. First access next month should reset the budget to its saved default with no carry.
6. Add income and verify the money total and monthly income increase. Refund part of an expense and verify money increases and net expense decreases exactly once.
7. Earmark savings and release them. Money total and expenses stay unchanged; total earmarks and monthly savings movement change. This is separate from income minus expenses.
8. Edit/delete a transaction and inspect history. Switch users: private data must remain separate.
9. Disconnect network before saving. No success should appear before Supabase confirms. Reconnect and retry; a server-committed uncertain response must not create a duplicate within the same pending form session.

Stop after this revised M3 for user review before M4.
