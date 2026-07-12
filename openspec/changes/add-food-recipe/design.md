## Context

Library foods (`foods` table) already carry an optional `description` field (brand, prep notes — one line) that's editable from two places (the entry form's new-food branch, and the Food Library screen's edit form) and shown wherever the food appears. Recipe instructions are a similar per-food, non-nutritional attribute, but longer-form (multi-line steps) and read for a different reason: not "what is this" but "how do I make this again."

## Goals / Non-Goals

**Goals:**
- Let the user attach free-text prep instructions to a library food.
- Let them add it at the moment they first define a new food, or later from the library screen.
- Let them find it again easily right when they're about to log/cook the food.

**Non-Goals:**
- No structure, formatting, ingredient lists, or step parsing — it's a single free-text blob.
- No integration with any external recipes app or link/URL field reserved for one. That app doesn't exist yet; if it's built later, this field can be revisited then without cost paid now.
- No snapshotting onto `food_entries` — same treatment as `description`.

## Decisions

- **Column placement**: `recipe` lives on `foods`, nullable text, no default. Same table, same nullability pattern as `description`. Rejected: a separate `food_recipes` table — unnecessary normalization for a single optional text field with no independent lifecycle.
- **Not snapshotted on entries**: recipe is descriptive metadata about the food, not something that affects what was eaten or its nutrition. Editing a recipe changes nothing about history, exactly like editing `description` today.
- **Collapsed by default wherever shown**: unlike `description` (one line, always visible), recipe text can be long, so both read surfaces (entry form's matched-food area, Food Library list) hide it behind a "View recipe" disclosure rather than showing it inline.
- **Write surface mirrors `description`'s two entry points** rather than inventing a third (e.g. a standalone "recipes" screen), keeping the mental model the user already has for food metadata: set at food-creation time, or edit later from the library.

## Risks / Trade-offs

- [Long recipe text making the Food Library list feel cluttered even when collapsed] → Collapsed disclosure defaults to closed; only the toggle control adds to row height.
- [Recipe field encourages scope creep toward structured recipes later] → Explicitly out of scope per Non-Goals; free text only, revisit only if the external recipes app becomes real.
