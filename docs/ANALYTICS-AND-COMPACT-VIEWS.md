# Recorded-data context and compact views

This release addresses the second screenshot review across budgets, transactions, goals, monthly planning and analytics.

## Budget cadence

Each envelope now has owner-editable `spending_cadence`: `daily`, `bill` or `flexible`. Set it in Monthly Budgets → edit a pocket → วิธีใช้กระเป๋า. Existing pockets stay neutral/flexible until their owner chooses a type; there is no automatic reclassification. Only daily pockets with a positive target get a remaining-per-day allowance. Bills and occasional spending never get that allowance. An unset target shows an edit prompt rather than ฿0/day or an overspending classification.

Changing cadence is metadata only. Allocation amounts, cash, consumption, savings and recorded category/Need-Want history are unchanged. The snapshot exposes cadence and analytics facts now include their recorded envelope ID so any projection uses activity linked to that pocket, not the current category mapping.

## Data sufficiency and interpretation

The analytics opening emphasizes recorded net spending, distinct spending days, transaction count and actual earmark change. It explicitly says that no record does not prove zero consumption. The raw calendar averages, spending-day averages and income-difference rate remain available in a disclosure; the rate is not presented as actual savings or liquidity.

Food/drink cards emphasize observed totals and purchase days. Their two averaging definitions are in details. Daily spending is a literal bar chart, without a curve implying gradual growth. Gross category shares remain descriptive and never imply frequency.

Display gates are conservative minimums, not statistical confidence or proof of complete records:

- General context: at least 7 distinct expense days spread across at least 14 calendar days.
- Weekday chart: at least 14 expense days across a span of at least 28 days.
- Six-month trend chart: at least 2 months meeting the 7-day/14-day minimum. Months without expense observations leave gaps, not zero bars. Raw month totals stay accessible.
- Partial-month comparison: both equivalent windows meet the 7-day/14-day minimum and a nonzero prior base exists.
- Pocket projection: current month, daily cadence, positive target, and at least 7 expense days across 14 days **linked to that envelope**. Bills/occasional/unlinked/sparse activity never gets extrapolated. The conditional estimate still assumes the recorded pace continues and may be inaccurate when entries are incomplete.

Emergency coaching reports current earmarks against the user’s stated target. It no longer invents months of coverage from thin or incomplete expense records. Recorded overspending remains visible when a positive budget is actually exceeded.

## Reading density

Recent transactions are grouped by date, with shorter rows and no duplicated merchant/category name. On desktop, recent activity and compact savings sit side by side with independent heights. Goals show saved/target/percent, a bar, remaining amount and actions; oversized rings/checkpoints are removed. A single goal no longer leaves a half-empty outer card.

Home’s monthly plan remains last and uses smaller summary cards with source/pocket details collapsed. Monthly Budgets keeps the full details accessible. Analytics grid cards align at the top instead of inheriting their neighbor’s height; sparse-data messages use compact panels instead of almost-empty charts. Technical coaching copy and decorative English headings were removed from these sections.

## Validation and rollout

Lint, typecheck, 39 unit tests and the complete 20-case mobile/desktop browser suite passed. The four affected overview/analytics cases passed again after final zero-target presentation refinements. Browser tests exercise sparse and established datasets, show/hide gates, calendar versus purchase-day averages, daily versus bill editing/persistence, zero targets, private finance flows and compact-plan access. Existing bundle-size warning remains.

A separate disposable PostgreSQL 17 instance applied every historical migration plus this migration, then passed all 10 SQL suites and all 3 concurrency checks. Live rollback-only cadence tests passed after application. Amounts, snapshots, older callers, invalid cadence and cross-user access are covered.

Automatic review initially rejected the rollout while a legacy daily-average test still failed and the proposed migration classified existing pockets automatically. That proposal was revised to preserve all existing pockets as neutral, the test was extended to explicitly cover daily and bill flows, and all checks above passed before the revised migration was approved and applied. No alternative path was used to apply the rejected proposal.

Migration: `20261020113200_spending_cadence_and_observation_context.sql`. The CLI migration command was attempted but still cannot create its state directory in this environment’s read-only home; the migration tool’s exact recorded version was used. No RLS grants were broadened. The pre-existing [leaked password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; no new security advisor issue.

## Manual acceptance

1. Edit food/travel to daily and utilities/rent to bill; reload. Only positive daily pockets should show a daily allowance.
2. A zero-target pocket should offer to set a limit and never show ฿0/day.
3. Check Home’s grouped recent entries, compact goals and collapsed plan details; verify all edit/save actions still work.
4. With one day of expense records, confirm the context warning and absence of weekday/trend/projection conclusions. Open average details to inspect denominators explicitly.
5. With sufficiently distributed records, check charts/comparisons appear. Confirm bills never receive linear projections.
6. Emergency coaching should show saved/target amounts, without claiming how many months an incomplete history supports.

Original M6 offline/PWA, CSV/backups and full-history search remain deferred.
