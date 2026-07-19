## Why

Meals are often assembled incrementally on the kitchen scale — beans in a bowl, tare, photo; cheese sauce added, tare, photo; salsa, tare, photo — but logging them today means running the identify-from-photo flow once per photo, re-opening the Log Food dialog each time. The photos already exist in the device gallery in capture order; the user should be able to select them all at once and confirm the whole meal from one review list.

## What Changes

- Add a third header action to the Log Food dialog (add mode only, alongside identify-from-photo and log-from-text): "bulk photos", which opens the device gallery with multi-select.
- Selected photos are ordered by capture time (file `lastModified`, ascending) and identified **sequentially** against the food library using the existing `identify-food` Edge Function — no server changes.
- Each request after the first carries a client-built chaining note telling the model what earlier photos in the sequence contained, that later photos may show the same dish with a new item added (identify only the addition), and that the scale is tared before each addition so the displayed weight is the new item's weight alone.
- Results accumulate into a single review list (same pattern as the log-from-text review): one row per photo with its thumbnail, matched food, editable amount/unit/meal, and a bulk "Add N entries" action.
- Ambiguous identifications (2–3 candidates) do not stall the batch: the row preselects the top-ranked candidate with an inline candidate picker, visibly marked as uncertain.
- Unrecognized photos (no candidates) appear as unmatched rows that can be removed; they are excluded from logging. The per-photo AI-estimate fallback is out of scope.
- Mid-batch failures keep completed rows; the remaining photos can be retried from where identification stopped.

## Capabilities

### New Capabilities

- `ai-bulk-photo-logging`: Select multiple gallery photos of an incrementally assembled meal, identify each photo's newly added food against the library (chained sequential identification over the existing identify-food function), and bulk-log all items from a single editable review list.

### Modified Capabilities

<!-- None. The ai-food-identify capability (Edge Function contract, single-photo flow) and ai-food-analysis photo-selection requirements are unchanged; the bulk flow reuses the identify-food client API as-is and owns its own multi-select picker requirement. -->

## Impact

- **New component**: a bulk-photo overlay (multi-select file input, sequential identification loop with progress, review list, bulk save) hosted by the entry form.
- **`src/components/EntryForm.tsx`**: third header action in add mode; hosts the new overlay.
- **`src/api/identifyFood.ts`**: reused unchanged (the chaining note travels in the existing `note` field).
- **`supabase/functions/`**: no changes; no new secrets, tables, or migrations. Batch state is ephemeral client memory, like the other AI flows.
- **Rate limits**: sequential Gemini free-tier calls (one per photo); the retry path must tolerate a mid-batch 429.
