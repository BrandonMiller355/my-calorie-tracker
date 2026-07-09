## Context

The app already has two photo flows: barcode scanning and "AI analyze" (photo → `analyze-food` Edge Function → Gemini nutrition estimate → refine → accept as a one-serving `FoodSearchResult`). Both live on the search screen. The food library holds per-user foods with name, description, per-serving nutrition, and a serving anchor (`servingLabel` + optional `servingSize` equivalence) that unlocks logging by weight via `availableUnits`/`deriveQuantity` ([src/lib/units.ts](../../../src/lib/units.ts)).

The user's dominant logging moment is a known food sitting on the kitchen scale. This change adds *identification* (which library food is this, and how much) as distinct from *estimation* (what might this unknown dish contain). The library is the source of truth for nutrition; the model only picks candidates and reads/judges a weight.

Relevant existing pieces:
- `PhotoCapture` — camera capture, downscaled JPEG data URL (gaining a file-picker source via the in-flight `select-photo-from-library` change).
- `AiAnalyzeOverlay` — phases `capturing → confirming (pre-send review: retake, note, send) → analyzing → review/refine`; delivers via `onAccept(FoodSearchResult)`.
- `EntryForm.selectFood(food)` — fills name/nutrition from a library food, links `foodId`, and lets the anchor drive the unit picker; the amount/unit fields are separate values.

**Sequencing constraint**: `select-photo-from-library` modifies `PhotoCapture` and `AiAnalyzeOverlay`. It should land first; this change then inherits the file-picker photo source without extra work.

## Goals / Non-Goals

**Goals:**
- One-tap path from the Add Food dialog: photo → matched library food → form filled, including weight when readable.
- Uncertainty is honest: multiple candidates yield a chooser; no match yields a graceful handoff to the estimate flow; unreadable scale yields no amount.
- Server-side key protection and statelessness identical to `analyze-food`; nothing about the photo or result is persisted.

**Non-Goals:**
- No changes to library capture semantics, serving-units behavior, or the entry form's validation/anchor editing (per the structured-serving-units decisions, the serving form is not being redesigned).
- No refinement conversation for identification — a wrong match is corrected by the chooser, a retake, or falling back to estimate; not by chat.
- No matching against archived foods, and no automatic creation of library foods from this flow (auto-capture on save already handles new foods).
- No barcode or packaged-food lookup in this flow.

## Decisions

### 1. Entry point: camera action inside the Add Food dialog (add mode only)
The button sits at the top right of the entry form dialog, shown only when adding (not editing) and only when a photo source is available. Rationale: the form already carries the meal/date context, and identification is conceptually another way to fill the name field — like the combobox, but by camera. Alternative (day-log-level button) rejected: it would need its own meal selection and duplicate form-opening logic.

### 2. New `IdentifyOverlay` component reusing capture + pre-send review
The identify flow gets its own overlay component (hosted by `EntryForm`) with phases `capturing → confirming → identifying → picking | no-match | error`. The `capturing`/`confirming` steps reuse the same UI/behavior as `AiAnalyzeOverlay` (extract shared pieces rather than duplicating: `PhotoCapture` is already shared; the pre-send review step should be factored into a shared component during implementation). Rationale: the post-send halves of the two flows are entirely different (candidate picking vs. estimate refinement); merging them into one mega-overlay with a mode flag would tangle unrelated state machines.

### 3. New `identify-food` Edge Function, not a mode on `analyze-food`
Same skeleton (CORS headers, JWT via `verify_jwt`, `GEMINI_API_KEY` secret, `gemini-2.5-flash`, response-schema-constrained JSON, stateless). Request:

```jsonc
{
  "image": "data:image/jpeg;base64,...",
  "note": "optional pre-send context note",
  "foods": [ // non-archived library foods only
    { "id": "...", "name": "...", "description": "...", // description optional
      "servingLabel": "serving", "servingGrams": 100 }   // servingGrams optional
  ]
}
```

The client flattens each food's serving anchor to `servingGrams` (weight equivalences converted to grams; volume/no equivalence → omitted) so the model can sanity-check portion size and express estimates in one unit. Response:

```jsonc
{
  "candidates": [ { "id": "...", "confidence": 0.92 } ], // 0–3, ranked, ids from the request
  "amount": { "grams": 142, "source": "scale" } // optional; source: "scale" | "estimate"
}
```

