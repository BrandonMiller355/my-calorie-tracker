## 1. Prerequisites & shared pieces

- [x] 1.1 Confirm the `select-photo-from-library` change is implemented and archived (this change assumes `PhotoCapture` already offers the file-picker source); if not, land it first
- [x] 1.2 Extract the pre-send review step (frozen frame, retake, note field, send/cancel) from `AiAnalyzeOverlay` into a shared component (e.g. `src/components/PhotoConfirm.tsx`) with no behavior change; keep existing `AiAnalyzeOverlay` tests green

## 2. Edge Function

- [x] 2.1 Create `supabase/functions/identify-food/index.ts` following the `analyze-food` skeleton (CORS, method guard, `GEMINI_API_KEY` secret, `gemini-2.5-flash`, response-schema JSON): request `{ image, note?, foods: [{ id, name, description?, servingLabel, servingGrams? }] }`, response `{ candidates: [{ id, confidence }], amount?: { grams, source: 'scale' | 'estimate' } }`
- [x] 2.2 Write the identification prompt: match only against the provided food list; one candidate when confident, 2–3 when torn, none when nothing plausibly matches; read a legible scale display verbatim as net weight (convert oz/lb to grams) with source `scale`; otherwise judge portion vs `servingGrams` as source `estimate`; omit `amount` entirely when neither is reliable
- [x] 2.3 Server-side revalidation: drop candidate ids not present in the request's food list, cap candidates at 3, require positive finite grams; return typed errors matching the analyze-food conventions
- [x] 2.4 Deploy the function with `verify_jwt` enabled and smoke-test authenticated vs unauthenticated calls

## 3. Client API

- [x] 3.1 Create `src/api/identifyFood.ts`: build the request from non-archived library foods (flatten each serving anchor's weight equivalence to `servingGrams` in grams; omit for volume/no equivalence), call the function with the session JWT and an AbortSignal, revalidate the response shape client-side
- [x] 3.2 Add `src/api/identifyFood.test.ts`: request construction (archived foods excluded, anchor flattening), response parsing (valid, malformed, unknown-id filtering), auth and network error paths, abort behavior

## 4. Identify overlay

- [x] 4.1 Create `IdentifyOverlay` component with phases `capturing → confirming → identifying → picking | no-match | error`, reusing `PhotoCapture` and the shared pre-send review; wire abort-on-close and discard all state on unmount (nothing persisted)
- [x] 4.2 Implement result handling: 1 candidate → resolve immediately; 2–3 → chooser listing ranked candidates with name and description; 0 → no-match message with "get an AI estimate instead" and "back to form" actions; failures → non-blocking error with retry for the same photo and note
- [x] 4.3 Resolve the overlay's output as `{ food: LibraryFood, amount?: { grams, source } }` (or an estimate-handoff signal carrying the photo and note) via callbacks to the host
- [x] 4.4 Add `IdentifyOverlay` tests: send-gated request, candidate count switching (1/2–3/0), chooser pick and dismiss, retry, cancel-preserves-form contract

## 5. Entry form integration

- [x] 5.1 Add the identify camera action to `EntryForm` (add mode only, top right, gated on photo-source availability) opening `IdentifyOverlay`
- [x] 5.2 Fill-in-place: on a resolved match, run the existing `selectFood` path, then prefill amount/unit with the returned grams and `g` when `availableUnits` of the food's anchor includes `g`, else leave the 1 × serving-label default; show the AI-estimated-weight label when source is `estimate`
- [x] 5.3 Estimate handoff: give `AiAnalyzeOverlay` an optional initial photo + note prop (enter at pre-send review, retake returns to normal photo-source selection) and an in-form host mode whose accepted result fills the open form's fields (no navigation, meal/date kept); search-screen behavior unchanged
- [x] 5.4 Add/extend tests: `EntryForm` (action visibility add-vs-edit, fill-in-place with and without weight equivalence, estimate handoff filling in place, amount/unit tweaks leaving the library food untouched) and `AiAnalyzeOverlay` (initial-photo entry, retake after handoff, accept-in-place callback)

## 6. Verification

- [x] 6.1 Run the full test suite and typecheck; fix regressions
- [x] 6.2 End-to-end manual pass on a phone against the deployed function: confident match with scale weight, torn candidates, no-match → estimate handoff, unreadable scale (no amount), cancel at each step
