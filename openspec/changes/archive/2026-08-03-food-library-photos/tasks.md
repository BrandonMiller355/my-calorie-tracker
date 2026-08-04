## 1. Supabase setup (applied by hand in the dashboard)

- [ ] 1.1 In the Supabase dashboard, run `alter table foods add column image_path text;` (nullable; existing rows stay null = no photo)
- [ ] 1.2 Create a **private** Storage bucket named `food-images`
- [ ] 1.3 Add RLS policies on `storage.objects` for `bucket_id = 'food-images'` allowing select/insert/update/delete only when `(storage.foldername(name))[1] = auth.uid()::text` (owner-only, mirroring the `foods` policies)
- [x] 1.4 Update `supabase/schema.sql` to reflect the new `foods.image_path` column and document the `food-images` bucket + its policies, so the checked-in schema stays the source of truth

## 2. Types and storage layer

- [x] 2.1 Add optional `imagePath?: string` to `LibraryFood` in `src/types.ts`
- [x] 2.2 Add `image_path: string | null` to `FoodRow` in `SupabaseRepository.ts` and map it in `toFoodRow`/`fromFoodRow`
- [x] 2.3 Add `uploadFoodImage(foodId, blob)`, `removeFoodImage(foodId)`, and `getFoodImageUrl(path)` to the `StorageRepository` interface
- [x] 2.4 Implement the three methods in `SupabaseRepository`: upload/overwrite the object at `${auth user id}/${foodId}.jpg` and set `foods.image_path`; delete the object and null the column on remove; return a short-lived `createSignedUrl` on get
- [x] 2.5 Add a small helper to convert a JPEG data URL to a `Blob` (e.g. `fetch(dataUrl).then(r => r.blob())`) for upload

## 3. State layer (non-blocking image actions)

- [x] 3.1 Add `AppState` actions `setFoodImage(foodId, dataUrl)` and `removeFoodImage(foodId)` that perform the upload/remove and refresh the affected food's `imagePath` in local state
- [x] 3.2 Ensure image actions are fire-and-forget relative to the primary action: saving a food, logging an entry, or completing a match must not await the image transfer, and a rejected transfer is caught and surfaced non-blockingly without reverting the primary action

## 4. Edit-food form: attach / replace / remove

- [x] 4.1 In `FoodsScreen` `FoodForm`, add an image section (shown only when editing an existing food) with the current photo (if any), a "choose/replace photo" action reusing `PhotoCapture`/file selection + `loadImageFile` downscale, and a "remove photo" action
- [x] 4.2 Wire choose/replace to `setFoodImage` and remove to `removeFoodImage`, keeping the text/nutrition save path independent of the image transfer

## 5. Auto-attach in the single-photo identify flow

- [x] 5.1 Thread the identify photo out of `IdentifyOverlay`: change `onMatch` to also pass the captured image (both the confident-match and chooser paths)
- [x] 5.2 In the `onMatch` caller, when the matched food has no `imagePath`, call `setFoodImage` with the identify photo; never overwrite an existing image; keep it non-blocking so form prefill/logging are unaffected

## 6. Auto-attach in the bulk-photo flow

- [x] 6.1 In `BulkPhotoOverlay.handleAddAll`, after a row's entry is logged, if the picked food has no `imagePath`, attach that row's `image` via `setFoodImage`
- [x] 6.2 Apply per row from that row's own photo and picked food; skip unrecognized and removed rows; never overwrite; keep it non-blocking so bulk logging is unaffected

## 7. Display food photos in the library

- [x] 7.1 Add a lazy thumbnail for foods with an `imagePath` in the `FoodsScreen` list, resolving a signed URL via `getFoodImageUrl` only for visible foods that have a photo
- [x] 7.2 Cache the resolved signed URL per food for its TTL so re-renders don't re-sign; fall back to the existing text-only row when the image is loading or fails to load

## 8. Tests

- [x] 8.1 Repository tests: `toFoodRow`/`fromFoodRow` round-trip `image_path`; upload sets the column, remove nulls it, get returns a signed URL (mock the Supabase storage client)
- [x] 8.2 Editor test: attaching, replacing, and removing a photo calls the right actions and does not block the text/nutrition save
- [x] 8.3 Single-flow test: a confident match on an image-less food auto-attaches; a match on a food that already has an image does not; no-match/cancel attaches nothing
- [x] 8.4 Bulk-flow test: logging a row against an image-less food auto-attaches that row's photo; a food that already has an image is left unchanged; unrecognized/removed rows attach nothing; a failed attach does not break logging
- [x] 8.5 Run `npm run typecheck` and `npm test`

## 9. Verify end-to-end

- [ ] 9.1 With the bucket and column in place (tasks 1.1–1.3), manually verify: attach a photo via the editor and see the thumbnail; identify a food (single) with no image and confirm the photo attaches; bulk-log and confirm per-row attach; confirm a food that already has a photo is never overwritten; confirm logging still succeeds if an upload fails
