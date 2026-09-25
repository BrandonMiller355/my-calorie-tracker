## Context

See proposal.md — Why. Today every path that starts a library food's portion hard-codes "1 of the count label": `EntryForm.selectFood` sets only the unit (and leaves whatever amount the form held), and `BulkPhotoOverlay.prefillFields`, `resolveTextLogItems`, and `MealBuilder.seedComponent` each spell out the same fallback. Units a food can be logged in come from `availableUnits(anchor)`: the count label plus every unit of the equivalence's dimension.

Two constraints shape the approach:

- The name combobox's empty-field suggestions come from the `meal_suggestions()` RPC, which returns a fixed column list (no `image_path`, no `skip_macro_check`). A food picked from a suggestion row is therefore a partial `LibraryFood`; anything new on `foods` won't be on it either.
- The combobox blurs its own input after a tap-select so the phone keyboard dismisses. Mobile browsers (iOS Safari especially) only raise the keyboard for a programmatic `focus()` made while handling the user's gesture.

## Goals / Non-Goals

**Goals:**
- One rule, in one helper, for "what does this food's portion start at", used by every prefill path.
- A weighed food's pick lands with the amount focused and selected, so logging it takes typing the reading and nothing else.
- Robust to later anchor edits: a default the anchor no longer offers can never produce an invalid unit.

**Non-Goals:**
- Converting the amount when the user switches the unit select by hand (1 serving → g stays "1").
- Remembering the last unit a food was logged in; the default changes only when the user sets it (or when the food is first captured).
- Converting scale readings into the food's default unit (a read weight stays in grams).
- Teaching the OpenClaw write path about defaults; it keeps logging by serving count.

## Decisions

### Store a measure unit or null, never the label
`LibraryFood.defaultUnit?: MeasureUnit`, persisted as nullable `foods.default_unit`. `undefined`/`null` means "the count label". Storing the label text instead would silently break the moment the food's label is renamed ("slice" → "piece"); storing only measure units makes renames a non-event.

**Alternative considered — a boolean "weigh by default" using the equivalence's own unit:** one checkbox, but can't express "defined as 28 g per the package, weighed in oz", and reads oddly for volume foods. The select costs the same UI space and mirrors the log form's own unit picker option-for-option.

### Resolve against the anchor at read time; don't constrain it in SQL
`resolveDefaultUnit(unit, anchor)` returns the unit only if the anchor currently offers it, else `undefined` (count label). `defaultPortion(food)` builds on it: `{ 1, label }` or `{ equivalence converted to the unit, rounded to 2dp, unit }`. Every consumer goes through these, so a stale default (equivalence removed or switched to volume) degrades to counting instead of producing a unit the food can't be logged in. The pickers display the resolved value, so saving a form writes back exactly what was shown and cleans the stale value up.

The SQL column is only checked against the nine unit names, not against the equivalence's dimension. A cross-column check would turn a save from a stale browser bundle (which doesn't know to clear the default when editing the anchor) into a hard save failure, for no gain over read-time resolution.

### The picked food is resolved against the full library
`selectFood` looks the picked id up in `state.foods` before reading anything from it. Suggestion rows lack `default_unit` (like `image_path` today), and extending the RPC's return type would mean dropping and recreating the function in the dashboard. The library in state is complete and at least as fresh.

### Focus inside the gesture, select after render
When the start portion is a measure unit and came from the default (not from a scale reading or a text amount), `selectFood` calls `focus()` on the amount input synchronously — still inside the pick's click/Enter handler, so mobile keyboards open, and before the combobox's own post-pick `blur()` of the name field (which then becomes a no-op, avoiding a keyboard dismiss-and-reopen flicker). The text can't be selected at that point because the new amount hasn't rendered, so a counter state bump triggers a layout effect that calls `select()` after the commit writes the value. `NumberInput` becomes a `forwardRef` component for the input ref. Counted foods keep today's behavior: no focus change, keyboard dismisses.

**Alternative considered — `flushSync` then focus+select in the handler:** works, but forces a synchronous render mid-handler; the layout effect gets the same result declaratively.

### Capture seeds the default from the first logged unit
`AppState.addEntry`'s capture branch sets `defaultUnit: resolveDefaultUnit(entry.unit, entry)`: a food first logged in grams (validated to be a unit its anchor offers) is weighed from then on; one first logged by count keeps counting. This keeps the busy new-food form free of a second unit picker right next to the entry's own, and gets weighed foods right with zero extra taps. The Food Library form and the log form's "Edit nutrition" editor are the explicit controls for changing it.

**Alternative considered — show the default picker in the new-food form too:** two unit selects side by side ("Unit" for this entry, "Default log unit" for next time) invite confusion, and most users would leave it on the label, re-creating the original problem for every newly logged weighed food.

### Picking always resets the amount
`selectFood` now sets both amount and unit from the start portion. Previously it reset only the unit, so picking a second food carried the first food's amount over under the new count label ("150 serving"). Starting from the default portion makes the pick deterministic.

## Risks / Trade-offs

- [App deployed before the column exists → every food insert/update fails, since `toFoodRow` always writes `default_unit`] → Migration Plan step 1 runs first, same as `skip_macro_check`; the schema comment says so.
- [A one-off log of a new food by weight makes it default to weight] → Visible on the next pick (the amount is in grams) and fixable in one change on the library screen or under "Edit nutrition".
- [Unit conversion rounding: a default in another unit than the equivalence's, e.g. 28 g in oz, starts at 0.99 oz rather than exactly 1 serving] → It's a starting point meant to be typed over; for the common case (default in the equivalence's own unit) there is no conversion and no rounding.
- [Programmatic focus outside a gesture (an identify match that resolves after the network call) may not raise the mobile keyboard] → The field still has focus and selection; a tap on it re-selects via `NumberInput`'s touch handler, so nothing is worse than today.

## Migration Plan

1. In the Supabase dashboard, run the `default_unit` statement from `supabase/schema.sql`:
   `alter table foods add column default_unit text check (default_unit is null or default_unit in ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp'));`
2. Deploy the app. Existing foods read `null` and keep counting until a default is chosen.
3. Rollback: revert the app. The previous build selects `*` and ignores the extra column, and never writes it; the column can be dropped at leisure with no data loss elsewhere.
