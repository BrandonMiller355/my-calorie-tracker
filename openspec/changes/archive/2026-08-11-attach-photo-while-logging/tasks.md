## 1. Carry the photo through the state layer

- [x] 1.1 Add an optional `imageDataUrl` to `NewEntryInput` in `src/state/AppState.tsx`, destructured off the entry alongside `description`/`recipe`/`skipMacroCheck`, and update the type's doc comment to name it as another capture-only seed field
- [x] 1.2 In `addEntry`'s auto-capture branch, after the `food-added` dispatch, call the existing `applyFoodImage(food, imageDataUrl)` fire-and-forget when an image was supplied — leaving the entry save unawaited by it
- [x] 1.3 Confirm the quick-entry early return and the matched-food branch both ignore the image, so no existing library food can be touched
- [x] 1.4 Verify no repository, schema, bucket, or storage-policy change is needed — `uploadFoodImage`, the `image_path` column, and the private bucket are reused as-is

## 2. Photo control in the entry form

- [x] 2.1 Add `pendingPhoto` and `capturingPhoto` state to `src/components/EntryForm.tsx`
- [x] 2.2 Render the photo control in the name-field row, gated on the existing `showAnchorEditor` flag: the 📷 add button when nothing is held, a `PhotoThumbnail` preview with replace/remove actions when a photo is held — reusing the `food-photo-*` classes from the add-food form
- [x] 2.3 Confirm the control and the existing `matchedFood?.imagePath` thumbnail are mutually exclusive by construction, so the row never shows both
- [x] 2.4 Render the `PhotoCapture` overlay on `capturingPhoto`, setting `pendingPhoto` on capture (no upload at this point)
- [x] 2.5 Clear `pendingPhoto` from an effect keyed on `showAnchorEditor` going false, so selecting a library food, typing a name that comes to match, and switching to quick calories all drop it without per-call-site clearing
- [x] 2.6 Pass `pendingPhoto` to `addEntry` in the non-quick, non-editing save path
- [x] 2.7 Add any CSS needed to place the control in the entry form's name row

## 3. Carry the analyzed photo into the form

- [x] 3.1 Widen `AiAnalyzeOverlay`'s `onAccept` to report the analyzed image alongside the result, without adding it to `FoodSearchResult`
- [x] 3.2 Seed `pendingPhoto` from that image in the entry form's `applyEstimate`, so an identify no-match that leads to an estimate keeps its photo
- [x] 3.3 Leave `SearchScreen`'s `onAccept` ignoring the new argument, and confirm its navigation state is unchanged
- [x] 3.4 Confirm the text-log estimate path, which has no image, still clears `pendingPhoto` rather than carrying a stale one

## 4. Tests

- [x] 4.1 Logging an unknown name with a chosen photo captures the food and uploads the image to it
- [x] 4.2 No photo control is offered when a library food is matched, when editing an entry, or in quick calories mode
- [x] 4.3 Choosing a photo and then selecting a library food from the dropdown discards it and uploads nothing
- [x] 4.4 Removing the photo, or closing the form without saving, uploads nothing
- [x] 4.5 A failed image upload leaves the entry logged and the captured food intact with no image
- [x] 4.6 A failed auto-capture leaves the entry logged and uploads nothing
- [x] 4.7 Accepting an in-form AI estimate seeds the photo, and it can be replaced or removed before saving
- [x] 4.8 Entries that match an existing food never attach an image, including one with a photo already

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 `npm run typecheck` passes
- [x] 5.3 Exercise the flow in the running app: log a brand-new food with a photo, confirm it appears on that food in the Food Library, then identify a food the library does not know and confirm its photo carries through to the captured food
