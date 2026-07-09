## Context

`EntryForm` (`src/components/EntryForm.tsx`) already has two independent editors that this change merges for the matched-food case:

- The serving-anchor editor (label + `= amount unit`), shown only via `showAnchorEditor = !editing && !matchedFood` — i.e. only when defining a food the library doesn't know yet. It writes into `anchorFields`, validated with `validateServingAnchor`.
- The "Edit nutrition" reveal (`nutritionOpen`), which for a matched/linked food only ever showed calories/macros and, per the archived `structured-serving-units` design (D7), was scoped to the current entry alone.

`FoodsScreen`'s `FoodForm` already does exactly what we want for a library food directly (name, description, anchor, nutrition, via `updateFood`). This change doesn't invent new persistence — it exposes a second entry point to the same `updateFood` call from inside `EntryForm`.

`state.foods` (`AppState.tsx`) only holds non-archived foods, so `foods.find(f => f.id === foodId)` already returns `undefined` for an archived or deleted food — the "no linked food" fallback path falls out of existing code for free.

## Goals / Non-Goals

**Goals:**
- "Edit nutrition" on a matched/linked food shows label + equivalence + nutrition (the same fields as the Foods screen edit form) and saves them to the `LibraryFood`.
- The food to update is resolved the same way the form already resolves `matchedFood` (live name match or carried `foodId`), so the behavior degrades correctly if the name no longer matches a library food.
- No change to entry snapshot semantics: the entry being saved still gets its own copy of nutrition/anchor, and every previously-logged entry (including other entries of the same food) is untouched.

**Non-Goals:**
- Renaming the library food from the entry form (the name field's existing auto-capture/matching behavior is unchanged).
- Any change to entries that have no linked library food (never captured, or the link points at an archived/deleted food) — these keep today's entry-only "Edit nutrition".
- Schema/migration changes — this is pure application logic reusing the existing `LibraryFood`/`updateFood` path.

## Decisions

### D1: Resolve the food to update from the live match, not the sticky `foodId` state

`matchedFood` is already computed each render as `foodId ? foods.find(...) : findFoodByName(foods, values.name)`. Use this same value (not the `foodId` state variable) to decide (a) whether to show the expanded anchor fields under "Edit nutrition", and (b) which `LibraryFood` to update on submit.

*Why:* keeps a single source of truth for "what food is this entry currently pointing at." If the user edited the name away from a match, `matchedFood` is naturally `undefined` and the form falls back to entry-only editing without special-case code.

### D2: Expand the "Edit nutrition" reveal to include anchor fields when a food is matched

Introduce `showLibraryAnchorEditor = nutritionOpen && !!matchedFood` (parallel to the existing `showAnchorEditor` for brand-new foods). When true, render the same label/equals/unit row used by `showAnchorEditor`, seeded from `matchedFood`'s anchor (falling back to the entry's own snapshot values only until the user picks/changes the food). Both anchor-editing states share the same `anchorFields`/`validateServingAnchor` plumbing; only one is ever active at a time (`showAnchorEditor` is for foods with no library match, `showLibraryAnchorEditor` is for foods with one).

*Why:* reuses the existing anchor-editing UI and validation instead of introducing a second implementation of the same fields.

### D3: On submit, push anchor + nutrition to the linked food in addition to saving the entry

When `matchedFood` is set and `nutritionOpen` is true, after the entry itself is saved (`addEntry`/`updateEntry`, unchanged), call `updateFood({ ...matchedFood, servingLabel, servingSize, calories, carbs, protein, fat })` with the values from the form. If `updateFood` fails, surface the existing `saveFailed` banner — the entry save already succeeded, so this mirrors the existing "auto-capture failure must not block the entry" tolerance (`food-library` capability) by not rolling back the entry, but does tell the user the library wasn't updated so they can retry.

*Why:* keeps the entry save (the thing the user is actually blocked on) as the primary action; the library write is best-effort follow-up, consistent with how auto-capture already treats library writes as secondary to the entry.

Alternative considered: gate the library write on the user having actually changed a value (diff against `matchedFood`). Rejected — an unnecessary optimization; writing the same values back is harmless and adds complexity for no user-visible benefit.

### D4: No linked food → keep today's entry-only behavior verbatim

When `matchedFood` is `undefined` (never captured, name edited away from a match, or the linked food was archived/deleted), "Edit nutrition" shows only the nutrition inputs, exactly as today, and no `updateFood` call is made.

*Why:* there's nothing to update; this is the existing, already-shipped fallback and needs no new code path.

### D5: Make the scope of "Edit nutrition" visible in the UI

Add a short inline note next to the revealed fields: "Updates your food library" when `matchedFood` is set, vs. no note (current behavior) when editing is entry-only. This is a one-line addition to the existing per-serving reference line.

*Why:* this is a behavior change from what shipped in `structured-serving-units` (where the same button was unconditionally entry-only); a silent scope change on an existing, familiar button is worth a small affordance so the user isn't surprised the next time they log that food. Alternative considered: a confirmation dialog on every save — rejected as too heavy for a reversible, low-stakes edit (the same tolerance the Foods screen edit already has, with no confirmation).

## Risks / Trade-offs

- [User expects "Edit nutrition" to stay one-off, as it behaved before this change] → mitigated by the D5 inline note; no other guardrail added, since the owner explicitly requested this reversal.
- [Two anchor-editing code paths (`showAnchorEditor`, `showLibraryAnchorEditor`) could drift] → both render the same JSX block parameterized on which `anchorFields`/handlers they bind to; share a single sub-component if the duplication becomes visible in the diff.
- [Entry's own displayed nutrition and the just-updated library food could momentarily disagree if `updateFood` fails after the entry saved] → the `saveFailed` banner already covers "your change was not stored"; extend its condition to include this follow-up call.

## Migration Plan

None. No schema change; existing `LibraryFood`/`FoodEntry` shapes and `updateFood`/`updateEntry` repository methods are reused as-is.

## Open Questions

None — the owner has already confirmed the entry-only fallback (D4) and accepted the historical-entries-unaffected guarantee.
