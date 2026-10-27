# Pat × Tape: graphs, themes and in-app reminders

## Current screen flow

Home remains focused on real money, budgets, recent entries and savings; the monthly forecast stays last. The cancelled recurring bill list, after-bills estimate and amount/category expense shortcuts are removed. Existing actual expenses, payment receipts and audit history are preserved. Old bill/template write commands now return `FEATURE_REMOVED`; their public read functions and table reads are revoked from client roles. Historical migrations stay immutable; cancelled-feature client code and its obsolete tests are removed. Reusable category pins are unchanged.

A new **Compare** tab sits beside Insights on desktop and in mobile navigation. It emphasizes the daily grouped bar chart first, then per-person context, weekly bars, cumulative spending lines, food/drink/other comparison, and daily trend areas. A text table provides exact accessible values. Daily, food and drink filters update comparable metrics. Blue always identifies Tape; pink identifies Pat, independently of the chosen theme.

## Shared summaries, private transactions

- Only the pre-provisioned Tape/Pat pair exists. Account IDs cannot be supplied by the client; no discovery or arbitrary-user comparison API is available.
- Each account explicitly enables its own summary sharing. Both must be enabled before any aggregates are returned. Disable stops future reads for both sides; the screen reloads on focus and polls every 30 seconds while visible. Previously viewed data cannot be recalled from someone who has already seen it.
- Shared fields: date, net expense, food/drink net expense, counts of expense purchases by group, and refund count. No merchant, notes, transaction/account IDs, income, cash, budgets or savings are returned.
- The pair lives in a private RLS table with revoked client grants and an explicit deny policy. Narrow private `SECURITY DEFINER` routines check membership and mutual consent before aggregating; public RPC wrappers are invokers and deny anonymous access. Raw transaction RLS is unchanged. Consent changes are audited and versioned; retrying an already applied state is harmless. A stale enable cannot undo a subsequent disable.
- Both accounts start with sharing **off**. Enable from each account's Compare tab to see the shared graphs.

## Financial and chart rules

All database money uses NUMERIC; JSON amounts are decimal strings, converted to integer satang and checked for safe totals before client chart arithmetic. Chart axes and tooltips display baht. Expense refunds subtract on their recorded refund date; negative totals are valid. Income, transfers, settlements, budget allocations, savings earmarks, deleted entries and household-scoped entries are excluded.

The server aggregates every eligible transaction, including entries beyond the 100-row ledger preview. Food/drink uses the transaction's historical spending-group snapshot. Current months stop at today in Bangkok; historical months include their whole calendar month. Both users always use the same dates. Weeks run Monday–Sunday and are clipped at the selected range; no future zeros or unnormalized monthly growth percentages are invented. Calendar averages divide by elapsed calendar days; spending-day averages use purchase days for the selected metric. Zero-record days do not prove zero actual spending. No rankings, judgmental scores or claims of completeness are shown.

## Themes

Light is the default for a fresh/unconfigured device, including login, onboarding and dialogs. Settings offers **Light, Pink, Dark** with previews; the existing quick light/dark toggle remains. A previously selected dark or pink theme is respected. The preference persists on the device and synchronizes across its tabs; a local storage failure is shown as a temporary change. The early HTML theme initializer avoids a dark splash before the app loads. Pink changes app surfaces, accents and dialogs while preserving chart identities and readable contrast.

## Reminders

The bell is an **in-app** reminder center, not OS push. It does not send email, run in the background or notify when the app is closed. In Settings, configure or disable:

- Daily invitation to log expenses: default 20:00 Bangkok, shown after that time only when a server aggregate confirms no expense is logged today. If the check fails, the app says it cannot check and offers retry; it does not tell the user to enter a duplicate.
- Current-month budgets at/below 20% remaining or overspent; historical-month balances do not become current alerts.
- Weekly review on the chosen weekday, linking to comparison graphs.

Dismissals last for the current Bangkok day on that device/account. Preferences are device-local; opening the app after the configured time makes eligible reminders visible. This is not a promise of scheduled background delivery.

## Validation (2026-10-26 UTC)

Lint, TypeScript, production build and 50 unit tests passed. All 26 Playwright mobile/desktop cases passed, with the four new comparison/theme/reminder cases rerun after final graph-order/palette polish. Browser tests use mocked Supabase responses. Twelve rollback SQL suites and three concurrent-write scenarios passed on disposable PostgreSQL 17. The comparison SQL suite covers reciprocal consent, revocation, outsider/anonymous denial, raw RLS, all-row aggregation, refunds, grouped counts, private-field exclusion, retirement and reminder isolation.

Migrations `20261026175502` and `20261026175547` were applied successfully to the dedicated project. Read-only live checks confirmed one approved pair, sharing off for both members, no raw pair grants, no anonymous comparison and no client access to retired bill endpoints. No financial test entries were inserted in the live project. Supabase's security advisor retains only the pre-existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Vite retains its existing large initial-bundle warning.

## Manual acceptance

1. Open on a device without a saved theme: light should appear from login onward. Select Pink in Settings; refresh and open an expense dialog. Both should remain pink. Switch to Dark/Light and check readability.
2. Confirm Home/Budgets contain no recurring bill manager, amount favorites or after-bills estimate; prior real expenses remain unchanged.
3. Sign in as Tape and enable summary sharing in Compare. Graphs remain locked until Pat enables sharing from Pat's own login. Check both views display the same date range and values.
4. Compare daily/weekly/cumulative graphs with a known expense and refund. Change Food/Drink filters; verify metric-specific purchase-day averages. Check a historical month and a partial current month.
5. Stop sharing from one account. Reload/focus the other account; graph data should disappear. Verify the other person's raw transaction list, merchant and balances are never accessible.
6. Set an in-app reminder time earlier than now with no expense logged today; check the bell. Dismiss it, refresh and verify dismissal persists for the day. Change/disable reminder settings and refresh. No notification is expected while the app is closed.
7. Disconnect while loading comparison or confirming consent; the app must not claim an unconfirmed change or retain stale peer graphs after a failed read.

PWA/push delivery, CSV/backups and full-history search remain outside this release.
