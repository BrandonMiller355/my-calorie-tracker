## Why

"Edit nutrition" in the add/edit-food entry form only lets the user tweak a serving's label and weight/volume equivalence when defining a brand-new food. For a food that already exists in the library, the entry form only exposes nutrition value edits (calories/macros), scoped to that one entry — there's no way to add or fix a serving weight equivalence (e.g. "1 can = 120 g") or a custom serving unit without leaving the entry form and going to the Food Library screen. Since the library owns the serving anchor, this is a gap in the one flow (logging) that's actually where users notice the anchor is wrong or missing. Owner has decided (2026-07-09) to let "Edit nutrition" edit the linked library food directly, reversing the entry-only-scoped decision made in the archived `structured-serving-units` change (D7), which was explicitly flagged there as provisional.

## What Changes

- When "Edit nutrition" is revealed for an entry linked to an existing library food (a new entry matched to a library food by name/selection, or an existing logged entry that has a `foodId`), the revealed fields expand to include serving label and weight/volume equivalence, matching the Food Library screen's edit form — not just calories/macros.
- Saving from that expanded "Edit nutrition" state updates the linked `LibraryFood` (name, anchor, and nutrition) in addition to saving the current entry, so future logs of that food pick up the change immediately. **BREAKING** (behavioral): this replaces the "one-off tweak does not overwrite the library" behavior for this specific path.
- Entries logged **before** this edit are unaffected — they already store their own snapshot of nutrition and serving anchor and are never re-read from the library food.
- When an entry has no linked library food (a manual entry that was never captured, or a food that's since been archived/deleted), "Edit nutrition" keeps today's behavior: nutrition-only fields, changes apply to this entry alone.
- Defining a brand-new food (name matches nothing in the library) is unchanged: the inline serving-definition + nutrition inputs behave as they do today and the new food is auto-captured on save.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `food-logging`: the "Computed nutrition display" requirement changes — "Edit nutrition" on a library-linked entry now exposes the serving anchor fields and, on save, updates the linked library food rather than being entry-only.
- `food-library`: the "Silent auto-capture on logging" requirement's guarantee that matched-food edits never modify the library food no longer holds when the edit came through the expanded "Edit nutrition" flow; the "Library management" requirement gains a second entry point (the entry form) that can update a food's anchor and nutrition, alongside the existing Food Library screen.

## Impact

- `src/components/EntryForm.tsx`: reveal serving-anchor fields under "Edit nutrition" for matched/linked foods; resolve the food to update from the live name match, not just the sticky `foodId` state; call `updateFood` alongside `addEntry`/`updateEntry`.
- `src/state/AppState.tsx`: `addEntry`/`updateEntry` callers need a way to also push an anchor+nutrition update to the linked `LibraryFood` (likely reusing the existing `updateFood`).
- `src/lib/validation.ts`: reuse `validateServingAnchor`/`validateFoodForm`-style validation for the expanded fields instead of the entry-only nutrition validation.
- Specs: `openspec/specs/food-logging/spec.md`, `openspec/specs/food-library/spec.md`.
