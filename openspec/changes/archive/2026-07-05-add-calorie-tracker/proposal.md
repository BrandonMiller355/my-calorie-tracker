## Why

There is no easy, personal way for the user to track daily calories and macros without the bloat and paywalls of apps like LoseIt or MyFitnessPal. This change bootstraps a React web app that logs foods with calories, carbs, protein, and fat, and lets the user find foods via a web-backed search.

## What Changes

- Scaffold a new React (Vite + TypeScript) single-page web app in this repo.
- Add food logging: add/edit/delete food entries per day, grouped by meal (breakfast, lunch, dinner, snacks), each with calories, carbs, protein, and fat.
- Add a daily summary view: totals for calories and each macro for the selected day, with user-configurable daily goals and remaining amounts.
- Add food search: a search screen that queries a public food database API (Open Food Facts) and returns selectable results; selecting a result pre-fills a log entry with its nutrition data.
- Add persistence behind a storage abstraction, implemented with browser IndexedDB in V1 so data survives reloads. The interface is designed so a hosted database backend can be swapped in later without touching UI code.
- Out of scope for V1 (future change): AI photo recognition of foods, user accounts/auth, and a hosted server-side database.

## Capabilities

### New Capabilities
- `food-logging`: Creating, editing, and deleting food entries for a given day, grouped by meal, each carrying calories, carbs, protein, and fat.
- `daily-summary`: Per-day totals of calories and macros, daily goals, and remaining-vs-goal display; navigation between days.
- `food-search`: Searching an external food database from a search screen, presenting selectable results with nutrition data, and handing the selection off to food logging.
- `data-persistence`: Durable local storage of entries and goals via a storage interface that permits a future remote database implementation.

### Modified Capabilities

None — this is a greenfield project with no existing specs.

## Impact

- New codebase: Vite + React + TypeScript app created at the repo root (`src/`, `package.json`, etc.).
- New external dependency: Open Food Facts public search API (no API key required); the app must handle its unavailability gracefully.
- Browser storage: IndexedDB used for persistence; data is per-browser until a hosted DB is added in a later change.
- No existing code, APIs, or systems are affected.