Server revalidates: candidate ids must exist in the request's food list (hallucinated ids dropped), at most 3, grams positive/finite. Prompt instructs: match only against the provided list; read a visible scale display verbatim (trust it — the user tares; convert oz/lb readings to grams); if no display is readable, only include `amount` when the visible portion can be judged against the food's known `servingGrams`, tagged `source: "estimate"`; return an empty candidate list rather than a forced match. Rationale for a separate function: different request/response contracts, different prompt, no shared conversation semantics; a `mode` flag would couple two schemas in one endpoint for no reuse gain.

### 4. Confidence handling lives in the model's output shape, not client thresholds
The model is told to return exactly one candidate when confident, 2–3 when torn, none when the food isn't in the list. The client switches purely on `candidates.length` (1 → fill immediately; 2–3 → chooser; 0 → no-match offer). Alternative (client-side threshold on `confidence` scores) rejected: model self-calibration on "one vs. several" is more reliable than a magic number, and the numeric confidences remain useful for ordering the chooser. `confidence` is still returned for display ordering and potential future tuning.

### 5. Form fill semantics
Filling from a matched food calls the existing `selectFood(food)` path (links `foodId`, fills name/nutrition, anchor drives the unit picker) and then, if an `amount` came back **and** `availableUnits(food's anchor)` includes `g`, sets `amount` to the returned grams and `unit` to `g`. Otherwise amount/unit fall back to the existing default (1 × serving label). A `source: "estimate"` amount is still prefilled — the live computed-nutrition preview is the user's review surface — but the identify overlay labels it as an AI-estimated weight before closing. Identification/prefill never modifies a library food; after the fill, normal form semantics apply, including the "Edit nutrition" library-update flow (per food-logging, landed in `edit-nutrition-updates-library-food`).

### 6. No-match handoff into the estimate flow, in place
`AiAnalyzeOverlay` gains an optional `initialImage` prop: when provided it skips `capturing` and enters at `confirming` (pre-send review) with that photo, preserving retake. `EntryForm` hosts the overlay for this handoff and applies the accepted `FoodSearchResult` to its own state (same field-filling as `selectFood` minus `foodId`, anchor = plain one-serving) instead of the search screen's navigation prefill. The search-screen usage is untouched. Rationale: the photo is already taken; forcing navigation to the search screen would discard the open form's meal/date context.

### 7. Library payload comes from client state
`EntryForm` already has the full library in memory (`foods` from `AppState`); the client filters out archived foods and sends the list with each request. No server-side DB read. Rationale: the function stays stateless and permission-free (no service-role key), and the library is small (tens to low hundreds of foods — well within prompt budget). If a library ever grows huge, a client-side pre-filter is the escape hatch; not needed now.

## Risks / Trade-offs

- **[Scale display misread]** (glare, 1024px downscale, unit misdetection) → prompt demands verbatim reading with explicit "omit if not clearly legible"; amount is prefilled into an editable field with live nutrition preview, so a wrong read is one glance away from correction; retake is available at pre-send review.
- **[Model matches a visually similar wrong food]** → confident-match fills the form but the name/nutrition are visible before save; the chooser handles the torn case; the user can clear the name field and use the combobox as always.
- **[Prompt-injection via food names/descriptions]** → library content is user-authored and only influences the user's own suggestion; response revalidation (ids must come from the request, numeric bounds) caps the blast radius.
- **[Two overlays drift apart visually]** → factor the pre-send review into a shared component during implementation rather than copy-pasting.
- **[In-flight `select-photo-from-library` change touches the same files]** → sequencing: land that change first; this change's tasks assume the file-picker path already exists in `PhotoCapture`.
- **[Payload growth: photo + full library per request]** → acceptable at current library sizes; ids/names/descriptions are a few KB next to a ~100 KB image.

## Migration Plan

1. Deploy the `identify-food` Edge Function (secret `GEMINI_API_KEY` already set for `analyze-food`; same project).
2. Ship the client. The feature is additive; no data migration. Rollback = revert client; the function is inert without callers.

## Open Questions

- None blocking. (Chooser presentation details — e.g. showing each candidate's per-serving calories — can be settled in implementation.)
