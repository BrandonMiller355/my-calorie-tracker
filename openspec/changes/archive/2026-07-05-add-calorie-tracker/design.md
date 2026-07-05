## Context

Greenfield repo (no code yet). We are building a personal calorie/macro tracking SPA in React, per the proposal. Requirements live in the four capability specs: `food-logging`, `daily-summary`, `food-search`, `data-persistence`. Single user, single browser for V1; no backend of our own.

## Goals / Non-Goals

**Goals:**
- A working V1 SPA: log foods by day and meal, see totals vs. goals, search Open Food Facts, persist locally.
- Keep the storage layer swappable so a hosted DB (and later auth) can be added without a UI rewrite.
- Keep the food-data source pluggable enough that the future AI-photo feature can feed the same "prefill an entry" flow.

**Non-Goals:**
- AI photo recognition, user accounts, multi-device sync, hosted database, offline-first service worker, barcode scanning.
- Micronutrients beyond calories/carbs/protein/fat.

## Decisions

1. **Stack: Vite + React 18 + TypeScript.** Vite over Create React App (deprecated) and Next.js (no SSR/backend needed for a local-only SPA). TypeScript because nutrition math and storage schemas benefit from typed models.

2. **State: React context + reducer, no Redux.** App state is small (one day's entries, goals, search results). A `useReducer`-backed provider per domain (log, goals) is enough; adding Redux/Zustand now is overhead. Revisit if state grows.

3. **Persistence: IndexedDB via the `idb` library, behind a `StorageRepository` interface.**
   - Interface (async): `getEntriesByDate(date)`, `addEntry`, `updateEntry`, `deleteEntry`, `getGoals`, `saveGoals`.
   - `idb` over raw IndexedDB (ergonomics) and over localStorage (structured data, indexes, size limits). Entries store an index on `date` (string `YYYY-MM-DD`) to satisfy day-keyed retrieval.
   - A future `RemoteStorageRepository` implements the same interface against a hosted DB/API.
   - If `indexedDB.open` fails, fall back to an in-memory implementation of the same interface and surface a "data won't be saved" banner.

4. **Food search: Open Food Facts API, called directly from the browser.**
   - Endpoint: `https://search.openfoodfacts.org/search` (or v2 `/api/v2/search`); free, no API key, CORS-enabled — no proxy server needed. Alternatives considered: USDA FoodData Central (needs API key), Nutritionix/Edamam (paid tiers, keys in client are leakable).
   - Map responses to a local `FoodSearchResult` type (name, brand, per-100g and per-serving kcal/carbs/protein/fat where present). Missing nutrients map to `undefined`, never 0, per the `food-search` spec.
   - Debounce queries, cap at ~20 results, show loading/error/no-results states.

5. **Data model.**
   ```ts
   type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
   interface FoodEntry {
     id: string;            // uuid
     date: string;          // YYYY-MM-DD local date
     meal: Meal;
     name: string;
     servingDesc?: string;  // e.g. "1 cup (240 ml)"
     quantity: number;      // multiplier, default 1
     calories: number;      // per single serving; totals multiply by quantity
     carbs: number; protein: number; fat: number; // grams per serving
     source: 'manual' | 'search';
   }
   interface Goals { calories: number; carbs: number; protein: number; fat: number; }
   ```
   Dates are local-timezone calendar dates stored as strings to avoid UTC off-by-one-day bugs.

6. **Routing/screens: react-router with three routes.** `/` (day log + summary, with date navigation), `/search` (search screen; navigates back to a pre-filled entry form), `/settings` (goals). The add/edit entry form is a modal/panel within `/`.

7. **Testing: Vitest + React Testing Library.** Unit-test the totals math, quantity scaling, OFF response mapping, and the IndexedDB repository (via `fake-indexeddb`). Spec scenarios are the test checklist.

## Risks / Trade-offs

- [Open Food Facts data quality is uneven; many products lack macros] → Treat missing values as blank and force user confirmation (spec'd); prefer results that have complete nutriment data when ranking.
- [OFF API rate limits or downtime] → Debounce requests, handle failures with a manual-entry fallback path (spec'd); no hard dependency for logging.
- [IndexedDB data is device-local; clearing site data loses everything] → Acceptable for V1; storage abstraction is the mitigation path to a hosted DB. Consider a JSON export as a cheap follow-up.
- [Local-date string handling] → Centralize date formatting in one util and test around midnight/timezone edges.

## Open Questions

- Which hosted DB for V2 (Supabase vs. Firebase vs. small API + Postgres) — deferred; the repository interface is the contract.
- Whether quantity should support fractional servings input UX (slider vs. free text) — start with a numeric input, refine later.
