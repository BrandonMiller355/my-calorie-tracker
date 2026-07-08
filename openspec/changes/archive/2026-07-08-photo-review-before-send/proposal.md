## Why

Today the shutter fires the AI analysis immediately: there is no chance to notice a bad framing (part of the plate cut off) or to tell the model something the photo can't show ("I didn't eat the ranch") before spending an analysis round-trip. Both gaps currently cost an extra refinement turn — or produce an estimate based on the wrong picture.

## What Changes

- Insert a **pre-send review step** between capture and analysis: the captured photo is shown frozen with three actions — retake, add an optional context note, and send for analysis.
- **Retake** discards the captured frame and reopens the camera; it can be repeated any number of times.
- The **context note** is a single optional free-text field (e.g. "I didn't eat the ranch", "half is my kid's") that is sent with the photo as the first correction in the existing `corrections` array — the Edge Function contract is unchanged.
- Analysis no longer starts on shutter; it starts only on the explicit send action. Cancel from the review step behaves like cancelling the camera (nothing is sent, prior search state intact).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-food-analysis`: the "Single-shot photo capture" requirement changes — capturing a frame no longer begins analysis; it leads to a new pre-send review step (retake / optional note / explicit send). A new requirement covers that review step and how the note feeds the analysis conversation.

## Impact

- `src/components/AiAnalyzeOverlay.tsx`: new `confirming` phase between `capturing` and `analyzing`; note state seeds the corrections list.
- `src/components/PhotoCapture.tsx`: unchanged or lightly touched (capture callback semantics stay "here is a frame"; the camera stream is already stopped on capture, which retake must re-open by remounting the component).
- `src/api/analyzeFood.ts` and the `analyze-food` Edge Function: **no contract change** — the note travels as `corrections[0]`.
- Tests: `AiAnalyzeOverlay.test.tsx` gains coverage for retake, note pass-through, and send/cancel from the review step.
