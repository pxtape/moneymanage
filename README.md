# MONEYSPACE

Thai-first personal and family finance application. **M1 review build**, not a production financial service.

## Run

Node 22+ and npm:

```sh
npm install
npm run dev
```

Open the printed localhost URL. Build: `npm run build`. Serve `dist/` on static hosting. Vite uses relative asset paths for GitHub Pages project repositories. No backend or paid API is needed for M1.

## M1 delivered

React, TypeScript, Vite, Tailwind CSS, shadcn-style Button (CVA), Radix accessible dialog, Lucide icons, Recharts. Responsive desktop sidebar/mobile five-action bottom navigation. Thai/THB defaults. Dark/light themes; only theme preference uses localStorage. Dashboard, accounts, envelopes, goal, illustrative coaching and family screens. In-memory expense entry, search, type filters, and demo CSV export.

Data is synthetic and dated 20 October 2026. Dashboard totals are a month-to-date snapshot; recent transactions are only a subset. Chart and comparison percentages are illustrative and labeled demo. Adding an expense changes cash, remaining allocated funds, monthly consumption, safe-to-spend and recent transactions. Unallocated available funds remain unchanged while an expense consumes reserved budget: both cash and the reserve decrease. Existing envelope/goal cards and charts remain illustrative snapshots in M1; integrated budget accounting arrives in M3. Calendar-day average divides by 20 elapsed days. Safe-to-spend divides remaining monthly expense budget by 12 days including today. It is a planning estimate, not a cash availability guarantee.

Amounts entered by users are parsed as integer satang; floating-point user money arithmetic is avoided. Transfers and budget allocations are excluded from the tested consumption helper; refunds reduce consumption. Supabase will store NUMERIC decimal amounts and perform transactional updates in M2–M3. Never use this demo to store real finances. Entries disappear on refresh. No write is claimed as synced.

## Milestone boundary

- M1: foundation, design, navigation, synthetic data — implemented, verification status below.
- M2: Supabase schema/migrations, auth, RLS, onboarding, authorization tests.
- M3: persistent accounts, envelopes, transactions, rollover, transactional balance operations.
- M4: derived analytics and deterministic coaching.
- M5: household roles, invitations, private/shared access, atomic splits and settlements.
- M6: installable PWA, offline fallback, import/backups, audit UX, full tests, deployment.

No service worker is installed yet. No authentication, SQL migration, RLS, durable write, invitation, or settlement operation is simulated as complete.

## Supabase setup (M2 preparation)

1. Create a free-tier Supabase project and retain its database password outside source control.
2. Copy `.env.example` to `.env.local`. Add only the project URL and public anon/publishable key. **Never add service_role or database passwords to VITE variables.** Vite bundles these publicly.
3. M2 will provide reviewed migrations under `supabase/migrations/`, with RLS enabled on every user table, ownership/membership constraints and authorization tests. Do not expose tables until those are applied and tested.
4. Auth redirect URLs must match the local app and exact GitHub Pages project URL. GitHub Pages is public static hosting, not a secrets boundary.

## Verification

Commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`.

Vitest covers precise input parsing and exclusion of transfers/allocations from expenses, including refunds. Playwright includes mobile and desktop expense-entry smoke tests. Browser setup: `npx playwright install chromium` when supported by the execution environment.

Validation: lint, TypeScript, four Vitest tests, and production build passed. The production bundle has a size warning (705 kB JS before gzip), largely from chart dependencies. Playwright mobile (390px) and desktop (1440px) expense-entry smoke tests passed. Screenshots are in `artifacts/`. Browser installation in this workspace uses `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright`; set the same variable when rerunning here.

## Manual acceptance checklist

- At 390px and 1440px widths, check layout and navigate Home, Wallets, Add, Insights, Family.
- Switch themes; refresh and confirm theme persists.
- Add ฿120.50: verify cash falls by ฿120.50 and monthly spending rises by the same amount; confirm the unsynced demo notice.
- Enter zero, negative, over-two-decimal, or excessive amounts; confirm validation.
- Close Add with Escape; verify focus returns to its trigger.
- Search wallets transactions, filter income/expense/transfer, export demo CSV.
- Switch chart week/month; check the period changes.
- Review the family privacy explanation and milestone labels.
- Refresh and confirm demo transactions reset; no success message claims a Supabase sync.

## GitHub Pages

Workflow is provided at `.github/workflows/pages.yml` for pushes to `main` or manual dispatch. Push this folder as the repository root, enable Pages → GitHub Actions, and dispatch. It runs checks and uploads `dist`. It has not been deployed from this workspace. A lockfile is included; CI installs with `npm ci`. All deployed files are public.
