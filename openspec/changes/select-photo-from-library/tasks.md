## 1. Shared downscale helper

- [x] 1.1 In `src/components/PhotoCapture.tsx`, extract the canvas downscale/JPEG-encode logic from `captureFrame` into a helper that accepts any `CanvasImageSource` plus its natural width/height (reusable by both the video-frame path and the file path).

## 2. File picker in `PhotoCapture`

- [x] 2.1 Add a hidden `<input type="file" accept="image/*">` and a "Choose from library" button that triggers it via a ref.
- [x] 2.2 On file selection, load the file into an `HTMLImageElement` via `URL.createObjectURL`, run it through the shared downscale helper, revoke the object URL, and call `onCapture` with the resulting JPEG data URL.
- [x] 2.3 Add a `fileError` state for undecodable files (mirrors `cameraError`) with a message and a way to try again; `onCapture` is not called on error.
- [x] 2.4 When `getUserMedia` is unavailable or `cameraError` is set, show the "Choose from library" action as the primary/only action instead of a dead-end error (still show the underlying message, but pair it with something actionable).
- [x] 2.5 When the camera view is showing, render "Choose from library" as a secondary action alongside the shutter button.

## 3. Drop the camera-only gate

- [x] 3.1 In `src/screens/SearchScreen.tsx`, remove the `canAnalyze`/`getUserMedia` gate so the "AI analyze" action is always rendered.

## 4. Tests

- [x] 4.1 `PhotoCapture.test.tsx` (create if it doesn't exist, or extend): cover choosing a valid image file → `onCapture` called with a downscaled JPEG; choosing an invalid/undecodable file → `fileError` shown, `onCapture` not called; file picker available and used as primary action when camera is unavailable/denied.
- [x] 4.2 `AiAnalyzeOverlay.test.tsx`: confirm the file-picker path (via the existing `PhotoCapture` stub or a new one) flows through `confirming` → `analyze` the same as camera capture; confirm retake returns to `capturing` regardless of which source produced the image. (No code changes needed: `AiAnalyzeOverlay` treats `PhotoCapture` as a black box already, and the existing retake/capture tests already exercise that path generically — verified no source-specific branching exists to test separately.)
- [x] 4.3 `SearchScreen.test.tsx` (or `App.test.tsx`, wherever the gate was covered): update/remove any test asserting the AI analyze action is hidden without `getUserMedia`.

## 5. Manual verification

- [x] 5.1 Run the app, confirm "Choose from library" opens the OS file picker, a chosen photo flows through review → analysis → accept exactly like a camera capture. Verified via a temporary Playwright-driven harness mounting `PhotoCapture` directly (real Supabase auth blocks driving the full routed app headlessly): with a fake camera device, the camera view shows "Take photo" plus a secondary "Choose from library" button; selecting a file produces a real downscaled JPEG (`data:image/jpeg;base64,/9j/...`) passed to `onCapture`, same shape as a camera capture would produce.
- [x] 5.2 Verify camera-denied/unavailable state now offers a usable "Choose from library" action instead of a dead end. Verified: with no fake camera device, `getUserMedia` fails naturally and the overlay shows "The camera could not be started." alongside an actionable "Choose a photo from your device" button (previously a dead end) and Cancel; selecting a file still completes the capture successfully.
