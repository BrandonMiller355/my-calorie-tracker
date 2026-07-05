## 1. Project Setup

- [x] 1.1 Scaffold Vite + React 18 + TypeScript app at repo root; verify dev server runs
- [x] 1.2 Add dependencies: react-router-dom, idb, uuid; dev deps: vitest, @testing-library/react, fake-indexeddb
- [x] 1.3 Define shared types (`Meal`, `FoodEntry`, `Goals`) and local-date util (`YYYY-MM-DD`, local timezone) with unit tests

## 2. Persistence Layer

- [x] 2.1 Define `StorageRepository` interface (getEntriesByDate, addEntry, updateEntry, deleteEntry, getGoals, saveGoals)
- [x] 2.2 Implement `IndexedDbRepository` with `idb` (entries store indexed by date; goals store) and tests via fake-indexeddb
- [x] 2.3 Implement `InMemoryRepository` fallback and startup detection when IndexedDB is unavailable, with a "data won't be saved" warning banner

## 3. Food Logging

- [x] 3.1 Create log state provider (context + reducer) that loads the selected day's entries through the repository
- [x] 3.2 Build day log screen (`/`): entries grouped by meal with per-meal calorie subtotals
- [x] 3.3 Build add/edit entry form with validation (reject negative/non-numeric values), quantity multiplier, and meal selection
- [x] 3.4 Implement delete entry with immediate list and totals update
- [x] 3.5 Unit-test quantity scaling and validation logic

## 4. Daily Summary & Goals

- [x] 4.1 Implement totals computation (calories, carbs, protein, fat) for the selected day, with tests
- [x] 4.2 Build summary component: consumed, goal, remaining per metric with distinct over-goal indication
- [x] 4.3 Build settings screen (`/settings`) for goals with persisted values and documented defaults (2000 kcal / 250 C / 100 P / 65 F)
- [x] 4.4 Add day navigation (prev/next buttons + date picker, default today) wired to log and summary

## 5. Food Search

- [x] 5.1 Implement Open Food Facts client: query endpoint, debounce, ~20-result cap, map response to `FoodSearchResult` (missing nutrients → undefined), with mapping tests
- [x] 5.2 Build search screen (`/search`): input, loading/no-results/error states, manual-entry fallback link
- [x] 5.3 Render result list with name, brand, and available kcal/macros per serving
- [x] 5.4 Wire result selection to the add-entry form: prefill values, leave missing macros blank and flagged for confirmation

## 6. Polish & Verification

- [x] 6.1 App shell: routing between log, search, settings; basic responsive styling
- [x] 6.2 Walk through every spec scenario end-to-end (log/edit/delete, reload persistence, goals, over-goal display, search fallbacks) and fix gaps
- [x] 6.3 Run full test suite and typecheck; update README with run instructions and V2 notes (hosted DB, AI photo lookup)
