# Design: structured-serving-units

## Context

Nutrition is stored per "1 serving" on both `LibraryFood` and `FoodEntry`, with a free-text `servingDesc` and a bare `quantity` multiplier (`src/types.ts`). Totals multiply nutrients by `quantity` (`src/lib/totals.ts`), and the `week_deficit_summary` SQL function does the same server-side (`supabase/schema.sql`). Open Food Facts mapping (`src/api/openFoodFacts.ts`) prefers per-serving nutrients and falls back to per-100g with `servingDesc = "100 g"`, forcing the user to compute fractional servings by hand (ate 45 g → type `0.45`).

The food library (auto-capture, dedupe on name, snapshot semantics) is the natural owner of a structured serving definition. Existing data is disposable — the project owner has waived migration.

## Goals / Non-Goals

**Goals:**
- LoseIt-style logging: pick an amount and a unit (weight, volume, or a customizable count label like "can (drained)").
- Library foods own the serving definition; entries stay self-contained snapshots.
- Per-100g/per-100ml OFF foods become directly loggable by weight/volume.
- Totals math and the deficit SQL stay untouched.

**Non-Goals:**
- Cross-dimension conversion (cups↔grams, density). A food's equivalence is weight *or* volume, never both.
- Multiple named units per food (e.g. both "slice" and "package"). One count label per food.
- Unit preferences/localization (the fixed unit set includes both metric and imperial).
- Any migration of existing rows.

## Decisions

### D1: Serving anchor = count label + optional single-dimension equivalence

A library food's nutrition remains "per 1 serving". The anchor makes that concrete:

```ts
type WeightUnit = 'g' | 'oz' | 'lb' | 'kg';
type VolumeUnit = 'ml' | 'floz' | 'cup' | 'tbsp' | 'tsp';
type MeasureUnit = WeightUnit | VolumeUnit;

servingLabel: string;                                  // default 'serving'; e.g. 'can (drained)'
servingSize?: { amount: number; unit: MeasureUnit };   // e.g. { 120, 'g' } → "1 can (drained) = 120 g"
```

*Why:* one anchor covers all three LoseIt cases — plain count (`label` only), weight-equivalent, volume-equivalent — without a food needing per-unit nutrition rows. Alternative considered: a list of named units each with its own gram weight (full LoseIt). Rejected as the expensive tier; the single anchor covers the actual use cases raised.

### D2: New pure module `src/lib/units.ts`; conversion via per-dimension base units

Weight converts through grams, volume through milliliters, with fixed factors (oz 28.3495, lb 453.592, kg 1000, floz 29.5735, cup 236.588, tbsp 14.7868, tsp 4.92892). Exports: unit constants/labels, `unitDimension(unit)`, `availableUnits(anchor)` (count label + same-dimension units when an equivalence exists), and `deriveQuantity(amount, unit, anchor)`:

- logged unit is the count label → `quantity = amount`
- logged unit is a measure → `quantity = toBase(amount, unit) / toBase(anchor.amount, anchor.unit)` (only offered when the anchor has an equivalence of that dimension, so the division is always well-defined)

*Why:* keeps conversion pure and unit-testable; `quantity` stays the single multiplier so `totals.ts` and the `week_deficit_summary` SQL are untouched.

### D3: Entries snapshot the anchor trio and the logged amount/unit; `quantity` is derived at save

`FoodEntry` drops `servingDesc` and gains:

```ts
amount: number;               // what the user typed, e.g. 45
unit: string;                 // MeasureUnit or the count label, e.g. 'g'
servingLabel: string;
servingSize?: { amount: number; unit: MeasureUnit };
quantity: number;             // derived once at save; unchanged role
```

Editing an entry resolves the unit picker from the entry's own snapshot, never the current library food, so a later library edit can't orphan an old entry's unit. `unit` is stored as text; a count-label unit is recognized by not being one of the nine measure units.

*Why:* full self-containment matches the existing snapshot requirement (library edits never change history). Cost: three extra columns. Alternative — look up the anchor via `foodId` at edit time — rejected: breaks after library edits/archival and for entries with no `foodId`.

### D4: Schema replaces free text with structured columns; apply by reset

