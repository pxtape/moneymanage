# Screen order and category defaults review

## Why the roles are separated

The previous layout led both screens with the monthly forecast. This obscured the current cash position on the screen opened most often, and repeated the same numbers with different meanings. Daily monitoring and occasional monthly planning need different priorities, while sharing the same underlying budgets and plan.

| Screen | Question it answers | Order / role |
| --- | --- | --- |
| Home | What is my money position now, and what can I spend next? | Current recorded cash, received income, expenses and earmarks; quick actions; remaining pockets and daily allowance; recent transactions; cumulative savings goals; unfinished getting-started steps; monthly plan last. |
| Monthly Budgets | How should income be divided, and which pocket needs adjustment? | Monthly income/expense/saving/reserve blueprint; compact actual-money reference and actions; editable pocket cards; planned expense distribution donut; full selected-month transaction preview and filters; savings/earmark management. |
| Insights | What pattern should I review? | Existing daily food/drink averages, normalized monthly comparisons, category/weekday/needs-wants analysis and rule-based coaching. Detailed analysis stays here rather than adding more charts to Home. |
| Settings | How can repeat entry be easier? | Category names, emojis, default Need/Want, analysis classification and pocket mappings; theme/password/account actions. |

Home now consolidates the monthly income-minus-expense difference into the actual expense card, removing the separate large duplicate net card. Budget progress moves immediately after the money overview/actions. Recent entries precede long-term goals, making corrections easy after entry. Getting-started steps are lower priority and hidden once the three conditions are complete. Monthly planning remains available at the bottom exactly as requested.

The same plan component and envelope data serve Home and Monthly Budgets. Editing the plan or budget in either place updates the shared snapshot; there is no second forecast or copied expense total to maintain. On the budget screen, pocket cards precede the donut so users can act on a target before exploring its proportion. Existing ledger access is retained because Home’s “all transactions” link leads there; moving it into a new navigation destination is not part of this change.

Current cash remains an all-time current balance; income/expenses and the plan follow the selected month. Planned reserve remains conditional forecast money. Monthly saving intention, actual earmarks and cumulative goal targets remain distinct to avoid counting the same money twice.

## Editable Need / Want

Settings → edit a category → ประเภทเริ่มต้นของหมวด now offers จำเป็น · Need and ความสุข · Want. The list shows the saved default. New expenses inherit it, including amount-plus-category quick entry. A single entry can still override it in optional details.

Changing a category default never changes recorded transaction tags or historical needs/wants analytics. The writer also preserves a transaction’s stored tag when an amount-only edit omits the tag. An explicit individual tag edit is still allowed and audited. Older category-update callers that omit tag keep the current default. Invalid values and foreign-user edits are rejected.

Migration: `20261020072425_category_default_need_want_and_preserved_transaction_tags.sql`. Existing RLS/grants remain unchanged. CLI migration creation was attempted but its state directory is on the managed environment’s read-only home; the connected migration tool’s authoritative version was used for the checked-in file.

## Verification and manual review

Lint, TypeScript, production build, 34 unit tests and 20 mobile/desktop Playwright scenarios passed. The existing bundle-size warning remains. New rollback SQL tests check default inheritance, historical tags, amount-only edits, invalid values, omitted-tag compatibility, exact balances and foreign access. The full SQL suite runs in deployment CI. No new security advisor issue; the existing [leaked password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains.

1. Open Home: actual balances should be first, with monthly planning last after savings/getting-started content.
2. Check pocket remaining/target percentages and recent entries without passing through the planning form.
3. Open Monthly Budgets: the monthly blueprint should be first; edit a pocket, then see its effect on the same plan and donut.
4. In Settings, switch a category from Need to Want and reload. Confirm the badge/default persists; open quick entry optional details to verify Want is selected.
5. Record a real expense using that category when appropriate. Confirm historical entries retain their previous tag and amounts.
6. Verify mobile/desktop and dark/light themes. M6 offline/PWA, CSV, backups and full-history search remain pending.
