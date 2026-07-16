## Why

Sometimes only a calorie estimate is known — a restaurant meal, a bite of someone else's food, a rough guess for a snack. Today every log goes through the food-name flow and is silently auto-captured into the food library, so one-off estimates pollute the library with junk foods (the previous workaround was a hand-made "Calories" library food, since archived). There is no way to log calories without creating or matching a library food.

## What Changes

- Add a fixed "Log calories only" action at the bottom of the name field's dropdown (below the existing "search online" and "use as new food" actions), available both when the field is empty and while typing.
- Selecting it switches the entry form into a quick-calories mode: a required calories input, optional carbs/protein/fat inputs, and an optional description input; no name, amount/unit, or serving fields.
- Quick entries are saved as normal `food_entries` rows named "Calories" with the entered macros (blank macros default to 0), a new `source` value `'quick'`, and the description stored on the entry itself (new `food_entries.description` column).
- Quick entries are **never** auto-captured to the food library — an explicit exception to the "Silent auto-capture on logging" requirement.
- The day log shows a quick entry as "Calories" with its description leading the secondary line, followed by the usual macro breakdown.
- Editing a quick entry re-opens the quick-calories form (calories + macros + description), not the full food form.
- One-off data cleanup: hard-delete the previously archived "Calories" food from the library table (after nulling any `food_id` references to it), since quick entries replace that workaround.

## Capabilities

### New Capabilities

- `quick-calorie-logging`: Logging a calories-only entry with an optional description — entry point in the name dropdown, the quick form, storage/display semantics, editing, and the no-library-capture guarantee.

### Modified Capabilities

- `food-library`: "Silent auto-capture on logging" gains an exception for quick entries; "Library-first name search" now offers a third fixed dropdown action ("log calories only") and offers the fixed actions in the empty-field state too.

## Impact

- **Schema** (`supabase/schema.sql`, applied manually via dashboard): add `food_entries.description text`; extend the `source` check constraint to include `'quick'`; one-off cleanup SQL for the archived "Calories" food (must null `food_entries.food_id` references first — the FK has no `on delete` clause).
- **Types** (`src/types.ts`): `FoodEntry` gains `description?` and `'quick'` in its `source` union.
- **Storage** (`src/storage/SupabaseRepository.ts`): map `description` in `toRow`/`fromRow`.
- **State** (`src/state/AppState.tsx`): `addEntry` skips the library-capture branch for `source: 'quick'`.
- **UI**: `src/components/FoodNameCombobox.tsx` (new fixed action), `src/components/EntryForm.tsx` (quick mode), `src/components/MealSection.tsx` (description as caption line).
