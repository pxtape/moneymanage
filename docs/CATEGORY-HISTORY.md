# Category editing with stable financial history

This M4 follow-up adds category rename, emoji editing and soft deletion under ตั้งค่าและหมวด. Category changes apply to future entries. There is no bulk rewrite of historical transactions.

## Stable labels

Transactions retain their category UUID for integrity and store `category_name_snapshot`, `category_icon_snapshot`, `food_drink_snapshot` and `envelope_name_snapshot`. A checked database trigger fills these on entry; changing category metadata cannot mutate them. An amount/date/note edit with the same category keeps its existing labels. Explicitly moving an individual transaction to another category captures that category's current labels and records the change in transaction history.

Refunds copy the original expense's label/icon/food classification, even after a rename or archive. Analytics use recorded labels and split distinct historical name/icon versions rather than joining today's category labels. Food/drink classification is explicit and captured on each entry; changing a category's name or food setting cannot retrospectively change food averages.

For legacy records without snapshots, migration initializes snapshots from metadata still known at migration time, including archived budget names where available. Labels lost before snapshots existed cannot be reconstructed. Backfill touches no amounts, dates or account ownership; existing audit/version triggers record initialization. Subsequent category edits/deletions do not update any transaction row or version.

## Editing and deletion

- Open settings, choose แก้ไข beside a category, then change the name, select an emoji or enter one from the keyboard, and optionally change food/drink inclusion for new entries.
- ลบหมวดนี้ opens a separate confirmation. Deletion hides the category from new expense entry and clears its default budget mapping. Existing amounts, refunds, budget references and history remain.
- Archived category/budget options remain available on their existing transaction's edit form, so an amount or note can still be corrected without silently clearing its original classification. Archived categories cannot be selected for new expenses.
- Recreating a deleted name creates a new UUID; it does not merge or relabel old records.
- Mutations go through the transactional, per-owner serialized `moneyspace_write` RPC, with request keys, explicit ownership and optimistic category versions. Direct category UPDATE/DELETE stays unavailable. No client secret or paid service is added.

## Validation

Run lint, typecheck, Vitest, build and Playwright. Unit coverage includes multi-codepoint emoji, duplicate names, historical label variants and stable food totals. Browser coverage exercises failed/confirmed rename, emoji selection, deletion confirmation, unchanged old labels/totals, hidden archived picker options and editing an archived record. Browser responses are mocked.

`supabase/tests/categories-history.sql` uses rollback-only fixtures to assert real trigger/RPC behavior, historical snapshots, current versus old labels, stable totals, refunds after archive, immutable transaction versions during category changes, continued transaction editing, reused names, category audit records, version conflicts, direct-write denial and cross-owner denial. CI replays all migrations and executes this alongside earlier authorization/financial/analytics/concurrency tests before deployment.

## Manual acceptance

1. Record an expense under 🍜 อาหาร. Rename the category to 🥗 มื้อพัก in settings and refresh. The old expense and historical chart keep 🍜 อาหาร; a new expense uses 🥗 มื้อพัก.
2. Change the food/drink checkbox. Old food averages remain unchanged; only new entries use the new setting.
3. Delete the category. It disappears from new entry choices, while old transactions, totals, graphs and refunds remain. Try editing the old amount: the original category remains selected and marked เลิกใช้แล้ว.
4. Issue a refund from an old expense after deleting its category; it offsets the original historical category once. Check transaction audit history.
5. Disconnect before saving a category edit: no success until Supabase confirms. Reconnect and retry. A stale concurrent edit must ask for reload, and another user cannot modify the category.

M5 family operations and M6 installable/offline/CSV work remain outside this follow-up.
