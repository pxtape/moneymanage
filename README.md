# MONEYSPACE

Thai-first personal finance app. **Personal finance build (M4 + completeness refinements)**, with a private overall money log, recurring monthly budget targets and transactions. React, TypeScript, Vite, Tailwind, shadcn-style Button/CVA, Radix Dialog, Recharts, Supabase Auth/Postgres, Vitest and Playwright. No paid AI APIs.

Live: https://pxtape.github.io/moneymanage/

## Run

Node 22.12+ (or Node 24+):

```sh
npm ci
npm run dev
```

`npm run build` emits `dist/` with relative asset paths for GitHub Pages. No service worker/PWA installation yet (M6).

## Current experience

**Quick entry:** enter amount → tap category → save. “อาหาร” becomes the transaction title automatically. No required merchant, item name or note. Add a reusable custom category once. Optional details reveal merchant/title, date, needs/wants and notes. Last selected category stays selected for the session. Real entry has no bank account selector.

**Demo space:** synthetic October 2026 dashboard, five-action mobile nav, themes, wallets/envelopes/goals, search, filters and demo CSV. Demo expense entry and custom categories are in memory only, reset on refresh, and never claim sync. Chart, comparisons, envelope/goal cards are illustrative snapshots; monthly totals are not the sum of the recent-transaction subset. Amounts entered in demo use integer satang. Allocation and transfer are not consumption; refunds reduce consumption. Calendar-day averages use elapsed calendar days. Safe-to-spend is a remaining monthly budget estimate, not a cash guarantee.

**Account space (M3):** pre-provisioned username/password login for `tape` and `pat`, sign-out, password change, atomic/idempotent onboarding, personal profile/overall opening amount, six starter categories and persistent custom categories. It uses authenticated Supabase rows and never displays demo finances as real. Real expenses, income, linked refunds, recurring monthly targets with multiple category mappings, goal earmarks and transaction edit/delete/history are connected. Budgets and categories can be renamed or soft-deleted without deleting expenses. Category emojis are editable; recorded category/budget labels and food classification stay on each transaction to preserve history. See [category/history behavior](docs/CATEGORY-HISTORY.md). Real daily/category/weekday/six-month analytics, normalized monthly comparisons, savings/goal views and deterministic Thai coaching are available under ข้อมูลเชิงลึก. See [M4 review](docs/M4-REVIEW.md) for definitions, checks and manual acceptance.

## Supabase setup

Dedicated MONEYSPACE project: `mfdttuvsvplbrfmjxxqs`, Singapore, pxtape's Org; quoted $0/month at creation. The existing learning project was not modified.

1. The two accounts are created with Admin createUser and email_confirm=true. Usernames map to reserved internal `.invalid` email aliases; no email is sent by login, setup or password change. No signup page exists.
2. New Auth user inserts are blocked at the database boundary for the Auth server role. This closes signup even if someone calls the public endpoint directly. The Dashboard signup flag is not claimed as changed; disabling that flag is optional defense in depth. See `docs/USERNAME-LOGIN.md`.
3. Browser config is intentionally public in `src/public-config.ts`. To use another project copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and apply migrations there.
4. Never expose service_role, `sb_secret`, database passwords or access tokens in Vite/GitHub Pages. All deployed frontend files are public. RLS enforces data access.
5. Apply `supabase/migrations/*.sql` once in lexical order to a dedicated empty project. Current migrations have already been applied to MONEYSPACE; do not reapply them there. `supabase/schema.sql` is a reference snapshot, not an extra migration.

All 17 app tables have RLS; private request receipts are also protected. NUMERIC(16,2) amounts, UUID IDs, timestamps, soft deletion, composite integrity constraints, indexed ownership/membership predicates and append-only audit metadata are provided. Personal financial writes use the M3 transactional RPC; shared financial mutations remain denied; family features were removed from product scope. Internal membership checks read live membership with explicit auth.uid(), never user_metadata. See [M2 review](docs/M2-REVIEW.md) for details and remaining boundaries.

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

Build has a large bundle warning (chart + Supabase dependencies); bundle optimization remains a limitation. Screenshots are under `artifacts/`. Both real username/password accounts and password updates were verified against the live Auth API, then test sessions were signed out. No email delivery is required.

## Manual acceptance

