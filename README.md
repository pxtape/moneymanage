# MONEYSPACE

Thai-first personal and family finance app. **M2 review build**, with a category-first demo and authenticated private onboarding. React, TypeScript, Vite, Tailwind, shadcn-style Button/CVA, Radix Dialog, Recharts, Supabase Auth/Postgres, Vitest and Playwright. No paid AI APIs.

Live: https://pxtape.github.io/moneymanage/

## Run

Node 22+:

```sh
npm ci
npm run dev
```

`npm run build` emits `dist/` with relative asset paths for GitHub Pages. No service worker/PWA installation yet (M6).

## Current experience

**Quick entry:** enter amount → tap category → save. “อาหาร” becomes the transaction title automatically. No required merchant, item name or note. Add a reusable custom category once. Optional details reveal merchant/title, date, needs/wants and notes. Last selected category/account stays selected for the session.

**Demo space:** synthetic October 2026 dashboard, five-action mobile nav, themes, wallets/envelopes/goals, search, filters and demo CSV. Demo expense entry and custom categories are in memory only, reset on refresh, and never claim sync. Chart, comparisons, envelope/goal cards are illustrative snapshots; monthly totals are not the sum of the recent-transaction subset. Amounts entered in demo use integer satang. Allocation and transfer are not consumption; refunds reduce consumption. Calendar-day averages use elapsed calendar days. Safe-to-spend is a remaining monthly budget estimate, not a cash guarantee.

**Account space:** email/password auth, confirmation state, sign-out, atomic/idempotent onboarding, personal profile/account opening amount, six starter categories and persistent custom categories. It uses authenticated Supabase rows and never displays demo finances as real. Actual financial recording, budgets, rollover and derived account balances are intentionally disabled until M3.

## Supabase setup

Dedicated MONEYSPACE project: `mfdttuvsvplbrfmjxxqs`, Singapore, pxtape's Org; quoted $0/month at creation. The existing learning project was not modified.

1. In Auth → URL Configuration, set Site URL and allowed redirect to `https://pxtape.github.io/moneymanage/`. Add the local development URL when required.
2. Keep email confirmation enabled. Signup emails are subject to Supabase's delivery restrictions and limits. Live email delivery remains a manual acceptance check.
3. Browser config is intentionally public in `src/public-config.ts`. To use another project copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and apply migrations there.
4. Never expose service_role, `sb_secret`, database passwords or access tokens in Vite/GitHub Pages. All deployed frontend files are public. RLS enforces data access.
5. Apply `supabase/migrations/*.sql` once in lexical order to a dedicated empty project. Current migrations have already been applied to MONEYSPACE; do not reapply them there. `supabase/schema.sql` is a reference snapshot, not an extra migration.

All 16 app tables have RLS. NUMERIC(16,2) amounts, UUID IDs, timestamps, soft deletion, composite integrity constraints, indexed ownership/membership predicates and append-only audit metadata are provided. Financial/family writes are denied until reviewed transactional APIs arrive. Internal membership checks read live membership with explicit auth.uid(), never user_metadata. See [M2 review](docs/M2-REVIEW.md) for details and remaining boundaries.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

In this cloud workspace Chromium is installed at `/workspace/.playwright`; run `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npm run test:e2e`.

- Vitest: exact satang parsing, invalid inputs, transfer/allocation exclusion, refunds, category validation and date shape.
- Playwright: mobile/desktop category-only entry, custom reuse, validation/optional detail, auth UI, failed login, onboarding, and rejected/confirmed category writes (mocked server responses).
- Authorization: run `supabase/tests/authorization.sql` as postgres. Synthetic fixtures roll back; passed on actual Supabase Postgres 17. Tests assert private/shared/outsider/revoked access, escalation/ownership denial, atomic/idempotent onboarding, numeric precision, anonymous denial and category ownership/constraints. No synthetic Auth users remain.
- GitHub Actions also runs the policy assertions on PostgreSQL 17 using a minimal Auth-role stub. Never apply `supabase/tests/bootstrap.sql` to real Supabase.

Build has a large bundle warning (chart + Supabase dependencies); bundle optimization remains a limitation. Screenshots are under `artifacts/`. Live email signup/delivery is not claimed as automatically tested.

## Manual acceptance

1. On mobile, add ฿80 by selecting อาหาร, without typing a title. Verify demo cash falls by ฿80.
2. Create สัตว์เลี้ยง once and reuse it; expand optional details only if needed.
3. Validate missing category, zero, negative and fractional satang; close dialog with Escape and check focus.
4. Configure Auth URL, sign up, confirm email and sign in. Onboard with ฿1,000.25; refresh and check one account and six starter categories.
5. Add a real category and refresh; ensure it remains. Verify no demo transaction is imported into the real account.
6. Sign out; another user must not see the first user's private data. Disconnect network during a real category save; no success should be shown.

Full checklist: [docs/M2-REVIEW.md](docs/M2-REVIEW.md).

## Milestones

- M1: design system, responsive navigation and demo data — delivered.
- M2: dedicated Supabase schema, Auth, RLS, onboarding, reusable categories — current review.
- M3: real accounts, budgets, transactions, rollover and balances.
- M4: derived analytics and deterministic coaching.
- M5: household mutations/roles/invites, atomic splits and settlements.
- M6: installable PWA/offline fallback, CSV import/backups, full audit history UX, broader tests and final docs.

`.github/workflows/pages.yml` runs checks and database authorization assertions on pushes to `main`, then deploys `dist/` through GitHub Pages. Both jobs must pass before deployment. No backend secrets are required by CI. Supabase configuration uses a public publishable key plus RLS.
