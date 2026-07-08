## 1. Edge Function

- [x] 1.1 Scaffold `supabase/functions/analyze-food/index.ts` (Deno): parse `{ image, corrections[] }` request, handle CORS preflight, reject non-POST
- [x] 1.2 Implement the Gemini call: single user turn (system instruction + image + correction text parts), `fetch` generateContent with `responseMimeType: application/json` + `responseSchema` for `{ name, calories, fat, carbs, protein, confidenceNote }`, model as a top-of-file constant (`gemini-2.5-flash`), thinking disabled
- [x] 1.3 Error handling: distinct messages for missing `GEMINI_API_KEY`, provider HTTP errors (429 named as rate-limiting), and schema-invalid responses; all returned as JSON errors the client can display
- [x] 1.4 Deploy with `verify_jwt` enabled (`npx supabase functions deploy analyze-food`), set `GEMINI_API_KEY` via `npx supabase secrets set`, and verify: an unauthenticated `curl` is rejected; an authenticated request returns a valid estimate (authenticated path verified on-device in 6.2)

## 2. Client API wrapper

- [x] 2.1 Add `src/api/analyzeFood.ts`: types for the request (image data URL + correction turns) and `FoodEstimate` response; `analyzeFood(request, { signal })` invoking the Edge Function via the shared Supabase client, validating the response shape, throwing message-bearing errors on failure
- [x] 2.2 Add `mapEstimateToResult(estimate): FoodSearchResult` (random id, `servingLabel: 'serving'`, no `servingSize`, numeric nutrients)
- [x] 2.3 Unit tests for the wrapper (success, function error, malformed response, abort) and the mapping

## 3. Photo capture

- [x] 3.1 Add `src/components/PhotoCapture.tsx`: rear-camera `<video>` overlay with shutter button; on shutter, draw the frame to a canvas downscaled to ≤1024px long edge, export JPEG (~0.8 quality) as a data URL, stop tracks, call `onCapture(dataUrl)`
- [x] 3.2 Reuse the barcode scanner's camera lifecycle rules (stop tracks on capture/cancel/unmount) and its `NotAllowedError`/`NotFoundError` messaging with a `fallback` slot

## 4. Analyze overlay (review + chat)

- [x] 4.1 Add `src/components/AiAnalyzeOverlay.tsx` owning the state machine: capturing → analyzing → review → refining → error(retry); props `onAccept(result)`, `onCancel()`; abort in-flight requests on unmount/cancel
- [x] 4.2 Review UI: captured photo thumbnail, estimate labeled "AI estimate" with confidence note, correction text box + "Ask again", "Use this estimate" button; refinement failure keeps the previous estimate visible with retry
- [x] 4.3 All conversation state (photo, corrections, estimates) held in component state only; discarded on close — verify nothing is written to storage or Supabase
- [x] 4.4 Unit tests with stubbed `PhotoCapture` and stubbed `analyzeFood`: initial estimate render, refinement replaces estimate, refinement error keeps prior estimate, accept produces the mapped `FoodSearchResult`, cancel discards state

## 5. Search screen integration

- [x] 5.1 Add the "AI analyze" action next to the barcode scan button, gated on `navigator.mediaDevices?.getUserMedia` existing; wire it to toggle `AiAnalyzeOverlay`
- [x] 5.2 Wire `onAccept` to the existing `select()` (prefill navigation preserving `fromForm` meal context) and `onCancel` back to the idle search screen
- [x] 5.3 Unit tests: action hidden without `mediaDevices`, shown with it; accept lands in the prefill flow with meal context; cancel restores prior search state
- [x] 5.4 Styling for the new overlay/review UI in `src/index.css`, reusing scanner-overlay patterns

## 6. Verification

- [x] 6.1 `npm run build` and `npm test` pass
- [ ] 6.2 Manual verification on the deployed site (Android/Chrome): capture a real dish, get an estimate, refine it once, accept, confirm the pre-filled form and saved entry; confirm cancel paths release the camera (indicator off)
- [x] 6.3 Confirm the deployed bundle contains no Gemini key (`grep` the build output) and the function rejects unauthenticated calls
