## Why

Logging food is repetitive: the same foods get re-entered by hand (or re-searched online) day after day, with every macro typed from scratch each time. A personal food library that populates itself from what the user logs makes repeat logging a one-tap action and gives frequently eaten foods a durable, editable home.

## What Changes

- New `foods` table in Supabase: a per-user food library storing name, description (brand / prep notes / weights), serving description, and per-serving macros, deduplicated on normalized name.
- The Name field in the add/edit food form becomes a combobox:
  - On focus (empty): shows the 3 most recently logged and 3 most used foods for the currently selected meal (deduped across the two groups).
  - On typing: client-side fuzzy match over name + description of the full library (loaded once per session).
  - Footer action rows: "Search online for '…'" (opens the existing search screen and returns to the form) and "Use '…' as a new food" (today's manual path).
- Selecting a library food pre-fills the form with its macros and serving description.
- Silent auto-capture: every logged food (manual or from online search) is upserted into the library. One-off macro tweaks made while logging do NOT overwrite an existing library row.
- New library management screen: list, create ("add food item"), edit, and archive library foods. Archived foods disappear from suggestions but are not hard-deleted.
- Snapshot semantics: entries keep their own copies of macros; editing a library food never rewrites past entries.
- `food_entries` gains a nullable `food_id` linking entries to library foods (powers per-meal recents/frequency).
- New `description` field visible in the picker as a secondary line and included in search matching.

## Capabilities

### New Capabilities

- `food-library`: Personal saved-foods library — auto-capture on log, picker suggestions (per-meal recents + most used), library-first search in the name combobox, and a management screen (create/edit/archive).

### Modified Capabilities

- `food-logging`: The add-entry form's name field becomes a library-backed combobox; selecting a library food pre-fills nutrition; entries record which library food they came from while keeping snapshot copies of macros.
- `food-search`: Online search becomes reachable from inside the add-entry form; returning with a selection must restore the in-progress form state (notably the selected meal).
- `data-persistence`: User-scoped persistence and RLS extend to the new `foods` table; storage interface gains library CRUD and suggestion queries.

## Impact

- **Database**: new `foods` table + RLS policies; `food_entries.food_id` column (nullable FK). Schema change applied via `supabase/schema.sql`.
- **Storage layer**: `StorageRepository` interface and `SupabaseRepository` gain food-library methods.
- **UI**: `EntryForm` name input replaced with combobox component; new library management screen with its own nav tab; `SearchScreen` return-navigation behavior extended.
- **State**: library loaded once per session into app state; auto-capture hook on entry add.
- No backfill or data migration of existing entries; no import tooling in this change.
