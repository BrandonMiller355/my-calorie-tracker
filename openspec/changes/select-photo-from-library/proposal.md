## Why

AI analyze currently requires a live camera: on desktop browsers, or when the food is already in an existing photo (a takeout menu shot, a picture a dining companion sent), the user has no way to feed it into analysis. Letting the user pick an existing image from their device removes that dead end without touching the analysis pipeline itself.

## What Changes

- Add a **"choose photo" action** alongside camera capture: a native file picker (`<input type="file" accept="image/*">`) that lets the user select an existing image instead of taking a new one.
- The chosen image is downscaled/re-encoded the same way a captured frame is (long edge capped, JPEG re-encode) and enters the same pre-send review step (retake/choose-again, optional note, send) as a camera capture.
- The "AI analyze" entry point is no longer gated on `navigator.mediaDevices.getUserMedia`: file selection works even when no camera is available, so the action becomes available more broadly. When camera capture *is* unavailable, the flow opens directly to file selection instead of a camera view.
- When both are available, the review step's "retake" action offers a way back to either taking a new photo or choosing a different file (not just reopening the camera).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-food-analysis`: the "AI analyze entry point on the search screen" requirement changes — the action is shown whenever either camera capture or file selection is available (i.e. essentially always), not only when `getUserMedia` exists. The "Single-shot photo capture" requirement is joined by a new photo-source-selection requirement covering the file-picker path, and the pre-send review step's retake behavior is extended to cover re-choosing a file.

## Impact

- `src/components/PhotoCapture.tsx`: gains a file-picker path; camera-unavailable fallback becomes "open file picker" instead of only showing an error, unless file selection also fails to apply (e.g. `<input type="file">` is always available, so this is really always a viable fallback).
- `src/components/AiAnalyzeOverlay.tsx`: the `capturing` phase can resolve via either camera shutter or file picker; `confirming` phase's retake needs to know which source to reopen.
- `src/screens/SearchScreen.tsx`: the AI analyze action's visibility check drops the `getUserMedia` gate (file picker is a universal fallback).
- Tests: `PhotoCapture` and `AiAnalyzeOverlay` test files gain coverage for the file-picker path and for retake-to-file-picker.
