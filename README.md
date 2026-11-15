# Jam 🫙

Your money, a little clearer. A TypeScript expense tracker for your own spending and your whole family's picture, with a responsive desktop dashboard and an installable phone interface.

## Run locally

Use Node.js **22.12+** and npm.

```bash
npm ci
npm run dev
```

```bash
npm test
npm run build
npm run preview
```

## Personal and family views

- Email/password sign-in, email confirmation, and password reset through Supabase Auth.
- Each member has **My expenses** and **Family** views. Everyone in the family can read the family's entries; each member can change only their own ledger.
- Family filters by person, month, and category; per-person spending, combined totals, shared monthly budget, and export.
- The family owner creates email-bound, single-use invitation links and sets the shared budget.
- Personal income/expenses, categories, notes, cash-flow charts, budgets, savings goals, top ups, withdrawals, CSV export, and JSON backup/restore.
- One family per account and one fixed family currency (USD, HKD, EUR, or GBP).
- Cross-device cloud saving with revision checks and a family refresh every 15 seconds/on focus.

**Backend setup is required:** run [`supabase/setup.sql`](supabase/setup.sql) in Supabase SQL Editor and follow [`supabase/README.md`](supabase/README.md) for Auth URLs, email delivery, and hosting access. The app shows setup guidance if the tables do not exist.

## Browser-only workspace

Choose **Continue with this device's local workspace** to use the original local-first mode. Its data stays in this browser under the legacy `mint-expenses-v1` key. It begins with sample data ($14,000 income, $1,996 expenses, $12,004 available). Use Settings to clear samples and start fresh.

Browser data is never automatically uploaded. To migrate real records, open **Family → Import this device's data**. This explicitly replaces only the signed-in account's ledger. Sample data and different currencies are refused. Export a backup before importing or switching browsers.

## Data and access

The Supabase URL and publishable key in `src/supabase.ts` are public client configuration. No service-role key or database password is used by the app. PostgreSQL row-level security limits reads to family members, and authenticated database functions authorize every write. Members cannot supply another user's ID to save a ledger. Invitation tokens are stored as hashes and are bound to a confirmed email and a seven-day expiry.

Conflicting writes from two devices are rejected rather than silently overwriting changes. Export a backup before discarding an unsaved conflict. Offline cloud edits stay in the open session until saving succeeds; keep the tab open or export a backup if saving fails. Cloud ledgers are not cached in the browser-only workspace. Signing out clears the in-memory workspace.

Money is stored in integer cents. Savings transfers affect available balance and goal balances, but do not count as expenses. Savings are manually recorded and do not move bank funds. The personal budget is separate from the owner's shared family budget. The available personal balance covers all transactions; reports use the selected month. Browser-only currency changes relabel values without conversion; family currency is fixed.

Hosted Site access is separate from Supabase access. The existing Site stays private until the owner explicitly changes its audience. To allow email-only family access, the login page must be reachable by the family; the database's RLS still protects their records.

## Install on a phone

Use an HTTPS deployment. On iPhone, use Safari → Share → Add to Home Screen. On Android, use Chrome → Install app / Add to Home screen. This is a PWA, not an App Store/Play Store release. The application shell and browser-only workspace work offline after the first visit; family account loading and saving require a connection.

## Project layout

- `src/App.tsx`: personal workspace and browser-local mode.
- `src/CloudApp.tsx`: authentication, account sync, invitations, onboarding, family dashboard.
- `src/family.ts`: typed family reporting and ledger validation.
- `src/domain.ts`: exact-cent financial model and CSV export.
- `supabase/setup.sql`: idempotent database setup, RLS, and authenticated functions.
- `src/database.test.ts`: PostgreSQL authorization/concurrency tests using PGlite.
- `src/domain.test.ts`, `src/family.test.ts`: financial calculations and family reports.
- `vite.config.ts`: React, bundle splitting, and PWA configuration.
- `.openai/hosting.json`: existing private Sites identity and static `dist/` output.

GitHub Actions runs tests and the TypeScript/production build. Tests do not create accounts or send emails in the live Supabase project.

## Hosting

Build with `npm run build` and deploy `dist/` to an HTTPS static host. Supabase Auth redirect URLs must match the deployment. The included Sites ID belongs to this project's existing deployment; remove it before creating an independent Site from a fork.
