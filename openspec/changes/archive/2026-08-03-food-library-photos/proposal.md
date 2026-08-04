## Why

Food library items are text-only today, so a library of 800+ foods is hard to scan and recognize at a glance. The app already captures a downscaled photo whenever a food is identified from a picture, then discards it — so the image the user wants is being thrown away at the exact moment it's most relevant. Attaching that photo to the food (and letting it be set manually) makes the library recognizable at a glance, at negligible storage cost.

## What Changes

- Add an **optional photo per food** in the library, stored as a downscaled JPEG (the existing 1024px / q0.8 pipeline) in a **private Supabase Storage bucket**, retrieved for display via short-lived **signed URLs**.
- Extend the **edit-food form** so a user can attach, replace, or remove a food's photo. The photo picker reuses the existing downscale pipeline.
- **Auto-attach on AI match**: when a photo-identify flow resolves to a library food that has **no image yet**, attach the identify photo to that food automatically. This applies to **both** the single-photo identify flow and the bulk-photo review flow. Auto-attach never overwrites an existing image.
- Show the food's photo (as a small thumbnail) in the **food library list**; images are fetched lazily so the list load stays lean.
- Uploads are **non-blocking / fire-and-forget**: attaching an image (manually or via auto-attach) never delays logging an entry or saving a food, and a failed upload surfaces quietly without losing the user's primary action.
- Add a nullable image reference column to the `foods` table and the Storage bucket + RLS policies (applied by hand in the Supabase dashboard).

## Capabilities

### New Capabilities
- `food-library-photos`: the per-food image lifecycle — storage model (private bucket, per-user path, downscaled JPEG, one image per food), manual attach/replace/remove from the editor, non-blocking upload, and signed-URL retrieval/display in the library.

### Modified Capabilities
- `ai-food-identify`: on a confirmed single-photo match to a library food with no existing image, the identify photo is auto-attached to that food.
- `ai-bulk-photo-logging`: when a reviewed bulk-photo row is logged against a matched food that has no existing image, that row's photo is auto-attached to the food.

## Impact

- **Schema** (`supabase/schema.sql`): new nullable `image_path` column on `foods`. Requires a hand-applied migration in the Supabase dashboard.
- **Supabase Storage**: new private bucket for food images with per-user RLS on `storage.objects`. Created by hand in the dashboard.
- **Storage layer** (`src/storage/StorageRepository.ts`, `SupabaseRepository.ts`): new methods to upload, remove, and resolve a signed URL for a food image; `LibraryFood` gains an optional image reference; food row mapping carries the new column.
- **UI**: `src/screens/FoodsScreen.tsx` (edit-food form image controls + list thumbnail), `src/components/IdentifyOverlay.tsx` and `src/components/BulkPhotoOverlay.tsx` (thread the identify photo through to auto-attach), `src/state/AppState.tsx` (image actions).
- **Reused as-is**: `src/lib/photo.ts` downscale pipeline; the existing per-user RLS model on `foods`.
- No breaking changes; foods without images render exactly as they do today.
