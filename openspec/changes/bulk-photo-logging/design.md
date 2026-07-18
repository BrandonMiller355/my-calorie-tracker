## Context

The user assembles meals incrementally on a tared kitchen scale, photographing each addition: beans (tare, photo), cheese sauce (tare, photo), salsa (tare, photo). Because the scale is tared between additions, **each photo's scale reading is exactly the newly added item's weight** — no delta arithmetic is needed anywhere.

Three existing flows supply the building blocks:

- `identify-food` Edge Function + `src/api/identifyFood.ts`: one photo + the library → ranked candidates and an optional scale-read weight in grams. The request already accepts a free-text `note` that the model treats as user context.
- `TextLogOverlay`: the bulk precedent — a review list of rows with editable amount/unit/meal, an "Add N entries" bulk save that logs incrementally and retries only what's left on failure.
- `PhotoCapture`: gallery file selection with downscale-to-1024px JPEG re-encoding.

All AI flows in this app are ephemeral (client memory only, nothing persisted server-side) and hosted as overlays from the Log Food dialog (`EntryForm` in add mode).

## Goals / Non-Goals

**Goals:**

- Log an incrementally photographed meal from one gallery multi-select and one review list.
- Identify each photo's *new addition* (not the whole accumulated bowl) by chaining context between sequential identify requests.
- Reuse the `identify-food` Edge Function and client API **unchanged**.
- Match the established overlay/review interaction patterns (TextLogOverlay) and ephemerality rules.

**Non-Goals:**

- No camera capture inside the bulk flow — it is gallery-only by design (the photos were taken earlier, while cooking).
- No AI-estimate fallback for unrecognized photos (the single-photo flow's analyze handoff is not wired into the batch; a v2 candidate).
- No delta-weight computation from cumulative scale readings (the user tares between additions; a note states this to the model).
- No server-side batching, new Edge Functions, or persistence.

## Decisions

### 1. Sequential client-side loop over the existing `identify-food` function (no server change)

Each photo is identified with its own request, in capture order. Requests after the first carry a synthetic note built by the client, e.g.:

> "This photo is part of a sequence logging one meal. Earlier photos of this dish already contained: black beans (142 g), cheese sauce (89 g). If this photo shows the same dish with something newly added, identify ONLY the new addition. The scale is tared before each addition, so the displayed weight is the new item's weight alone."

The note travels in the existing `note` request field, which the model already treats as user-supplied context.

- *Why over a batch endpoint (all images in one Gemini call)*: zero server surface change, per-photo progress and retry granularity, and free-tier rate limits are easier to respect one call at a time. Considered and deliberately rejected: a multi-image `identify-food-batch` function (stronger visual continuity reasoning, but new server code, all-or-nothing retry).
- *Why sequential rather than parallel*: photo N's note depends on photos 1..N-1's results, and serial calls avoid tripping the Gemini free-tier rate limit.

### 2. Chaining uses top candidates, not user confirmations

The note for photo N lists the **top-ranked** candidate (and any returned weight) from each earlier photo, without waiting for the user to confirm rows. A misidentified early photo can propagate a wrong *name* into later notes, but "what's newly added" is primarily a visual judgment, and every row is corrected in the review list before anything is logged.

- *Alternative considered*: pausing the loop for per-photo confirmation — rejected as the stepper UX the user explicitly declined.

### 3. Ordering by `file.lastModified`, ascending

Gallery pickers do not guarantee `input.files` is in tap order, and the canvas downscale strips EXIF. `File.lastModified` survives selection and is the capture time for phone-gallery photos, so sorting by it ascending recovers chronological order regardless of how sloppily the photos were selected. The review list renders rows in this order so a mix-up is visible.

### 4. One review list, TextLogOverlay-shaped

Identification results accumulate into rows: photo thumbnail, matched food name, amount (prefilled from the scale read, in grams when the food's anchor offers grams; otherwise 1 × serving label, mirroring the single-photo prefill rules), unit and meal selects, per-row remove. Every row defaults to the dialog's selected meal. One "Add N entries" button bulk-saves via the same incremental loop as TextLogOverlay (each success drops its row; a failure keeps the rest for retry).

### 5. Ambiguity and no-match never stall the batch

- **2–3 candidates**: the row preselects the top-ranked candidate and exposes an inline candidate picker, visibly marked as uncertain. The review list itself is the confirmation step, so no blocking chooser appears mid-batch.
- **0 candidates**: the row renders as "not recognized", is excluded from the entry count, and can be removed. It still contributes nothing to later chaining notes (an unrecognized photo is described as "an unidentified addition" so the model knows the dish grew).
- **AI-estimated weight** (`source: "estimate"`): labeled on the row exactly as the single-photo flow labels it in the form.

### 6. Mid-batch failure keeps progress

The loop shows "Analyzing photo N of M…". On a request failure (including 429), completed rows are kept and a retry action resumes from the failed photo. Cancelling the overlay at any point discards everything — photos, notes, and rows are ephemeral client state, per the app-wide AI-flow rule.

### 7. Entry point and hosting

A third header action in the Log Food dialog, add mode only, alongside identify-from-photo and log-from-text. The new `BulkPhotoOverlay` is hosted by `EntryForm` like its two siblings; on "Add N entries" completing, the dialog closes (as the text-log bulk path does). The multi-select file input lives in the new overlay (its own `<input type="file" multiple accept="image/*">` reusing the shared downscale helper), leaving `PhotoCapture`'s single-photo contract untouched.

## Risks / Trade-offs

- [Model ignores the chaining note and re-identifies the whole bowl (e.g. returns "beans" again for the cheese-sauce photo)] → the note is explicit and the review list makes any wrong row a one-tap fix; the tared scale weight is still correct regardless of which food was named.
- [`lastModified` is unreliable for images that were edited, downloaded, or shared] → the review list shows rows in the assumed order with thumbnails, so the user can spot and remove/re-run a misordered batch; a screenshots-vs-camera mix is an accepted edge case.
- [N sequential Gemini calls hit the free-tier rate limit mid-batch] → completed rows are kept; the 429 message from the function ("try again in a minute") surfaces on the retry action, which resumes rather than restarts.
- [Large batches inflate memory (N data-URL JPEGs in state)] → photos are already downscaled to ≤1024 px (~150–250 KB each); a soft cap on selection size (rejecting absurd selections with a message) bounds the worst case.
- [Chaining on unconfirmed top candidates propagates an early misidentification] → accepted per Decision 2; the review list is the correction point.

## Open Questions

- None blocking. Batch selection cap (e.g. 10 photos) is an implementation constant to pick during apply.
