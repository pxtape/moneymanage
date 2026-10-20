# Visual budgets and editable savings goals

Monthly budgets remain comparison targets, not reservations of cash. The planning donut totals monthly allocations only, with each pocket’s amount and percentage. Savings and actual consumption are not included in that total. Selecting a segment highlights its amount; select it again to restore the total.

Home now shows income alongside cash, expenses and earmarked savings. Each budget shows remaining / original target, remaining percentage, a bounded progress bar, consumption and daily allowance. Overspending is explicit; zero budgets avoid division by zero, and refunds may produce more than 100% remaining.

Savings goals support name, target amount and optional date changes. A target below the amount already saved is allowed and displays the actual percentage. Deleting a goal atomically releases all its active earmarks and soft-deletes the goal. It does not reduce cash, create an expense or move money at a bank. Contribution history retains the name recorded when it was created. Version checks reject stale edits/deletes after another session changes the goal or its contributions. Transfer-backed goals cannot be deleted through this operation.

The simple-plan button and its component were removed. Existing backend compatibility is retained. Progress rings, 25/50/75/100% checkpoints and three observable steps encourage use without ratings, invented streaks or judgment. Celebration appears only after the earmark is confirmed and the latest snapshot loads. Reduced-motion preferences are respected.

## Validation

- Lint, TypeScript and production build passed locally (existing bundle-size warning remains).
- 29 unit tests passed.
- 18 Playwright scenarios passed across mobile and desktop; the four affected financial/visual scenarios passed again after the final compact budget summary adjustment.
- The new rollback-only goal authorization/financial-integrity SQL suite passed against Supabase. CI runs it with the existing SQL suites.
- Migration: `20261020062340_editable_savings_goals_and_safe_release.sql`.

## Manual acceptance

1. Home: verify income and budget remaining/original amounts, percentages and daily allowances on a phone.
2. Budgets: verify the planned monthly total and allocation percentages; select a donut segment and select it again.
3. Rename a savings goal, change its target/date and reload. Existing saved funds should stay unchanged.
4. Add an earmark: progress should update after confirmation, with a celebration. Change the same goal in another tab and verify a stale edit requests fresh data.
5. Delete a goal after reading the confirmation. Earmarked savings should be released; cash and expense totals must stay unchanged. Contribution history must remain.
6. Check dark/light themes, desktop/mobile widths and reduced motion.

M6 offline/PWA, CSV, backups and full-history search remain outside this change.
