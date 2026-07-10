## Why

Logging a food that is already in the library still requires typing or picking its name and entering the weight, even though the typical logging moment is standing at the kitchen scale with the food right there. A photo of the food on the scale contains everything needed — which library food it is and how much of it there is — so an AI identification step can collapse logging to: snap, confirm, save.

Unlike the existing AI analyze flow (which *estimates* nutrition for unknown dishes), this feature only *identifies* which already-saved food is in the photo; the library provides ground-truth nutrition.

## What Changes

- Add a **camera action to the Add Food dialog** (entry form in add mode, top right) that captures or picks a photo and reuses the existing pre-send review step (frozen frame, retake, optional context note, explicit send).
- Add a new **`identify-food` Supabase Edge Function** (same JWT/CORS/server-held Gemini key pattern as `analyze-food`, stateless, nothing persisted) that receives the photo plus the user's non-archived library foods (id, name, description, serving anchor incl. weight equivalence) and returns up to 3 ranked candidate food ids, plus an optional weight amount tagged with its source: `scale` (read from a visible scale display) or `estimate` (visual judgment against the food's known serving weight). An unreadable display yields no amount, never a guess.
- **Fill the entry form in place** from the result: a single confident match fills name, nutrition, and serving anchor directly; 2–3 plausible candidates show a chooser first; the amount and unit are prefilled in grams when a weight came back and the food has a weight equivalence, otherwise 1 serving.
- **No-match fallback into AI estimate**: when nothing in the library matches, offer to hand the same photo to the existing AI estimate flow. That flow gains the ability to start from an already-captured photo and to deliver its accepted result into the open entry form instead of navigating with a prefill.

## Capabilities

### New Capabilities

- `ai-food-identify`: photograph a food (typically on the kitchen scale) from the Add Food dialog and have an AI match it against the user's food library, prefilling the form with the matched food and, when readable, the weight.

### Modified Capabilities

- `ai-food-analysis`: the analyze flow SHALL be startable with an already-captured photo (skipping capture, entering at the pre-send review) and SHALL be hostable from the entry form, delivering the accepted estimate into the open form in place rather than navigating with a prefill.

## Impact

- **New**: `supabase/functions/identify-food/index.ts`, client API module (`src/api/identifyFood.ts`), identify overlay/chooser component(s), tests.
- **Modified**: `src/components/EntryForm.tsx` (camera action, in-place fill), `src/components/AiAnalyzeOverlay.tsx` (accept an initial photo; result callback instead of navigation-only), possibly `src/components/PhotoCapture.tsx` consumers.
- **Sequencing**: the active `select-photo-from-library` change also modifies `PhotoCapture`/`AiAnalyzeOverlay` (file-picker photo source). Land that change first; this feature then inherits the file-picker path for free.
- **No schema changes**: no new tables; photos and identification results are never persisted.
