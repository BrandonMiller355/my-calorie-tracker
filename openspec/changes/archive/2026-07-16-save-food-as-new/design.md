## Context

`FoodForm` in `src/screens/FoodsScreen.tsx` serves both create and edit, switching on an optional `editing: LibraryFood` prop. On submit it validates, rejects a normalized-name collision with any food other than `editing`, then calls `updateFood` when editing and `addFood` otherwise. Save mode is therefore currently a property of *how the form was opened*, and the change makes it a property of *what the user clicks*.

The library deduplicates on normalized name (food-library, "Personal food library"). That constraint does most of the design work here: a fork can only ever exist under a different name, so the name field is already the signal that distinguishes "rename this food" from "spin off a new one". Nothing new needs to be invented to represent user intent — it needs to be read off state that already exists.

## Goals / Non-Goals

**Goals:**

- Let the user start from a saved food and fork it into a new library food without retyping its fields.
- Keep every existing edit-form behavior intact, renaming in place included.
- Keep intent explicit: a diverged name offers the fork, it never imposes it.

**Non-Goals:**

- The entry form's "Edit nutrition" library-update flow (food-logging capability) — untouched.
- A "Duplicate" action on the library list row.
- Any change to archiving, snapshot semantics, or the serving anchor form.

## Decisions

**Gate the fork action on name divergence, not on a mode toggle or a row-level Duplicate button.**
The dedup rule makes a same-name fork unsaveable, so a permanently visible "Save as new food" would be dead on arrival in the exact state the form opens in — the user's first click would earn a validation error explaining a rule they had no reason to know. Revealing the action when the name changes means it appears precisely when it can succeed, and its meaning is legible from the two names on screen. Alternative considered: a "Duplicate" button on each library row opening a pre-seeded create form. It is more discoverable but adds a second entry point to one flow, and it must invent a seed name (`"PB&J (copy)"`) that the user then has to clear. Deferred, not rejected — the reveal path can coexist with it later.

**Keep "Save changes" primary and always enabled; add "Save as new food" as secondary.**
Renaming a food in place is a real, existing use (fixing a typo), and a diverged name must not silently become a fork. With both actions present once the name changes, the fork is opt-in and the destructive-ish default stays where the user already expects it.

**Branch on an explicit save mode passed from the clicked button, rather than re-deriving intent inside `handleSubmit`.**
`handleSubmit` currently reads `editing` twice: once to exempt the food from the duplicate check, once to pick `updateFood` vs `addFood`. Those two uses come apart under this change — a fork must run `addFood` *and* be checked against every food including `editing`. Threading an explicit mode (`'update' | 'create'`) from the button keeps the two decisions from drifting: the fork path exempts nothing, the update path exempts `editing.id` as today. Deriving the mode implicitly from `values.name !== editing.name` inside the handler would work but re-computes a fact the click already established, and would make "Save changes" after a rename ambiguous.

**Reuse the existing collision error verbatim.**
A fork colliding with a *third* food is the same user error as a rename colliding with it, and it already has a field-level message on `name`. No new error surface.

## Risks / Trade-offs

**The fork is undiscoverable for a user who never renames** → Accepted for now, and cheap to reverse: the "Duplicate" row button lands on top of this same form with no rework of the save paths. Revisit if the flow goes unused.

**Two adjacent buttons that both say "Save" invite a misclick, and a fork misread as an in-place rename leaves a food the user thinks they renamed** → Distinct labels ("Save changes" vs "Save as new food") and secondary styling on the fork. The blast radius is small in either direction: no data is lost, and the unwanted food can be archived or the rename redone.

**Name-divergence check must match the dedup rule's notion of sameness** → Compare on the same normalized (trimmed, case-insensitive) form the library dedupes on, via the existing matching helper rather than a fresh `===`. Otherwise trailing whitespace or a case tweak reveals a fork action that validation then rejects as a duplicate of the very food being edited.
