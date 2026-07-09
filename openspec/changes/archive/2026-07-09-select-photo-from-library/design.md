## Context

`PhotoCapture` currently only knows how to drive `getUserMedia` + a `<video>` element + canvas frame-grab. `AiAnalyzeOverlay` treats it as a black box that eventually calls `onCapture(imageDataUrl)`; the rest of the flow (confirm/note/analyze/refine) is source-agnostic already. `SearchScreen` gates the whole "AI analyze" entry point on `getUserMedia` existing.

## Goals / Non-Goals

**Goals:**
- Let the user pick an existing image file and have it flow through the exact same downscale → pre-send-review → analyze pipeline as a camera capture.
- Keep `AiAnalyzeOverlay`'s phase machine and `analyzeFood` contract untouched — this is purely a second way to produce the same `imageDataUrl`.
- Make "AI analyze" available on devices/browsers without a camera (or with camera access denied) via the file picker.

**Non-Goals:**
- No multi-photo selection or photo editing/cropping UI.
- No change to what's sent to the Edge Function or how estimates are reviewed/refined.

## Decisions

- **Shared downscale helper.** Extract the canvas-based downscale/JPEG-encode logic in `captureFrame` into a helper that accepts any `CanvasImageSource` + its natural width/height, so both the video-frame path and the file path reuse identical `MAX_EDGE_PX`/`JPEG_QUALITY` behavior. A file is loaded into an `HTMLImageElement` via `URL.createObjectURL` (revoked after draw) to get a drawable source.
- **`PhotoCapture` gains the file path, its external API doesn't change.** `onCapture`/`onCancel`/`fallback` stay as-is; `AiAnalyzeOverlay` needs no changes to its phase machine. Internally, `PhotoCapture` renders a hidden `<input type="file" accept="image/*">`, exposes a "Choose from library" button that clicks it, and both the shutter and the file `onChange` funnel into the same downscale helper before calling `onCapture`.
- **No `capture` attribute on the file input.** Omitting it lets the OS present its normal chooser (photo library / take photo / browse), which is the standard "pick from phone" affordance on mobile and a plain file dialog on desktop — no need to reimplement a camera-vs-library choice ourselves.
- **File picker is always offered; camera view is offered when available.** When `getUserMedia` exists, `PhotoCapture` shows the live camera view with the shutter *and* a secondary "Choose from library" action. When it doesn't exist (or errors, e.g. permission denied), the file picker becomes the primary/only action — replacing today's dead-end error state with something the user can actually act on. The camera-unavailable message still renders, but next to it is the file-picker action instead of only the `fallback` node.
- **`SearchScreen`'s `canAnalyze` gate is dropped.** File selection has no feature-detection gate worth gating on (the `<input type="file">` element is universally supported), so the AI analyze entry point is simply always rendered. This removes a `useState`/conditional rather than adding one.
- **Retake reopens the same `PhotoCapture` instance/phase**, not a remembered source. `AiAnalyzeOverlay.handleRetake` already just resets to `{ kind: 'capturing' }`, which remounts `PhotoCapture` and shows whatever mix of camera/file actions is available — no need to track which source produced the current image.
- **Bad/huge/non-image file selections are handled inside `PhotoCapture`**, mirroring `cameraError`: a `fileError` state shows a message ("That file couldn't be used as a photo.") and lets the user try again, without ever calling `onCapture`.

## Risks / Trade-offs

- [Very large image files (e.g. 12MP+ photos) could be slow to decode/downscale on low-end devices] → Mitigation: same canvas downscale path as camera frames already caps output size; decode cost is a one-time synchronous-feeling `Image.onload`, acceptable for a single user-initiated action.
- [Removing the `getUserMedia` gate changes the existing spec scenario "Action hidden when camera capture is unavailable"] → Mitigation: this is an intentional, explicit spec change captured in the delta below; the scenario is replaced, not silently dropped.
