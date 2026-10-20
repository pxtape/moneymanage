> Retired at user request. The payday UI and write actions are removed; existing income history is retained. See [monthly cashflow planning](MONTHLY-CASHFLOW-PLAN.md) for the replacement. The remainder records the earlier implementation.

# Optional regular salary planning

Enable from Home → ตั้งรายได้ประจำ, or Settings → ตั้งรายได้ประจำ. Enter net monthly pay and a payday (1–31). The option is private to each user and disabled until configured; switching it off preserves the configuration and recorded income.

## Money and calendar rules

- Expected salary is a forecast, never included in cash, actual income, savings or budget allocations.
- Home shows current spendable money (current recorded cash minus earmarked savings), the scheduled payday and days remaining. The daily estimate divides non-negative current spendable satang by calendar days before payday, including today and excluding payday. It excludes expected income and does not reserve upcoming bills or unrecorded expenses. When due/overdue, no misleading daily estimate is shown.
- Payday 29–31 is clamped to the last day of shorter months, including leap years. No automatic weekend/holiday adjustment. An early actual receipt in the same calendar month can be confirmed using ได้รับแล้วก่อนกำหนด. Actual date and actual net amount can differ from the forecast.
- Confirmation creates one ordinary income transaction atomically with a cycle receipt. Only confirmed writes update the UI. Repeated requests use the same idempotency key; different keys for the same user/calendar-month cycle cannot create another salary. Profile locking serializes simultaneous requests.
- After confirmation, the next expected payday is shown. Changing payday, disabling/re-enabling or deleting the income transaction never reopens the paid cycle. Income edits/deletes use the normal transaction flow and audit history. If a deleted salary needs recording again, use ordinary income deliberately.
- Current UI confirms the current calendar-month cycle; it does not auto-create arrears for missed months. Server validation rejects future actual receipt dates and invalid schedule dates, and limits historical cycles to the preceding 11 months plus current month.
- This schedule follows the current date in Asia/Bangkok even when browsing an old budget month. Monthly budget pockets still reset on day 1 and never require salary funding.
- If salary is already in the opening balance or was recorded with ordinary Income, do not confirm it again. The confirmation explicitly warns about this. No bank integration can infer that two independently entered income records represent the same payment.

## Database and access

`salary_plans` and `salary_payments` have UUID keys, timestamps, constraints, ownership indexes, RLS, authenticated owner-only SELECT and no client mutation grants. All changes use the existing private transactional writer through the invoker RPC. Settings edits require their observed version; audit events retain change metadata. Payment records reference the same owner’s transaction and have a unique owner/calendar-month constraint. Amounts remain NUMERIC(16,2) and client satang integers.

Migrations applied to dedicated MONEYSPACE Supabase:

- `20261020064622_regular_salary_planning.sql`
- `20261020065107_allow_early_salary_receipts_in_current_cycle.sql`

The CLI could not create its state directory on this managed environment’s read-only home. Migrations were applied through the connected Supabase migration tool and saved under the exact versions returned by its migration history.

## Validation and review

Lint, TypeScript, build, 34 unit tests and 20 mobile/desktop Playwright scenarios passed. Rollback-only live Supabase tests check forecast/actual separation, exact decimals, early receipt, same-key retry, different-key duplication, changed payday, disable/re-enable, stale settings, deleted income and private/anonymous access. CI also runs simultaneous different-key salary confirmations and all earlier authorization/finance SQL suites before deployment. The production build retains its existing bundle-size warning.

Security advisors found no new schema issue. The pre-existing [leaked password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; unused indexes on earlier family foundation tables remain informational.

Manual acceptance:

1. Set salary to ฿30,000 with payday 25. Before confirmation, cash and actual income must not change.
2. Check current spendable money and daily estimate. It should not include the expected ฿30,000 or change budget amounts.
3. When salary is really received, confirm the actual amount/date once. Verify income and cash rise together, with the next payday displayed. Do not test by entering fictitious income into real finances.
4. Reload, edit payday, switch the option off/on: the paid cycle must remain closed and cash unchanged.
5. Try payday 31, light/dark themes and a mobile screen. A short month should show its last day.

M6 PWA/offline, CSV, backups and full-history search remain pending.
