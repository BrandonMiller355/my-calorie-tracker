## Context

Photos already work end to end: a private Supabase Storage bucket, an `image_path` column on `foods`, `uploadFoodImage` / `removeFoodImage` on the repository, signed-URL display through `FoodThumbnail`, and the `PhotoCapture` overlay for camera-or-file selection. The add-food form on the Food Library screen holds a chosen photo as a data URL and hands it to `addFood(input, imageDataUrl)`, which creates the food first and then uploads fire-and-forget.

What has no photo path is `addEntry`. Its auto-capture branch builds a `LibraryFood` from the entry's name, nutrition, serving anchor, description, recipe and source, and there is no image parameter anywhere in the chain. Since auto-capture is how most foods actually enter the library, that is the common case.

The decision of whether a food is even captured belongs to `addEntry`, not to the form: the form knows it has no `foodId`, but the name-to-library match is resolved inside `addEntry` against `state.foods`. So the form cannot call `addFood` itself; the photo has to ride along with the entry.

## Goals / Non-Goals

**Goals:**

- Give the entry form the same attach / replace / remove photo control the add-food form has, on exactly the occasions the form would capture a new library food.
- Carry a photo already in hand — the identify no-match photo, by way of the estimate handoff — into that control, so it survives instead of being discarded.
- Keep the upload non-blocking and keep every failure mode benign: the entry logs, the food captures, the photo is the only thing that can go missing.
- Reuse the existing photo pipeline, storage, and styling without adding a second way to do any of it.

**Non-Goals:**

- The bulk-photos flow. Per `ai-bulk-photo-logging`, unrecognized photos are excluded from logging and the AI-estimate fallback is explicitly not offered, so that flow never captures a new food and has nothing to attach.
- The Search screen's AI-analyze path. It navigates to a fresh entry form through router state; threading a base64 JPEG through history state is a different problem, and the in-form analyze path already covers the case that matters.
- Attaching a photo to a food the entry *matches*. That is the existing auto-attach behavior, already specified and implemented for identify and bulk; duplicating it here would create a second, differently-gated way to overwrite library images.
- Any schema, bucket, policy, or repository change.

## Decisions

### The photo rides on `NewEntryInput`, not a separate call

Add an image field to `NewEntryInput` beside `description`, `recipe`, and `skipMacroCheck` — the fields that already exist solely to seed a captured food and are stripped off the entry itself. `addEntry` consumes it in the capture branch only.

The alternative, having the form call `addFood` or `setFoodImage` itself, fails on the fact that the form does not know whether a capture will happen: `addEntry` resolves the name against the library. A form-side call would either duplicate that matching logic or risk attaching a photo to a food the user matched rather than created. Riding on the input keeps one decision in one place, and the existing three seed-only fields establish the pattern.

### The new-food state reuses the library form's head wholesale

The photo does not get a bespoke placement in the entry form. When the form is defining a new food it renders the same `food-edit-head` the library's add-food form uses — photo column on the left, name and description stacked beside it, each label directly over its own field.

A first attempt put a shrunken photo button in the existing name row, which was wrong twice over: it needed new CSS that fought the existing `.food-photo-add` rule on specificity, and it left the `Name` label sitting above the photo rather than above the field it names. Reusing the structure means the two forms match by construction instead of being kept in sync by hand, and adds no CSS at all. The name combobox is defined once and rendered by whichever head is showing, so the new-food and matched-food views cannot drift apart.

### Gate on the existing "defining a new food" flag

The form already derives `showAnchorEditor = !quick && !editing && !matchedFood` — precisely the condition under which the description and recipe fields are shown, and precisely the condition under which a capture will occur. Gate the photo control on that same flag rather than restating the condition. The control then sits with the fields it belongs to and cannot drift out of sync with them.

### Dropping the held photo is derived, not manual

A held photo must vanish when the form stops defining a new food. That can happen several ways: selecting a food from the dropdown, typing a name that comes to match an existing food, or switching to quick calories. Clearing it at each of those call sites invites the one that gets missed — and a missed one means silently attaching a photo to the wrong food, or worse, to a food the user only matched.

Instead, clear it from an effect keyed on the gate flag going false, so every route into a matched or quick state drops the photo by construction. `selectFood` already resets `description`, `recipe`, and the recipe disclosure; the effect covers it and the typed-match case together.

### `onAccept` widens; `FoodSearchResult` does not

The analyze overlay reports its accepted estimate as a `FoodSearchResult`. Adding the image to that type would push a base64 JPEG into the Search screen's router navigation state, where it would be serialized into history — for a path this change explicitly does not serve. Pass the image as a second `onAccept` argument instead, which the Search screen ignores and the entry form uses to seed its held photo.

### Upload stays exactly as fire-and-forget as it is today

`applyFoodImage` in `AppState` already does the create-then-upload dance for `addFood`, including invalidating the cached signed URL and swallowing failures. The capture branch of `addEntry` calls the same helper after its `food-added` dispatch. No new error path, no new blocking await, and the entry save is untouched by anything the image does.

## Risks / Trade-offs

- **A held photo attaches to the wrong food** if the clearing logic misses a transition → the derived effect above makes "stopped defining a new food" a single condition rather than a list of call sites; the spec pins the dropdown-selection case as its own scenario.
- **The photo is lost when auto-capture fails** — the entry saves, the food does not, so there is nothing to attach → accepted, and specified. Auto-capture failure is already a silent best-effort path; the photo is no worse off than the description and recipe, which are lost the same way.
- **The user attaches a photo, then the name turns out to match an existing food on save.** The form's own matching runs live against the same `state.foods`, so the control would already have been withdrawn — but a food created in another tab between typing and saving could slip through → `addEntry` only uses the image in its capture branch, so a late match simply ignores it. Nothing is uploaded and no existing food is touched.
- **Holding a data URL in form state** costs memory for the life of the form, bounded by the shared pipeline's 1024px long edge → the add-food form already does exactly this; no new exposure.
- **The identify no-match photo now survives a flow that previously discarded it**, which is a real change in what can persist → it persists only via a food the user explicitly saved, is visible in the form before saving, and is removable there. Both the identify and analysis specs are amended rather than left to imply the old guarantee.
