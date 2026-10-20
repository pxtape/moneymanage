# M4: real analytics and deterministic coaching

Delivered with the requested M3 budget-management fix. M5 family operations and M6 PWA/CSV remain separate review milestones.

## Budget management

Open งบรายเดือน → แก้งบ to rename, edit the monthly target or choose categories. ลบงบนี้ opens a separate confirmation. Deletion soft-deletes the budget and unlinks categories for future entries. Existing expenses/refunds, amounts, allocation rows and audit metadata remain intact; the deleted budget is hidden in historical views and no longer initializes future months. No expense or money total changes merely because a budget was renamed/deleted.

Current-month target changes set the recurring default; historical target edits remain month-specific. A rename and category mappings apply to the budget globally, including its historical label. Updates/deletions from the new UI check the budget's server version. Older clients without a version retain the prior allocation API for compatibility; ownership checks always apply. Uncertain responses never show confirmed success.

## Analytics

The authenticated, SECURITY INVOKER `moneyspace_analytics` RPC groups **all** live personal income/expense/refund rows in the selected month and preceding five months. It uses indexed owner/date predicates, excludes shared rows/transfers/settlements, respects RLS, and returns NUMERIC sums as decimal strings. The ledger's 100-row preview does not limit analytics. Refunds inherit the original expense's needs/wants tag and reduce spending in the month received.

- Daily net spending, calendar-day average, spending-day average and expense frequency. Calendar averages use elapsed days including today for the current month and all days for historical months. Spending-day denominators count distinct expense dates; refund-only dates do not add purchase days.
- Food/drink averages show both denominators explicitly. The documented automatic grouping matches category names containing อาหาร, เครื่องดื่ม, กาแฟ, food, drink or coffee. Custom category names outside those terms are not included.
- Weekday averages divide net spending by the number of occurrences of that weekday in the observed calendar window, including zero-spending days. Expense counts are shown alongside.
- Six-month trends chart net daily averages, with income, net expenses and net savings earmarks shown in the table. Current-month totals are marked partial; missing records are not asserted to mean no real-world spending.
- Partial-month comparison uses days 1–N in each month, shortening the previous window if it has fewer days, and compares each window's daily average. No percentage is fabricated without a positive previous spending baseline.
- Category distribution uses gross expenses to avoid negative pie segments; both gross and refund-adjusted net values are shown. Needs/wants uses signed net spending, with an unknown bucket if needed.
- Budget burn, overspent amounts and projected month-end spending. Projection = max(net spend, 0) ÷ elapsed calendar days × days in month. It appears only after at least seven elapsed days and three expenses overall; large early bills can distort it. Historical months show actual results without forward warnings.
- Surplus/savings rate = (income − net expenses) ÷ income, undefined if income is zero. It is labeled as money left from income, not proof of actual saving. Net earmarks and current goal progress are separate. Earmarks/releases never count as consumption.

Amounts use integer satang after exact decimal-string parsing. Unsupported aggregate magnitudes produce a visible error rather than an imprecise financial result. Chart coordinates use baht for presentation.

## Coaching rules

Explainable Thai suggestions cover pay-yourself-first after income without positive net earmarks, missing/emergency goal review, actual overspending, projected overspending, largest-category review, and weekly review. No external AI API, judgmental score, or paid scheduler. Emergency coverage estimates use the selected month's tagged necessary spending pace and current earmarked goal amount, clearly labeled; insufficient data suppresses the estimate. Historical months are reviewed retrospectively, while goal balances are explicitly current.

## Validation

- Lint, TypeScript and production build.
- 21 Vitest assertions/tests across five files, including refund accounting, gross versus net, both day denominators, normalized partial periods, short February, historical months, weekday exposure, undefined rates, savings separation and coaching thresholds.
- 14 Playwright scenarios across mobile and desktop, including rename/delete with unchanged ledger totals, real analytics loading/retry, averages, warning cards, chart rendering, and no horizontal overflow. Browser backend responses are mocked.
- `supabase/tests/analytics.sql` passed against live Supabase using rollback-only synthetic fixtures: rename, optimistic versions, soft deletion/audit preservation, 125 expenses beyond the 100-row preview, refund tag lineage, RLS isolation, a known foreign budget ID with its correct version, and anonymous denial.
- GitHub Actions replays all migrations and runs authorization, financial, analytics and concurrency SQL tests before deployment. No real passwords are used in tests; no synthetic users or transactions are retained.

Existing limits: original demo charts are illustrative; six-month analytics queries require a connection; installable/offline behavior is M6. Build still reports a large main bundle. Supabase's existing leaked-password-protection warning remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No paid feature was enabled.

## Manual acceptance

1. Refresh the live site and sign in. งบรายเดือน → แก้งบ: change the name, amount and selected categories, save, and refresh. Confirm they persist and money/expense totals do not change from editing the budget itself.
2. In แก้งบ choose ลบงบนี้. Cancel once; it should remain. Reopen and confirm deletion; it disappears while prior expenses and history remain. Future expenses in previously linked categories no longer use that budget.
3. Open ข้อมูลเชิงลึก. Record expenses on different dates and verify calendar-day averages differ from spending-day averages. Record a refund and verify net expense falls while gross category distribution remains unchanged.
4. Compare the current month with a previous month: periods and denominators must be explicit. Change the selected month; charts and summaries should refresh. Historical months should have no current-day budget projection.
5. Add income and earmark savings: inspect surplus rate, net earmark movement and current goal progress separately. Earmarking must not increase expenses.
6. Exceed a budget: the expense still saves, budget warnings appear and actual totals remain exact. Projection appears only when its minimum observation thresholds are met.
7. Disconnect before opening analytics: it should show an error and retry, never sample data masquerading as real. Reconnect and retry.
8. Switch between tape and pat; private analytics and budgets remain separate. Check both mobile and desktop themes.

Stop after M4 for review before beginning M5.
