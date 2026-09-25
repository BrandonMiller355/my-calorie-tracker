## 1. Data model & persistence

- [x] 1.1 Add `default_unit text` (checked against the nine measure units, nullable) to `foods` in `supabase/schema.sql`, with a comment that it must be applied in the dashboard before deploying; verify the statement matches design.md's Migration Plan.
- [x] 1.2 Add `defaultUnit?: MeasureUnit` to `LibraryFood` in `src/types.ts`, documented as undefined = count label; verify `npm run typecheck` passes.
- [x] 1.3 Map the column in `SupabaseRepository` (`FoodRow.default_unit`, `toFoodRow` → `?? null`, `fromFoodRow` → `?? undefined`) and extend `SupabaseRepository.test.ts` to cover the write and read round-trip, including a suggestion row without the column.

## 2. Default-portion rules

- [x] 2.1 In `src/lib/units.ts` add `measureUnitsFor(anchor)` (and base `availableUnits` on it), `resolveDefaultUnit(unit, anchor)`, and `defaultPortion(food)`; verify with `units.test.ts` cases for a weighed default, a converted default (28 g → 0.99 oz), a counted food, a count-only food, and a stale default after a dimension change.

## 3. Library form

- [x] 3.1 Carry `defaultUnit` ('' = count label) in `ServingAnchorFormValues`, add a `liveServingAnchor` best-effort parse, and have `validateFoodForm` return the resolved `defaultUnit` (always as an own key, so it clears on update); verify in `validation.test.ts`.
- [x] 3.2 Add a shared `DefaultUnitField` ("Default log unit" select: count label + the live equivalence's units; disabled with a hint when there is no equivalence; a note of the starting portion when a measure unit is chosen).
- [x] 3.3 Use it in `FoodsScreen`'s add/edit form (seeded from the food, saved on create, update, and fork); verify with `FoodsScreen.test.tsx` cases for creating a weighed food, editing an existing food's default, options following the equivalence, and a stale choice saving as the label.

## 4. Log form

- [x] 4.1 Make `NumberInput` forward its ref; verify `NumberInput.test.tsx` still passes.
- [x] 4.2 In `EntryForm.selectFood`, resolve the picked food against the library, set amount + unit to the passed portion or the food's default portion, clear any stale AI-weight caveat, and for a measure default focus the amount synchronously and select it after render; route identify (grams or default) and text-log (resolved amount) through it. Verify with `EntryForm.test.tsx` cases: weighed pick is focused + selected at 118 g, counted pick stays 1 without focus, re-picking resets the portion, a suggestion row picks up the library's default, identify without weight uses the default, identify with weight does not move focus, editing an entry keeps its amount.
- [x] 4.3 Show `DefaultUnitField` in the "Edit nutrition" editor for a linked food and write the resolved default back with the anchor; verify with an `EntryForm.test.tsx` case that saving updates the library food's `defaultUnit`.
- [x] 4.4 Seed a captured food's `defaultUnit` from the logged unit in `AppState.addEntry`; verify with `EntryForm.test.tsx` cases for a new food logged in grams (captured with g) and by count (captured without a default).

## 5. Other prefill paths

- [x] 5.1 Use `defaultPortion` for a bulk-photo row without a usable weight (`prefillFields`); verify with a `BulkPhotoOverlay.test.tsx` case.
- [x] 5.2 Use `defaultPortion` for a text-log match with no stated amount or unusable grams (`resolveTextLogItems`); verify with `logFromText.test.ts` cases.
- [x] 5.3 Seed meal-builder rows with `defaultPortion` (`seedComponent`); verify with a `FoodsScreen.test.tsx` builder case for a weighed food.

## 6. Verify

- [x] 6.1 Run `npm test`, `npm run typecheck`, and `npm run build`; all pass.
- [x] 6.2 Drive the app (Vite dev server) in a browser against a stubbed Supabase backend, on desktop and phone touch emulation: picking a weighed food lands at its serving weight with the amount focused and selected, and typing replaces it.
