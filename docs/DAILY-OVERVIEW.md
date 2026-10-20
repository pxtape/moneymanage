> Later refinements to budget cadence, compact sections and data sufficiency are documented in [analytics and compact views](ANALYTICS-AND-COMPACT-VIEWS.md).

# Daily overview hierarchy revision

This revision addresses the user’s screenshot critique of four equal-weight, oversized statistic cards and a vertically stretched budget list.

- One primary number: **current recorded cash minus actual savings earmarks**. Its label is เงินหลังแยกออม, not a claim that all of it is free to spend. Pending bills/unrecorded costs are explicitly excluded. Current total cash and earmarks remain visible as supporting amounts.
- Received income and net expenses share a compact selected-month panel with the full Thai month/year. Current balance and selected-month activity are visually separated. The negative income-minus-expense statistic is removed from Home rather than suggesting it represents liquidity.
- Pockets use a responsive auto-fit grid on desktop and one column on phones. They show original target, remaining amount/percentage, net spending and the allowance through month end. Overspent/low/steady pockets appear before comfortable pockets; equal-priority order is stable. Colors stay tied to the original envelope order, not its urgency position.
- Home’s redundant create-goal toolbar action is removed; goal creation remains in the savings section and on Monthly Budgets. Mobile summary padding is reduced to bring budgets closer to the first screen.
- Secondary text contrast is increased in both themes. Unnecessary English headings, the Supabase header badge, milestone footer label and income-dot decoration are removed from the real overview. Existing confirmation notices still identify confirmed writes.
- Monthly planning remains the last Home section. Transactions, goals, categories, analytics, theme preferences and financial rules remain intact. No schema, authentication or new financial write was introduced.

## Verification

Lint, TypeScript, build, 34 unit tests and all 20 mobile/desktop browser scenarios passed. After the final responsive-grid refinement, the four affected monthly-plan/overview and savings-goal scenarios passed again. Screenshots were inspected at 1873×891 (matching the user image) and 390×844, in dark/light themes. Capture waits for dialog overlays to unmount and returns to the page top. The existing bundle-size warning remains.

## Manual acceptance

1. Reload Home: the prominent amount should equal total cash minus earmarks. Check the supporting equation against saved data.
2. Choose a historical month: its income/expense panel must show that month, while the primary amount stays explicitly current.
3. On desktop, inspect several pocket cards together. With fewer pockets they should fill available columns; on mobile they should stack without horizontal overflow.
4. Check an overspent or low-budget pocket is prioritized and still shows its true target and remaining amount.
5. Verify recent entries, savings actions and the monthly plan at the bottom remain accessible. No plan or budget edit should change current money automatically.

Offline/PWA completion, CSV/backups and full-history search remain deferred, as documented in the accepted scope.
