## Context

The app persists everything through `StorageRepository` (implemented by `SupabaseRepository`), with foods in a Postgres `foods` table scoped per-user by RLS. Photos already flow through the app for AI identification: `src/lib/photo.ts` downscales any image to a JPEG data URL (long edge ≤ 1024px, quality 0.8), and both `IdentifyOverlay` (single) and `BulkPhotoOverlay` (bulk) hold that data URL in memory and then throw it away. Supabase Storage is not used anywhere yet.

Measured scale: the user's library has ~811 active foods. At ~150–250 KB per downscaled photo that is ~120–200 MB for a fully-photographed library — comfortably ~12–20% of the free-tier ~1 GB Storage bucket, and far too large to sit base64-inflated inside Postgres rows. So images belong in Storage, not the DB.

## Goals / Non-Goals

**Goals:**
- One optional, downscaled photo per food, stored in a private per-user Storage bucket.
- Manual attach/replace/remove from the edit-food form.
- Auto-attach the identify photo (both single and bulk flows) to a matched food that has no image yet, reusing the in-memory photo — no re-capture, no re-encode.
- All image writes are non-blocking and never delay or fail the user's primary action (save food / log entry).
- Display via short-lived signed URLs, fetched lazily.

**Non-Goals:**
- Backfilling images for existing foods (explicitly dropped — images accrue going forward).
- Multiple photos, cropping/editing, or full-resolution originals.
- Attaching images to saved meals or to logged entries (only library foods).
- Changing the `identify-food` / bulk contract or the AI model behavior.

## Decisions

### Storage location: private Storage bucket, path on the food row
A new private bucket (e.g. `food-images`) holds objects at a per-user, per-food key such as `${user_id}/${food_id}.jpg`. The `foods` table gains a nullable `image_path text` column recording the object key (null = no photo).

- **Why not a Postgres column of base64?** ~811 images ≈ 160–270 MB base64 would consume roughly half the 500 MB DB tier and bloat every `getFoods()` `select('*')`. Rejected.
- **Why store the path on the row rather than deriving it?** A deterministic `${user_id}/${food_id}.jpg` key is derivable, but an explicit column makes "has an image?" a cheap row read (no Storage round-trip), lets the format/extension evolve, and keeps signed-URL requests off the render path for image-less foods. The column is the source of truth for presence.

### Bucket privacy: private + signed URLs
Per the user's decision, the bucket is private with per-user RLS on `storage.objects`, and display uses `createSignedUrl` (short TTL). Public URLs were rejected: food photos are personal and a public bucket makes any leaked UUID URL world-readable.

- RLS mirrors the `foods` policies: a user may read/write/delete only objects whose first path segment equals their `auth.uid()`. This is enforced in Storage policies, independent of the `foods` row policy.

### One image per food, keyed by `food_id`
Using `${food_id}.jpg` as the key means replace is an idempotent overwrite (`upsert: true`) and there is never more than one object per food. Remove deletes the object and nulls the column.

### Auto-attach fires at the confirmation seam of each flow, upload-only-if-empty
- **Bulk** (`BulkPhotoOverlay.handleAddAll`): the clean seam — each row already holds both `image` and the picked `foodId`. After a row's entry is logged, if that food's `image_path` is null, upload the row's photo. This is per-row and needs no new plumbing to *get* the image.
- **Single** (`IdentifyOverlay`): today `onMatch(food, amount)` drops the image. Thread the image through — `onMatch(food, amount, image)` — so the caller can auto-attach when `food.image_path` is null. "Confirmed match" = the moment a candidate resolves (confident single match calls `onMatch` automatically; chooser calls it on pick). We attach at that resolve point, not at final log, because that is where the flow actually commits to a food identity and still holds the photo; the prefilled entry may still be edited or abandoned, but attaching the food's own photo on a resolved match is the intended behavior and is harmless if the entry is later not logged.
- **"Has no image" is checked against the client's loaded `LibraryFood`.** A rare race (two flows attaching to the same newly-image-less food) resolves to a last-write-wins overwrite of one photo — acceptable, since both are valid photos of the same food.

### Non-blocking uploads via fire-and-forget in the state layer
Image writes go through new `AppState` actions that `void` the upload promise (or await it only to refresh local state), never gating the save/log path. A rejected upload is caught and surfaced as a quiet, non-blocking indication; the food's non-image data and the logged entries are untouched. This satisfies the "upload never blocks the primary action" requirement across all three entry points (editor, single, bulk).

### Repository / type surface
- `LibraryFood` gains `imagePath?: string`; `FoodRow` gains `image_path: string | null`; `toFoodRow`/`fromFoodRow` map it.
- New `StorageRepository` methods: `uploadFoodImage(foodId, blob): Promise<string>` (returns the stored path, sets the row), `removeFoodImage(foodId): Promise<void>` (deletes object, nulls the row), `getFoodImageUrl(path): Promise<string>` (signed URL). Data URL → Blob via `fetch(dataUrl).then(r => r.blob())`.
- Display uses a small lazy hook/component that resolves a signed URL per visible food with a photo, caching it for the TTL so re-renders don't re-sign.

## Risks / Trade-offs

- **Signed-URL latency / churn on the list** → Fetch lazily and cache the signed URL per food for its TTL; image-less foods (null `image_path`) never sign. A failed/slow sign degrades to the existing text-only row.
- **Orphaned Storage objects** → Foods are archived, never deleted, so their images can remain; explicit "remove photo" deletes the object. No general GC needed. If a future hard-delete is added, it must also delete the object.
- **Upload failure leaving a null column but a stale action** → Upload sets `image_path` only on success; on failure the food simply stays image-less. No partial/broken reference is written.
- **Auto-attach on a match the user then abandons** → The food still gets a correct photo of itself; considered acceptable (even desirable). It never overwrites an existing image, so the downside is bounded.
- **Race between two concurrent auto-attaches to the same food** → Last-write-wins; both are valid photos. Not guarded.

## Migration Plan

Applied by hand in the Supabase dashboard (this project applies `schema.sql` manually; there is no automated migration runner):
1. `alter table foods add column image_path text;` (nullable; existing rows default to null = no photo).
2. Create a **private** Storage bucket `food-images`.
3. Add RLS policies on `storage.objects` for that bucket: select/insert/update/delete allowed only when `bucket_id = 'food-images'` and `(storage.foldername(name))[1] = auth.uid()::text`.
4. Update `supabase/schema.sql` to reflect the new column (and note the bucket/policies) so the checked-in schema stays the source of truth.

Rollback: drop the column and remove the bucket/policies; the app treats every food as image-less. No data loss for non-image food data.

## Open Questions

- Signed-URL TTL and whether to add lightweight in-memory caching beyond the TTL (start simple: a short TTL, cache per food for that window).
- Whether the food list thumbnail and a future larger "view photo" affordance share one signed URL or request sizes separately (out of scope now; one downscaled image is served for both).
