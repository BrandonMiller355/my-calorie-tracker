# Cal Tracker

A personal calorie and macro tracking web app (calories, carbs, protein, fat) — a lightweight take on LoseIt / MyFitnessPal. Built with React 18 + TypeScript + Vite.

## Features

- **Daily food log** — add, edit, and delete entries grouped by meal (breakfast, lunch, dinner, snacks) with per-meal calorie subtotals.
- **Daily summary** — totals vs. configurable goals for calories and each macro, with remaining amounts and a clear over-goal indicator. Defaults: 2000 kcal, 250 g carbs, 100 g protein, 65 g fat (change them in Settings).
- **Food search** — searches the free [Open Food Facts](https://world.openfoodfacts.org/) database; selecting a result pre-fills the entry form. Missing nutrients are left blank and flagged for you to confirm — never silently treated as zero.
- **Day navigation** — previous/next day buttons and a date picker; defaults to today.
- **Local persistence** — data is stored in your browser's IndexedDB and survives reloads. If IndexedDB is unavailable, the app still works in-memory and warns you.

## Getting started

```sh
npm install
npm run dev       # start dev server
npm test          # run test suite (vitest)
npm run build     # typecheck + production build
npm run preview   # serve the production build
```

## Architecture notes

- All persistence goes through the `StorageRepository` interface ([src/storage/StorageRepository.ts](src/storage/StorageRepository.ts)). UI code never touches IndexedDB directly, so a hosted database backend can be swapped in later by adding another implementation.
- Dates are local-timezone `YYYY-MM-DD` strings throughout to avoid UTC off-by-one-day bugs.
- Nutrition values on an entry are per single serving; totals multiply by the `quantity` field.

## Roadmap (not in V1)

- **Hosted database + sync** — swap `IndexedDbRepository` for a remote implementation (Supabase/Firebase/own API) behind the same interface; add accounts.
- **AI photo lookup** — snap a picture of a meal and have AI estimate calories and macros, feeding the same "pre-fill an entry" flow the search screen uses.
- JSON export/backup of local data.
