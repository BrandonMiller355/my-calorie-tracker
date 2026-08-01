## Context

See proposal.md — Why. The mismatch check lives in [macroCheck.ts](../../../src/lib/macroCheck.ts) and is invoked by `confirmMacroMismatch` in [EntryForm.tsx](../../../src/components/EntryForm.tsx) via a native `window.confirm`. Two constraints shape the approach:

- The warning is a native `window.confirm` — it cannot host a checkbox. So "never show again" must be inferred from the existing OK/Cancel outcome, not from new dialog UI.
- Auto-capture of a brand-new library food happens **downstream** in `AppState.addEntry` (it builds the food from the entry input and calls `repository.addFood`), not in `EntryForm`. At the moment the confirm fires, `EntryForm` does not hold the id of a food that will only be created during the save.

`EntryForm` already computes `matchedFood` (the linked library food, by carried `foodId` or current name match) and already updates a linked food in place for the "Edit nutrition" flow (`updateFood({ ...matchedFood, ... })`). That gives a clean home for the existing-food case.

## Goals / Non-Goals

**Goals:**
- Suppress the mismatch warning permanently, per library food, once the user saves that food anyway.
- Get it right on the **first** save even when the food is brand new (captured during the same save).
- No new dialog UI: keep the native `window.confirm`.

**Non-Goals:**
- No checkbox or custom modal.
- No change to the mismatch math or tolerance in `macroCheck.ts`.
- No suppression for quick calories-only entries (they never link a food).
- No management-screen toggle to flip the flag by hand (could come later; not needed for the "save anyway" flow).

## Decisions

### The flag lives on the library food (`foods`), never the entry
A per-item preference must survive across logs, and every log of the same food resolves to one `foods` row. Storing it on `food_entries` would reset it every log. New column `skip_macro_check boolean not null default false` on `foods`, mirrored as `skipMacroCheck?: boolean` on `LibraryFood`, mapped in `SupabaseRepository`'s `toFoodRow`/`fromFoodRow`. Default false so existing rows keep warning until opted out.

### Read: skip the dialog from `matchedFood`
`confirmMacroMismatch` returns `true` (proceed, no dialog) when `matchedFood?.skipMacroCheck` is set. This covers logging an existing food and editing an entry linked to one, because `matchedFood` already resolves both via `foodId`/name.

### Write: set the flag on "Save anyway", by the food's provenance
On the confirm's OK branch the code records intent to flag, then persists it two ways depending on whether the linked food already exists:
- **Existing linked food** (`matchedFood` present): after the entry saves, call `updateFood({ ...matchedFood, skipMacroCheck: true })` — the same in-place update the anchor editor already uses. Skip the write if the flag is already set.
- **Brand-new food captured this save** (no `matchedFood`): thread `skipMacroCheck: true` into `addEntry` as a capture seed alongside the existing `description`/`recipe` seeds. `AppState.addEntry` sets it on the food it builds before `repository.addFood`.

Threading a seed (rather than doing nothing for new foods) is what makes the first save correct. Auto-capture already carries seed-only fields, so this is idiomatic and low-cost.

**Alternative considered — accept a second warning:** only handle the existing-food case; a brand-new mismatched food would warn again on its second log (now matched) and be flagged then. Simpler (no `addEntry` change) but violates "never show again" on the first log for exactly the foods this feature targets (a newly added beer). Rejected for the small extra plumbing.

**Alternative considered — centralize the flag write inside `addEntry` for both cases:** would make `addEntry` update an existing food, breaking its standing invariant that "existing foods are never updated from the log form." Kept the existing-food write in `EntryForm` (where the anchor-editor update already lives) to preserve that invariant; `addEntry` only ever *sets the seed on a food it is already creating*.

### Quick entries unaffected
The `quick` branch never links a food and never seeds capture, so no flag is read or written there. `confirmMacroMismatch` still shows the warning for a mismatched quick entry every time — matching the spec's "never suppressed for quick entries."

## Risks / Trade-offs

- [Editing a food's nutrition so macros later reconcile leaves the flag set] → Harmless: a reconciling food wouldn't trip the check anyway, so a stale `true` flag is inert. Not worth resetting.
- [A capture failure on a brand-new "save anyway" food means the flag isn't persisted] → Same best-effort semantics as today's auto-capture: the entry still saves; the next successful log of that name captures and (on the next "save anyway") flags it. No worse than current capture behavior.
- [Column added before code deploy] → A default-false column is backward compatible: old app code ignores it, new code reads false for un-opted rows. Standard order (schema first, then deploy).

## Migration Plan

1. Apply the schema change in the Supabase dashboard: `alter table foods add column skip_macro_check boolean not null default false;`
2. Deploy app code that maps and uses the column.
3. Rollback: dropping the column or reverting the app both degrade to "warn every time"; no data migration needed since the flag is purely advisory.
