## Why

Some foods aren't just a name and a macro count — they're a short set of prep steps the user wants to remember (e.g. "cheesy mash": boil water, 53g powder, 7g salt, 10g cheese powder, 300g boiling water). Right now the only free-text field on a library food is `description`, which is meant for brand/prep-notes shorthand, not full step-by-step instructions, and there's no dedicated place to write or later reread them.

## What Changes

- Add an optional `recipe` field to library foods: free-text, multi-line, no structure or formatting requirements.
- Add a way to add/edit a food's recipe from two places, mirroring how `description` already works:
  - While defining a brand-new food in the entry form (the moment a food like "cheesy mash" is first logged).
  - From the Food Library screen's edit form, for any existing food, at any time.
- Add a collapsed-by-default way to view a food's recipe:
  - In the entry form, next to the existing description line shown when a library food is matched/selected — the "wait, how did I make this" moment.
  - In the Food Library screen's list, per food.
- Recipe is a food-library attribute only: it is never copied onto food entries (no snapshot), consistent with how `description` is already handled — editing a food's recipe changes nothing about entries already logged.

Out of scope: no integration with any external recipes app. That's an unbuilt idea with no shape yet, so this field is not designed to migrate into a link/reference — it's plain text.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `food-library`: library foods gain an optional `recipe` field (free text), a way to set/edit it from the entry form (new-food case) and the library management screen, and a collapsed view of it wherever a food is shown in those two places.

## Impact

- `supabase/schema.sql`: add nullable `recipe` text column to `foods` table.
- `src/types.ts`: add `recipe?: string` to `LibraryFood`.
- `src/components/EntryForm.tsx`: add/edit control next to Description (new-food branch), collapsed view next to the matched-food description line.
- `src/screens/FoodsScreen.tsx`: add/edit control in the food edit form, collapsed view in the food list.
- `src/lib/validation.ts`: include `recipe` in the food form values/parsing (no validation rules beyond optional free text).
- `src/storage/SupabaseRepository.ts`: read/write `recipe` on food create/update.