`foods` gains `serving_label text not null default 'serving'`, `serving_size_amount numeric`, `serving_size_unit text` (check-constrained to the nine units; amount/unit both null or both set). `food_entries` gains `amount numeric not null`, `unit text not null`, plus the same three anchor columns. `serving_desc` is dropped from both, and `meal_suggestions` returns the new columns. `schema.sql` stays the declarative source of truth; since existing data is disposable, the change ships an `ALTER`/`drop`-based snippet to run once in the SQL editor rather than a data migration.

### D5: OFF mapping produces a structured anchor

Add `serving_quantity`, `serving_quantity_unit`, and `nutrition_data_per` to the requested fields. Mapping (`FoodSearchResult` drops `servingDesc`, gains `servingLabel` + `servingSize`):

- Per-serving nutrients present **and** `serving_quantity` parses with unit `g` or `ml` → anchor `1 serving = {qty} {unit}`.
- Per-serving nutrients present, no usable quantity → plain count anchor (label `serving`, no equivalence).
- Per-100g fallback → nutrients as-is with anchor `1 serving = 100 g`, or `100 ml` when `nutrition_data_per` is `100ml`.

*Why:* the fallback case turns today's hack into the headline feature — logging `45 g` directly. Unrecognized `serving_quantity_unit` values degrade safely to the count-only anchor.

### D6: Form UX — amount + unit picker; inline anchor definition for new foods

- The `Servings` input in `EntryForm` becomes `[amount][unit ▾]`. Selecting a library food (or search prefill) populates the picker from its anchor; the picker defaults to the count label with amount 1, so the zero-friction path is unchanged.
- When the typed name matches no library food (the auto-capture path), the form shows a compact serving definition row: label input (placeholder "serving") and optional `= [amount][unit ▾]` equivalence. Nutrition typed below means "per 1 <label>". The logging unit picker updates live from this in-form anchor, so "define 1 can (drained) = 120 g, then log 45 g" works in one pass.
- The Foods screen form replaces its `servingDesc` field with the same label + equivalence row.
- Validation (`src/lib/validation.ts`): `amount` > 0 (replacing `quantity`); equivalence amount > 0 when a unit is chosen; label defaults to "serving" when blank. Macro-calorie sanity check is unaffected (per-serving values, unscaled).

### D7: Nutrition inputs collapse behind "Edit nutrition" for known foods

For a known food (library selection, search prefill, editing an entry) the per-serving inputs are hidden; the form shows a live computed line (per-serving values × derived multiplier) plus a per-serving reference line, with an "Edit nutrition" action revealing the inputs. Editing there changes **this entry's snapshot only** — library edits stay on the Foods screen (owner decision 2026-07-06, diverging from LoseIt where the link edits the stored food). Inputs stay visible when defining a new food or when a search prefill has missing nutrients needing confirmation, and are labeled "per 1 <label>".

*Why:* removes the confusing state where per-serving calories (e.g. 210) sit under a logged weight (45 g) with no visible relationship; makes one-off tweaks deliberate rather than accidental; preserves the existing snapshot/tweak requirements unchanged.

## Risks / Trade-offs

- [OFF serving data is messy — `serving_quantity` missing, zero, or in odd units] → accept only positive quantities with unit `g`/`ml` (blank unit defaults to `g` per OFF convention); anything else degrades to a count-only anchor, which is today's behavior.
- [Count label collides with a measure unit name (user names a serving "g")] → forbid the nine reserved unit strings as labels in validation.
- [Duplicated anchor on food + every entry can drift after library edits] → intentional; drift is exactly the snapshot semantics the library spec already mandates.
- [Free-text `unit` column on entries can't be check-constrained to a closed set] → constrain to "one of the nine units OR equals the row's `serving_label`" in the table check.
- [Users lose the old free-form `servingDesc` note] → the library `description` field already covers prose notes; the label covers the structured case.

## Migration Plan

None (owner-approved). `schema.sql` is updated in place; a one-time SQL snippet (drop `serving_desc`, add new columns, recreate `meal_suggestions`) is run in the Supabase SQL editor. Existing rows may be truncated instead of altered if simpler.

## Open Questions

None — dimension scope (cheap tier), anchor snapshot on entries, and no-migration were all settled during exploration.
