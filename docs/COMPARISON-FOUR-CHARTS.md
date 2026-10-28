# Four comparison charts: 2026-10-28

This supersedes the chart order and sharing scope in the earlier comparison release. Existing finance entries and historical category snapshots are unchanged.

The Compare screen now follows the requested order:

1. **Last seven days:** grouped Tape/Pat bars, ending today in Bangkok (today included), independent of the month selector. The server generates seven dates even when the interval crosses a month/year boundary. Net expenses subtract refunds on their actual refund date.
2. **Monthly cumulative expenses:** Tape and Pat lines in the same plot, from selected month start to today or the historical month end. The common daily range and linear lines preserve the actual sequence, including downward refund steps.
3. **Monthly category totals:** each person's own historical category names shown in adjacent horizontal bar charts (stacked on narrow mobile screens). Both use the same numeric axis domain. Categories need not match between users; the app never invents a food/drink split from combined entries. Full category names and amounts are available in an expandable list. Renamed/deleted categories retain their recorded historical labels. Negative refund totals are retained.
4. **Current total money:** two bars for current personal cash balances, including money earmarked for savings. Contributions are not added again. This is current tracked money regardless of selected historical month; it is not a full assets-minus-liabilities net worth calculation for unrecorded property/debt. The UI labels this limit explicitly.

All aggregates read every relevant row, not the 100-row ledger preview. Amounts remain NUMERIC on the server and decimal strings in JSON, converted to safe integer satang for chart calculations; axis ticks and tooltips display baht.

## Extra sharing scope

The original reciprocal expense-summary consent remains unchanged. Category names and total cash broaden that scope, so `details_a/details_b` start **false** independently of prior consent. Each account can use **Share my categories and total money** in chart 3. Both original summary sharing and both extra permissions must be enabled before categories or money are returned. If either extra permission is withdrawn, those fields disappear from future responses while the original expense graphs remain available. Basic sharing withdrawal still hides every comparison aggregate.

The new consent function accepts no target user or pair ID, checks `auth.uid()` membership, locks/version-checks the existing private pair, and is audited. Uncertain-response retries of the same applied state are harmless. Anonymous/outsider access and direct private table access remain denied. No raw transaction, merchant, note, account ID or separate income is shared.

## Validation

Lint, typecheck, production build and **52 unit tests** passed. All **26 mobile/desktop Playwright cases** passed; the four comparison/theme/reminder cases were rerun after the final shared-axis fix. Browser workflows use mocked API data. **13 SQL rollback suites and 3 concurrency scenarios** passed on disposable PostgreSQL 17. New checks cover independent category names, refunds, seven dates, historical month vs current money/rolling window, no savings double count, reciprocal extra sharing, revocation and anonymous/outsider denial.

Migration `20261028060919_comparison_four_charts_and_explicit_details_consent` applied successfully. Read-only live checks confirmed extra sharing starts off and anonymous/direct access is denied; no financial test records were inserted into the live project. The existing [Auth leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and Vite initial-bundle size warning remain unchanged.

## Manual acceptance

- Open Compare and check chart order is last seven days → monthly cumulative → category totals → current total money.
- Change the month: monthly lines/categories change, while the seven-day window and current money remain explicitly current.
- Enable extra sharing from Tape only: charts 3/4 stay locked. Enable from Pat too: category bars and current money appear. Withdraw from either account and reload the other: fields/charts disappear.
- Verify a combined food/drink category stays combined, while separately recorded categories stay separate. Check both category plots use the same money scale.
- Compare current total money to Home's total cash, including existing savings. Earmarking additional savings must not increase this bar.
- Check mobile layout, full-name category list, refund days, long category lists, and a seven-day interval crossing month end.
