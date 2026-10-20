# Personal finance completeness review

Scope follows the latest five user requirements. Family spaces were canceled; no M5 migration or sharing API was deployed. This release refines the personal M4 experience and does not claim completion of M6.

| User need | Implemented behavior |
| --- | --- |
| Plan expense pockets from the beginning | วางแผนแบบง่าย offers Food, Drinks, Optional purchases, Utilities and Phone. Fill only desired monthly amounts. Blank rows are skipped. Existing pockets and category mappings are preserved; no balance funding requirement. Custom pockets/categories remain available. |
| Monthly used and remaining | Pocket cards show monthly target, net spent, remaining/excess and current-month per-day guide. Monthly targets reset automatically; savings accumulate separately. All home pockets are visible instead of only the first four. |
| Savings accumulation | Home shows current goal progress and direct earmark actions. Creating a target saves zero actual money; earmarking is separate, never consumption. Existing savings and actual current money remain distinct. |
| Daily expense / food / drink analysis | Separate food and drink totals, today's spending (current month), calendar-day averages, purchase-day averages and transaction counts. Daily chart/table show overall, food and drink amounts separately. |
| Spending behavior | Category gross/net shares and daily averages, expense frequency, weekday exposure, six-month daily-normalized trends, comparable partial months, needs/wants, budget burn/projections, surplus rate and actual earmarks. No fabricated comparison if the baseline is missing. |
| Support healthy money habits | General financial-literacy rules: pay yourself first, emergency fund guidance, review large categories, early budget warnings and weekly reviews. Suggestions have direct actions to enter expenses, review pockets or open the appropriate savings form. No judgmental score or paid AI API. |
| Simple everyday use | Amount + category entry remains the primary flow. No physical account management or family menu. One optional planning form handles the common pockets and a savings target. Desktop/mobile themes retained. |

## Corrections made during review

1. Food and drinks previously appeared primarily as a combined average. They now have independent recorded classifications (`food`, `drink`, `other`) and independent analysis. Category names can change without reclassifying historical spending. New refunds copy their original expense's group.
2. Planning previously required creating one pocket at a time. `setup_plan` now saves the selected pockets, category mappings and optional accumulation target in one transaction. It refuses existing names/mapped categories and rolls back all earlier rows if any item fails. No arbitrary amounts are seeded into real data.
3. Home savings progress was buried below the ledger. Current goals and contribution actions now appear on Home.
4. Coaching previously offered text without a direct next action. Cards now lead to the appropriate expense, budget or savings form; they do not write money automatically.
5. Nested financial request signatures now canonicalize every object recursively, preserving array order and distinct amounts. This prevents a changed planning payload from accidentally reusing an uncertain request's idempotency key.

The existing category name/icon/food snapshot policy is retained. The new independent group is initialized from each legacy transaction's recorded label and food flag once. Earlier ambiguous labels cannot be reconstructed; changing a classification now affects future entries only. Initialization does not alter amounts, dates or ownership and is captured by existing audit/version triggers.

## Verification

Local lint, strict TypeScript, Vitest, build and Playwright. New unit checks cover independent food/drink averages after refunds and renamed labels, plus canonical nested request identity. Browser tests cover planning over available cash, preserved existing pockets, confirmed versus rejected writes, retry keys, zero initial saved amount, separate food/drink cards and continued category/history behavior. Browser API responses are mocked.

`supabase/tests/simple-plan.sql` passed against actual Supabase with rollback-only synthetic fixtures: atomic plan, automatic current-period allocation, no target funding requirement, no overwrite, failed-plan rollback, idempotent retry, goal neutrality, renamed drink snapshots, refunds and exact cash. Existing authorization/financial/analytics/category-history/concurrency suites are required in GitHub Actions before deployment. No real credentials are used by test fixtures.

## Remaining work

- M6: installable PWA, useful offline fallback, real-data CSV import/export, backups and final deployment documentation.
- Real ledger search currently covers the displayed latest 100 monthly entries; aggregates include all entries. Full-history server-side search/pagination belongs in final completion.
- Recurring-bill scheduling and debt tracking from the original broad brief remain outside the refined five daily-use requirements and are not claimed as working. Fixed monthly budget pockets already support tracking recurring expense categories manually.
- Original demo charts remain synthetic examples; real authenticated analytics use Supabase data. Production main bundle still exceeds Vite's size guideline.
- Existing Supabase leaked-password-protection notice remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No paid plan or API was enabled.

## Manual acceptance

1. Open Home → วางแผนแบบง่าย. Set only missing Food/Drinks/Utilities/Phone pockets; existing rows should be disabled. Add an optional เงินเก็บ target. Confirm cash and expenses do not change merely from planning, and the goal starts at zero saved.
2. Record food on two days and drinks on one day. Confirm the two daily averages are separate and calendar-day versus purchase-day denominators are explicit. Refund part of a drink and verify its net total drops once.
3. Rename a drinks category to a label without a drink keyword; leave its group as เครื่องดื่ม. Old and new entries remain independently labeled, and both retain the proper recorded drink classification. Change to อื่น ๆ only for future entries when intended.
4. Check every pocket's used/remaining amount and the day guide. Overspending still records truthfully. A new month resets its target without resetting accumulated savings.
5. Use a coaching action: it should open a review or entry form, never silently create a contribution. Check the home savings progress after an actual earmark.
6. Disconnect during planning; no success before confirmation. Retry after reconnect; one confirmed plan should exist. Switch users and confirm privacy remains intact.