1. On mobile, add ฿80 by selecting อาหาร, without typing a title. Verify demo cash falls by ฿80.
2. Create สัตว์เลี้ยง once and reuse it; expand optional details only if needed.
3. Validate missing category, zero, negative and fractional satang; close dialog with Escape and check focus.
4. Sign in as `tape` or `pat` with the separately delivered initial password. Onboard with ฿1,000.25; refresh and check the overall money total and six starter categories.
5. Add a real category and refresh; ensure it remains. Verify no demo transaction is imported into the real account.
6. Change your initial password, sign out, and sign in with the new one. Another user must not see the first user's private data. Disconnect network during a real category save; no success should be shown.

Full checklist: [docs/M3-REVIEW.md](docs/M3-REVIEW.md).

## Milestones

- M1: design system, responsive navigation and demo data — delivered.
- M2: dedicated Supabase schema, Auth, RLS, onboarding, reusable categories — delivered.
- M3: overall money log, recurring monthly budget targets, transactions and savings — delivered, revised to monthly comparison targets.
- M4: real derived analytics and deterministic coaching, plus budget rename/delete — current review.
- M5: family features — canceled by user; no shared write API was deployed.
- M6: installable PWA/offline fallback, CSV import/backups, full audit history UX, broader tests and final docs.

`.github/workflows/pages.yml` runs checks and database authorization assertions on pushes to `main`, then deploys `dist/` through GitHub Pages. Both jobs must pass before deployment. No backend secrets are required by CI. Supabase configuration uses a public publishable key plus RLS.

Current manual acceptance checklist and validation limits: [docs/M4-REVIEW.md](docs/M4-REVIEW.md). Existing M2 documents describe earlier stages and are superseded where M3 changes behavior.

## Current scope update

Family spaces, invitations, shared wallets, splits and settlements were canceled by user request. The family page/menu and demo preview are removed. Mobile navigation is now Home, Budgets, Add, Insights, Settings. The existing tape/pat logins remain separate private accounts. Original M2 database foundation tables/policies remain protected and unchanged; no M5 schema or sharing API was applied. Historical milestone documents describe earlier plans. The next remaining milestone is M6: PWA, CSV, backups and final deployment/documentation.

Latest interface review: [Visual budgets and editable goals](docs/VISUAL-BUDGETS-AND-GOALS.md). Home shows income, remaining/original budget amounts and percentage bars. Monthly planning has a separate allocation donut, and savings goals support rename, retarget and safe deletion. Progress rings and milestones make progress visible without scoring users. The simple-plan button was removed. Food/drink analysis remains independent. See the earlier [completeness review](docs/COMPLETENESS-REVIEW.md) for broader scope; M6 and full-history search remain unfinished.

Monthly cashflow planning replaces the retired payday option. Home and Budgets now lead with expected income sources, planned expense pockets, monthly savings intent and the resulting reserve or deficit. These forecasts never change actual cash, transactions or accumulated savings. Plans are stored separately per month, with optional explicit copying from the latest earlier plan. See [monthly planning rules and acceptance](docs/MONTHLY-CASHFLOW-PLAN.md).

Screen roles and hierarchy: Home leads with actual money and daily budget use, with the monthly plan last; Monthly Budgets leads with planning. Category defaults support Need/Want edits for future entries without rewriting history. See [screen flow review and acceptance](docs/SCREEN-FLOW-REVIEW.md).

Accepted-scope closeout and final interaction polish: [closeout notes](docs/CLOSEOUT.md). Finite animations respect reduced motion; financial rules and reviewed screen order stay unchanged.

The revised daily overview emphasizes current cash after earmarks, separates selected-month activity, and uses responsive priority-ordered budget cards. See [daily overview review](docs/DAILY-OVERVIEW.md).

Budget pockets now distinguish daily, bill and occasional use. Compact activity/goals/planning and observation-aware analytics address the full screenshot review. Existing pockets start neutral; choose their cadence in the budget editor. See [analytics and compact views](docs/ANALYTICS-AND-COMPACT-VIEWS.md).

Teal/mint personal tools: original pocket covers/colors/icons, synchronized category favorites, private weekly PNG cards and on-device in-app review preferences. Competition was canceled. See [theme and personal tools review](docs/TEAL-THEME-AND-PERSONAL-TOOLS.md).

Recurring bills and amount/category expense favorites were removed by user request. Existing actual expenses and audit history remain intact. The new **Pat × Tape** comparison tab shows daily, weekly, cumulative and food/drink graphs after both users enable summary sharing. Settings now offers Light (default), Pink and Dark themes, plus configurable in-app daily/weekly/budget reminders. No OS push or background delivery is claimed. See [comparison, themes, reminders and acceptance](docs/COMPARISON-THEMES-AND-REMINDERS.md).
