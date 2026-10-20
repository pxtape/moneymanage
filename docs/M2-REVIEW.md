# M2 review

## New interaction

Amount → category → save. A category is the default transaction title, so “อาหาร” needs no restaurant, item name, or note. Six starter categories, one-tap selection, reuse the latest selection during the session, optional custom category creation. Account defaults to the current account; date defaults to today in Asia/Bangkok. The optional detail section holds title/merchant, date, needs/wants and notes. New demo categories remain in memory only. Real categories persist only after a successful Supabase response.

Categories and envelopes are separate. A category may have a default envelope mapping; it does not itself allocate money. M3 will persist mappings and apply transactions against the selected envelope. Category creation alone does not spend or allocate money.

## Scope

M2 ships email/password sign-up/sign-in/sign-out, email confirmation state, private onboarding and persistent categories. First-run account creation, six default categories and profile completion are a single transaction, locked and idempotent. Authenticated space uses real profile/account/category data, never demo financial totals. Real transaction recording, budget operations, rollover and integrated balances remain M3. The demo quick-entry form is available to review the proposed interaction.

The dedicated project is MONEYSPACE (`mfdttuvsvplbrfmjxxqs`), Singapore, in pxtape's Org. Supabase quoted $0/month at creation. The pre-existing learning project was not changed. Free-tier limits and future pricing still apply.

## Database

All 16 core tables (including new reusable `categories`) have UUID keys, timestamps and RLS. Amounts are NUMERIC(16,2). Composite foreign keys prevent cross-owner and cross-household links for core relations. Soft deletion is supported where relevant. Immutable membership roles and no client grants for family or financial writes prevent premature access before M3/M5 transactional APIs. Membership checks use live database membership, not editable JWT metadata.

Internal security-definer functions are confined to `moneyspace_private`, use an empty search_path, and are not exposed as Data API endpoints. Membership lookup functions explicitly check auth.uid(). The audit trigger writes metadata only and cannot be directly called by client roles. Onboarding RPC is SECURITY INVOKER and passes all caller RLS policies. Audit write access is denied to clients. Audit records capture entity/action/actor, not historical values; detailed transaction version history is deferred to M3/M6.

Financial/shared tables are SELECT-only for clients in M2. Atomic shared split validation, sum-to-total enforcement, settlement invariants and non-duplicating transaction operations must be added before M3/M5 grants any financial write path. They are not claimed as implemented by these foundation tables.

## Migrations

Apply tracked files in `supabase/migrations/` once, in lexical order, to an empty dedicated Supabase project. These exact SQL statements were applied using the remote MCP migration tool; the filenames use the actual recorded remote migration versions. CLI 2.121.0 could not run here because it tried to create `/home/agent/.supabase` on a read-only filesystem, including after a scoped permission retry. No CLI migration generation or db pull is claimed. The duplicated `schema.sql` is a reference snapshot of the initial migration, not a second migration to apply.

## Authorization verification

`supabase/tests/authorization.sql` creates synthetic users and rows, impersonates authenticated/anon roles, uses assertions that fail on access leaks, and rolls everything back. It passed on the actual Supabase Postgres 17 database. Confirmed zero synthetic Auth users remain. Coverage: owner isolation, household-private account and transaction isolation, explicitly shared access, removed-member revocation, outsider denial, role escalation denial, ownership reassignment denial, direct transaction/audit writes denied, category persistence/duplicates/blanks, atomic onboarding rollback, idempotent onboarding, exact decimals and anonymous denial.

GitHub Actions also runs these assertions on PostgreSQL 17 with `supabase/tests/bootstrap.sql`, a minimal Auth identity stub. **Never apply that bootstrap file to Supabase.** CI tests database policies; they do not exercise Supabase GoTrue/email delivery. Security advisor returned zero findings; four missing composite FK indexes were fixed. Remaining performance INFO notices concern unused indexes in a new empty database; retained for production foreign-key and policy lookups. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Supabase Auth setup

In Authentication → URL Configuration, set:

- Site URL: `https://pxtape.github.io/moneymanage/`
- Redirect allowlist: `https://pxtape.github.io/moneymanage/` and local development URL if needed.

Keep email confirmation enabled. The frontend uses the public publishable key only. Never put service_role/secret keys in Vite or GitHub Pages. Default Supabase email delivery has rate limits and may restrict recipients; configure SMTP or allowed team addresses if your project reports a delivery restriction. Browser tests also cover mocked Auth/onboarding and a rejected category write followed by a server-confirmed retry. Live email confirmation/delivery requires manual acceptance; no email was sent to a real user during tests.

## Manual acceptance

1. Open Add on mobile. Enter 80, tap อาหาร, save without entering a name. Check the transaction is titled อาหาร and demo cash drops by ฿80.
2. Add สัตว์เลี้ยง once and reuse it for two expenses. In demo it resets on refresh; in the authenticated account category manager it persists.
3. Expand optional details only when needed; ensure notes are optional. Reject 0, negative, fractional satang and missing category. Dialog close/Escape restores focus.
4. Open เข้าสู่ระบบ, create your account, confirm your email, then sign in. Complete onboarding with e.g. ฿1,000.25. Check the real account shows the exact opening amount and six starter categories, without any demo transactions.
5. Refresh after onboarding; ensure no duplicate account. Add a category and refresh; confirm it remains.
6. Open another signed-in user's account; no first user's accounts or categories should appear. Sign out and use the demo; no real profile data should remain in the demo.
7. Disconnect network while saving a category/onboarding. No synced-success message should appear. Reconnect and retry.
8. Real transaction entry is intentionally not enabled in M2. Review the quick-entry demo before M3 connects it to real funds.
