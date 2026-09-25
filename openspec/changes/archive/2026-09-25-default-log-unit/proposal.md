## Why

Many foods are weighed every time they are eaten — a banana, a chicken breast, a bowl of rice is never the same size twice — yet picking one in the log form always starts at "1 serving", so every log of it means switching the unit to grams and typing the weight from scratch. Other foods (a slice of bread, a can of soda) really are counted, so the fix can't be a global switch: each food needs to say how it is usually logged.

## What Changes

- Each library food gains a **default logging unit**: its count label (today's behavior, and still the default) or any weight/volume unit its serving equivalence offers.
- A food's **default portion** is what its amount and unit start at: 1 of the count label, or — for a food that defaults to a measure unit — what one count equals in that unit (e.g. "1 banana = 118 g" starts at 118 g).
- Picking a food in the log form sets the amount and unit to its default portion (replacing whatever the form held). When that portion is a weight or volume, the amount field is **focused with its value selected**, so the first keystroke replaces it with the real reading. Counted foods don't move focus.
- The Food Library's add/edit form gets a "Default log unit" picker, offering the count label plus the units of the equivalence's dimension. The log form's "Edit nutrition" editor for a linked food offers the same picker and saves it back to the library food.
- A food captured from logging takes the unit it was first logged in as its default when that is a weight or volume unit (first logged as 130 g → weighed from then on), else its count label.
- Every other place that prefills a library food's portion without knowing the amount uses the default portion instead of "1 serving": an identify match with no usable weight, a bulk-photo row with no usable weight, a text-log match with no stated amount, and a new meal-builder row. Amounts those flows do know (a scale reading, "2 slices", "150 g") still win.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `serving-units`: Adds the per-food default logging unit and the default-portion rule it implies, including fallback when the equivalence no longer offers the stored unit.
- `food-library`: Library foods record a default logging unit; the library screen lets the user choose it; auto-capture seeds it from the first logged unit.
- `food-logging`: Picking a food starts the amount and unit at its default portion, focusing and selecting a weight/volume amount; "Edit nutrition" on a linked food also edits its default logging unit.
- `ai-food-identify`: A confident match with no usable weight starts at the food's default portion instead of 1 serving.
- `ai-bulk-photo-logging`: A review row with no usable weight starts at the food's default portion instead of 1 serving.
- `ai-text-logging`: A match with no stated amount (or grams the food can't take) starts at the food's default portion instead of 1 serving.
- `saved-meals`: New builder rows start at each food's default portion instead of 1 serving.

## Impact

- `supabase/schema.sql` — new nullable `foods.default_unit` column (checked against the nine measure units); must be applied in the dashboard **before** deploying, since every food insert/update writes it.
- `src/types.ts`, `src/storage/SupabaseRepository.ts` — `LibraryFood.defaultUnit` and its column mapping. `meal_suggestions()` is unchanged; the client resolves picked suggestions against the full library.
- `src/lib/units.ts` — default-unit resolution and default-portion helpers.
- `src/lib/validation.ts` — serving-definition form values carry the default unit; the food form parses it.
- `src/components/DefaultUnitField.tsx` (new), `src/screens/FoodsScreen.tsx`, `src/components/EntryForm.tsx`, `src/components/NumberInput.tsx` (forwards its ref), `src/state/AppState.tsx`.
- `src/components/BulkPhotoOverlay.tsx`, `src/api/logFromText.ts`, `src/components/MealBuilder.tsx` — prefill fallbacks.
- `food_entries` and the external OpenClaw write path are untouched; entries keep their own amount and unit.
