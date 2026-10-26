# Teal theme and personal tools

The user approved a K PLUS / MAKE-inspired direction and explicitly canceled competition between accounts. This release retains MONEYSPACE branding and its financial model, with original teal/mint styling and cover patterns. No KBank logos, screenshots or proprietary artwork are included. Research references: [K PLUS overview](https://www.kasikornbank.com/th/kplus/) and [MAKE Cloud Pocket](https://www.kasikornbank.com/th/news/pages/cloud_pocket.aspx).

## Delivered

- Dark teal workspace, mint primary balance, coordinated light theme and four colored Home shortcuts: expense, income, saving and budgets. Existing keyboard focus and reduced-motion behavior remain.
- Pocket color, emoji and original cover patterns (waves/dots/leaves/plain) in the create/edit budget form, with a preview. Metadata persists through authenticated Supabase writes and reloads. Existing pockets retain palette fallbacks until customized. No cash movement or consumption is created by styling.
- Owner-scoped category favorites, pinned from Quick Expense or Settings. Favorites sort first while the current amount/category entry is retained. Pins wait for server confirmation and share the writer’s stable retry key. Category names, icons, tags and historical transaction snapshots are unchanged.
- Current weekly digest plus prior-week navigation, using calendar weeks from Monday through the selected end date. The current week stops at today in Asia/Bangkok. The dedicated authenticated invoker RPC aggregates all transactions, including more than the 100-row ledger preview, and net saving contributions/releases. Refunds reduce expenses; budget allocations and earmarks are not consumption. Historical week reads can span month/year boundaries.
- Explicit share preview, with all money omitted by default. Users may opt into amounts, download a 1080×1080 PNG, or open native sharing when their browser supports file sharing. Unsupported native sharing falls back to a download. Canceling sharing is harmless. Each preview starts with amounts hidden again. Profile text is XML-escaped; the card identifies itself as a personal summary, not a bank transfer slip. There is no automatic feed, message delivery or access by the other account.
- Per-account, per-browser non-financial preferences: hide the top money summary, show in-app low-budget prompts, and choose a weekly review day. These store only booleans/day in a namespaced localStorage key. They are explicitly in-app prompts shown while using the app, not push/background notifications. Pocket metadata/favorites persist in Supabase across devices; these appearance/reminder preferences remain on this device.

## Database

Migration `20261026153630_pocket_appearance_favorites_and_weekly_digest.sql` adds envelope color/icon/cover and category is_favorite, all under existing owner RLS. It adds a version-checked pin_category writer action and optional validated appearance fields to existing create/allocate operations. Existing callers that omit them retain their settings. The new moneyspace_weekly_summary(date) is SECURITY INVOKER with explicit auth.uid() scoping; PUBLIC/anon execute is revoked. No access policy is broadened and no service key is exposed.

The CLI migration creation was attempted but its state directory remains on this environment’s read-only home. The exact version returned by the connected migration tool was checked in. The change was validated in an isolated PostgreSQL 17 instance before applying to the dedicated MONEYSPACE project.

## Validation

- Lint, TypeScript, production build and 44 unit tests passed. Existing bundle-size warning remains.
- All 22 mobile/desktop Playwright cases passed; four appearance/overview cases passed again after final responsive refinements.
- Tests include persistence, uncertain-response pin retry, cross-account preferences, no-money-change styling, PNG signature/dimensions, hidden-by-default SVG contents, XML escaping, amount opt-in and privacy reset on reopening.
- All 11 SQL suites and 3 concurrency checks passed in disposable PostgreSQL. The new rollback-only suite also passed against live Supabase, including 105 expense records, exact refunds, weekly savings, invalid styles, stale versions, older clients, foreign-user denial and anonymous denial.
- Security advisors found no new issue. The existing [leaked password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains.
- @types/node is pinned as a development-only dependency for downloaded PNG verification. No runtime package or paid API was added.

## Manual acceptance

1. In Monthly Budgets, edit a pocket’s color/emoji/pattern, save and reload. Its target, cash and expenses must stay unchanged.
2. Open Quick Expense, enter an amount and pin a category using its star. The category moves first, the amount stays, and the pin persists after reload. Other users must retain their own pins.
3. Use the eye button on the mint summary, reload, and toggle it back. In Settings, choose in-app prompts and a review day.
4. Review this week, then the preceding week. Amounts are only recorded data, not proof of complete spending history.
5. Open the weekly card: money should be hidden. Download and inspect PNG. Opt into amounts only when intended; reopening the preview hides them again.
6. Check mobile, desktop, light/dark and reduced motion. Competition/family features are absent.

PWA/offline completion, CSV/backups, full-history search, real bank transfers and background push are not delivered by this release.
