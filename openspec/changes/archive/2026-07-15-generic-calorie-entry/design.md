## Context

Every log today flows through `EntryForm` → `AppState.addEntry`, which auto-captures unknown names into the `foods` library (`AppState.tsx` ~289–328) — a documented requirement ("Silent auto-capture on logging"). Entries snapshot all nutrition and carry only an optional soft link `food_id`; they have no description column (`description` on the form only seeds the captured library food). The name dropdown (`FoodNameCombobox`) renders library groups first, then a fixed `actions` footer — currently "search online" and "use as new food". The user previously faked quick logging with a hand-made "Calories" library food, now archived; `foods` has a unique index on `(user_id, lower(trim(name)))` and `food_entries.food_id references foods(id)` with no `on delete` clause.

## Goals / Non-Goals

**Goals:**
- One-tap path to log a calorie estimate with optional macro estimates and an optional free-text description.
- Quick entries never touch the food library (no capture, no match, no link).
- Quick entries behave like normal entries everywhere else: meal grouping, day totals, weekly deficit, edit, delete.

**Non-Goals:**
- Adding a description to non-quick entries' display or edit flows (the column exists, but only quick entries read/write it for now).
- Any change to serving-form UX for normal foods.

## Decisions

### 1. Model quick entries as ordinary `food_entries` rows with `source: 'quick'`

Fixed field values: `name: "Calories"`, `amount: 1`, `unit: 'serving'`, `servingLabel: 'serving'`, no `servingSize`, `quantity: 1`, no `foodId`, plus the entered `calories`, the entered `carbs/protein/fat` (blank inputs default to 0), and optional `description`. With `quantity: 1`, entered values are the entry's contribution as-is.

- *Why*: totals, meal grouping, persistence, and delete work unchanged. `MealSection` already hides the quantity caption when `amount === 1 && unit === servingLabel`, so quick entries get a clean row for free.
- *Why `source: 'quick'` rather than a boolean flag*: `source` already discriminates entry origin (`'manual' | 'search'`); the value doubles as the marker that (a) skips capture in `addEntry` and (b) routes editing back to the quick form. Requires extending the DB check constraint.
- *Alternative rejected*: a nullable-name "calories-only" entry shape — would ripple through every consumer of `entry.name`.

### 2. Skip capture in `AppState.addEntry` when `source === 'quick'`

Guard the whole capture/match/link branch. No `findFoodByName` call either — even if the user someday creates a library food named "Calories", quick entries must not link to it.

### 3. New `food_entries.description text` column

Stored on the entry itself (unlike normal entries, where the form's description seeds the library food). `toRow`/`fromRow` map it unconditionally; non-quick entries just leave it null. Update the schema comment at `schema.sql:144` that claims description is never snapshotted onto entries.

- *Alternative rejected*: overloading `name` with the description text — breaks the "Calories" identity, dedup-style grouping in the UI, and edit-mode detection.

### 4. Entry point: third fixed action in `FoodNameCombobox`

Add "Log calories only" as the last item of the `actions` footer so it always renders at the bottom of the dropdown — in the empty-field suggestions state and while typing. Today `EntryForm` passes actions only in the typing state, so the empty state gains the fixed-actions footer (at minimum the quick action; design keeps all fixed actions visible in both states for consistency — the search/new-food actions still require typed text, so only the quick action shows when the query is empty).

- *Alternative rejected*: a standalone button on the day log or meal section — more surface area, and the user asked for it at the bottom of the list.

### 5. Quick mode inside `EntryForm`, not a separate form component

Selecting the action flips `EntryForm` into quick mode: meal selector and date stay, name field is replaced by a static "Calories" label, and the body shows a calories input (required), carbs/protein/fat inputs (optional, blank = 0), and a description text input (optional) — all nutrition inputs use the same validation as normal entries. No amount/unit, serving, recipe, or "Edit nutrition" UI. Editing an entry with `source === 'quick'` opens the form directly in quick mode.

- *Why*: reuses meal/date handling, submit plumbing, validation, and the modal shell; a separate component would duplicate all of it.

### 6. Day-log display: description leads the caption line

In `MealSection`, when `entry.source === 'quick'`, the caption shows the description (when present) in the slot where the quantity segment normally appears, followed by the usual `F · C · P` macro breakdown. Since macros can now be real estimates, the macro line stays; calories display is unchanged.

### 7. One-off cleanup of the archived "Calories" library food

Hand-run SQL in the Supabase dashboard (consistent with how schema changes are applied): null out `food_entries.food_id` for entries referencing archived foods named "Calories" (FK has no `on delete` clause, so this must come first), then delete those `foods` rows. Past entries keep their snapshots, so history is unaffected. This is user-data cleanup, not an app feature — the "archived foods MUST NOT be deleted" requirement governs the archive feature, not manual maintenance.

## Risks / Trade-offs

- [Check-constraint change requires manual SQL] → schema.sql is already applied by hand via the dashboard; tasks include the exact `alter table` statements (drop/re-add the `source` check, add `description`). Deploying app code before the SQL would make quick-entry saves fail — run SQL first.
- [Other read paths render "1 serving" phrasing for quick entries] → acceptable; the day-log caption (the main surface) is handled, macros display like any entry, and nothing crashes on an unknown `source` value.
- [User types a food actually named "Calories" via the normal flow] → after cleanup the unique index no longer collides; a genuine library food named "Calories" could then coexist with quick entries (they never link to it). Confusing but harmless and self-inflicted.

## Migration Plan

1. Run the schema SQL (add column, widen check constraint) in the Supabase dashboard.
2. Ship app code.
3. Run the one-off archived-"Calories" cleanup SQL.

Rollback: the column and constraint widening are backward-compatible with the old app; reverting app code is sufficient.
