## Why

Most foods enter the library through logging, not through the Food Library screen — the entry form silently captures any name the library doesn't recognize. But the photo control lives only on the library screen's add/edit form, so the single most common way a food is born is the one way it can never be born with a picture. The user has to log the food, then go find it in the library and edit it just to attach the photo.

The gap is sharpest in the identify-from-photo flow: the user has already taken a photo of the food, and when it turns out the library doesn't know that food, the photo is thrown away and the newly captured food is left blank.

## What Changes

- The Log Food form, while defining a brand-new food (not a quick calories-only entry, not editing an existing entry, no matched library food), offers the same attach / replace / remove photo control the add-food form has.
- A photo chosen there is held as a pending data URL and handed to the auto-capture path when the entry is saved, so the newly captured library food carries it. Abandoning the form, or removing the photo before saving, stores nothing.
- The control is withdrawn the moment the form stops defining a new food — selecting a library food, switching to quick calories, or clearing back to a matched name — and any pending photo is dropped with it, since there is no new food left to attach it to.
- When an AI estimate is accepted into the entry form, the analyzed photo seeds that pending photo, so a food identified from a photo the library didn't recognize keeps the photo it was identified from. The user sees it in the form and can remove or replace it before saving like any other pending photo.
- Photo upload stays non-blocking: the entry is logged and the food captured first, the image follows fire-and-forget, and a failed upload leaves the entry and the food intact with no photo.

Not changing: the bulk-photos flow, which by spec excludes unrecognized photos from logging entirely and so never captures a new food; and the Search screen's AI-analyze path, which navigates to a fresh form through a prefill that carries no image.

## Capabilities

### New Capabilities

None. This extends existing photo behavior to a flow that already exists.

### Modified Capabilities

- `food-library-photos`: the attach/replace/remove requirement is scoped to "the food form" (the library screen's add and edit forms); it extends to the entry form while that form is defining a new food.
- `food-library`: silent auto-capture on logging records name, nutrition, serving anchor, description, recipe and source; it also records a photo when the form has one pending.
- `ai-food-identify`: a no-match result currently attaches nothing and discards the photo. The photo instead travels with the no-match handoff, so a food captured from that estimate can keep it — identify itself still attaches nothing on its own.
- `ai-food-analysis`: accepting an estimate currently hands over name and nutrition only; it also hands over the analyzed photo when the estimate is accepted into an entry form that can hold it.

## Impact

- `src/components/EntryForm.tsx` — pending-photo state, the library form's photo/name/description head reused for the new-food state, the `PhotoCapture` overlay, clearing on match/quick/select, seeding from an accepted estimate, passing the data URL to `addEntry`.
- `src/state/AppState.tsx` — `NewEntryInput` gains an image field alongside `description`/`recipe`/`skipMacroCheck`; `addEntry`'s auto-capture branch uploads it through the existing `applyFoodImage` helper.
- `src/components/AiAnalyzeOverlay.tsx` — `onAccept` also reports the analyzed image.
- `src/components/IdentifyOverlay.tsx` / the no-match handoff — carries the photo through to the estimate.
- No schema, storage bucket, or repository changes: `uploadFoodImage`, the `image_path` column, and the private bucket already exist and are reused as-is.
- Styling adds nothing: the new-food state renders the library form's existing `food-edit-head` / `food-photo-col` / `food-edit-fields` structure, so the two forms match rather than approximate each other.
