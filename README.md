# Jam 🫙

Your money, a little clearer. A personal expense tracker built with **TypeScript, React, and Vite**, with a responsive desktop dashboard and a mobile interface inspired by the supplied mint-green finance reference.

## Run locally

Use Node.js **22.12+** and npm.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. To check and build:

```bash
npm test
npm run build
npm run preview
```

## What works

- Add income and expenses with categories, dates, and notes; view and delete transactions.
- Search, filter by transaction type, and browse months.
- See your available balance and actual weekly, monthly, and quarterly cash flow.
- Set a monthly budget and see remaining spending capacity.
- Create savings goals, record top ups and withdrawals, and see progress.
- Export the selected month's transactions as CSV; export and restore full JSON backups.
- Customize your name and display currency (USD, HKD, EUR, GBP).
- Install as a Progressive Web App on supported phones and desktops; offline app shell after the first visit.
- GitHub Actions checks financial calculations, backup validation, TypeScript, and the production build.

## Your data

This first release is **local-first**: records are stored in this browser's `localStorage` under `mint-expenses-v1`. No account, server database, bank connection, or cross-device sync is configured. The app plainly labels this in the interface. Different browsers, devices, and origins have separate data. Clearing site data removes your records. Export a backup before changing devices or browsers.

The initial sample workspace has $14,000 income, $1,996 expenses, and $12,004 available. Existing sample savings are starting balances, separate from the transaction history. **Settings → Clear sample data & start fresh** gives you an empty workspace.

All money is stored as integer cents. Savings transfers affect available balance and goal balances but do not count toward expenses. Savings are manual records, not actual bank transfers. Changing display currency relabels values; it does not convert them. The budget is one recurring monthly limit. Charts and CSV exports use the selected month; the available balance includes all recorded transactions.

## Install on a phone

Use an HTTPS deployment. On iPhone, open it in Safari, then **Share → Add to Home Screen**. On Android, open it in Chrome, then **Install app** / **Add to Home screen**. Use the download icon or “Take Jam with you” for instructions. This is an installable web app, not an App Store or Play Store release.

## Project layout

- `src/App.tsx`: responsive views, accessible native dialogs, entry forms, and local persistence.
- `src/domain.ts`: typed financial model, exact-cent parsing, reports, and CSV serialization.
- `src/domain.test.ts`: meaningful ledger and data validation tests.
- `src/styles.css`: mint palette, charts, savings rings, desktop sidebar, and mobile navigation.
- `vite.config.ts`: React and PWA production configuration.
- `.openai/hosting.json`: private Sites deployment identity and static output directory.

## Hosting

`npm run build` creates a static `dist/` directory. Deploy it to an HTTPS static host. The generated PWA service worker precaches the application assets. The included Sites configuration belongs to this project's deployment; remove its `project_id` before creating an independent Site from a fork.

## Next step: sync

A future release can add Supabase Auth, a PostgreSQL database, per-user row-level security, and explicit local-data migration. Do not put private service keys in this client app. Cloud sync and sign-in require a configured backend before they can work.
