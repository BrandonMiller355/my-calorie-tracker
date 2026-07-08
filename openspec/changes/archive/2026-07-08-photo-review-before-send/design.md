## Context

`AiAnalyzeOverlay` owns the whole AI-analyze flow as a phase machine (`capturing → analyzing → review …`). `PhotoCapture` is a self-contained camera component: on shutter it stops the stream and hands a downscaled JPEG data URL to `onCapture`, which today immediately calls `analyze(img)`. The analyze-food Edge Function is stateless and already accepts `{ image, corrections: string[] }`, resent in full each turn.

This change inserts a confirm step between shutter and analysis: see the frozen photo, optionally type a context note, retake if the framing is off, and only then send.

## Goals / Non-Goals

**Goals:**
- No analysis request leaves the device until the user explicitly sends.
- Retake is cheap and repeatable; only the last captured frame is kept.
- The context note reaches the model on the *first* turn, so the initial estimate already accounts for it.
- No Edge Function or API contract changes.

**Non-Goals:**
- Multiple photos per analysis (still single-shot).
- Editing the note after sending (post-send corrections already cover that via refinement).
- Any persistence of photo or note (the conversation stays ephemeral, as specced).

## Decisions

**1. The review step is a new `confirming` phase in `AiAnalyzeOverlay`, not a mode inside `PhotoCapture`.**
`PhotoCapture` stays a pure "give me one frame" camera component; the overlay already owns `image` state and the phase machine, so a `{ kind: 'confirming' }` phase slots in naturally. Alternative — building preview/retake into `PhotoCapture` — was rejected: it would duplicate overlay concerns (note input, send wiring) inside a component that `BarcodeScanner` symmetry keeps deliberately simple.

**2. Retake remounts `PhotoCapture` by switching back to the `capturing` phase.**
The shutter already stops the camera stream, so the review step shows a still image with the camera off (no lit camera indicator while the user types). Retake sets phase back to `capturing`; the remounted component reopens the camera via its existing effect. Trade-off: a brief camera restart delay on retake — acceptable, and it reuses the tested lifecycle instead of adding a "keep stream warm" path.

**3. The note travels as the first entry of the existing `corrections` array.**
The Edge Function already threads corrections into the model conversation and is resent in full each turn, so `corrections[0] = note` gives the note to the model on the first turn and automatically on every refinement — zero backend change. Alternative — a dedicated `note` field — would require Edge Function + prompt changes for no behavioral gain. On successful first analysis the note is committed to the `corrections` state exactly like a successful refinement correction, so later refinements append after it; on analyze-error retry the same note is resent.

**4. The note survives retakes, and is discarded on cancel.**
A retake means the *frame* was wrong, not the meal context — clearing the typed note would force retyping. Cancel (from camera or review) discards photo and note together, preserving the existing "nothing persisted, prior search state intact" behavior.

**5. Send is always enabled; the note is optional.**
An empty/whitespace note sends `corrections: []`, identical to today's behavior.

## Risks / Trade-offs

- [Every analysis now takes one extra tap] → The send button is the primary, prominent action on the review step; users who need neither note nor retake pay a single tap.
- [Free-text note goes straight into the model prompt] → Same surface as existing refinement corrections; the Edge Function prompt already treats user text as untrusted correction content. No new exposure.
- [User types a long note, then retake loses the moment] → Note state lives in the overlay (not `PhotoCapture`), so it survives the remount by construction.

## Migration Plan

Pure client-side, additive UI change; ship with the normal deploy. Rollback = revert the commit. No data or API migration.

## Open Questions

None.
