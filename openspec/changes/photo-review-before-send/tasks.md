## 1. Confirm phase in AiAnalyzeOverlay

- [x] 1.1 Add a `confirming` phase to the `Phase` union and switch `PhotoCapture.onCapture` to store the image and enter it (instead of calling `analyze`)
- [x] 1.2 Render the review step: frozen captured photo, optional context-note input, primary "Analyze" send action, "Retake" action, and the existing cancel
- [x] 1.3 Wire Retake: discard the image, return to the `capturing` phase (remounting `PhotoCapture` reopens the camera), keep the typed note
- [x] 1.4 Wire Send: trimmed non-empty note is passed to `analyze` as the initial correction; empty note sends no corrections; on success the note joins the committed `corrections` state so refinements append after it
- [x] 1.5 Confirm analyze-error retry resends the same photo and note, and cancel from the review step discards both

## 2. Styling

- [x] 2.1 Style the review step (photo, note input, send/retake buttons) consistent with the existing `ai-review` / scanner-overlay styles

## 3. Tests

- [x] 3.1 Update existing `AiAnalyzeOverlay.test.tsx` capture tests: shutter now leads to the review step, and analysis fires only on send
- [x] 3.2 Add tests: retake reopens the camera and preserves the note; send with a note calls `analyzeFood` with the note as `corrections[0]`; send without a note sends `corrections: []`
- [x] 3.3 Add tests: a refinement after a noted send carries `[note, correction]`; cancel from the review step sends nothing and calls `onCancel`

## 4. Verify

- [x] 4.1 Run the full test suite and typecheck
- [x] 4.2 Manually exercise the flow in the running app (capture → note → retake → send) and validate the change with `openspec validate photo-review-before-send`
