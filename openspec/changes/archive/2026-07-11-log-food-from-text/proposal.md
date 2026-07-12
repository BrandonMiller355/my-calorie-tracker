## Why

Logging a meal today means one entry at a time through the form, even when the user can describe the whole meal in one sentence ("I had 2 slices of sara lee bread with 1 serving of pbfit"). A free-text "describe what you ate" flow lets one dictated or typed sentence become several logged entries — and because phone keyboards ship a dictation key, this delivers voice logging without any audio capture work.

## What Changes

- New "log from text" action in the Add food dialog header, next to the existing identify-from-photo (📷✨) action.
- The action opens an overlay with a single autofocused free-text box (autofocus pops the mobile keyboard, putting its dictation key one tap away) and a send action.
- New `log-from-text` Supabase Edge Function (same auth/statelessness/key-protection pattern as `identify-food`): receives the text plus the user's non-archived library foods and returns a list of parsed items. Each item is either a **library match** (food id + amount + unit + optional meal) or an **unknown food** (name + estimated per-portion nutrition, like `analyze-food` returns).
- New review step listing the parsed items (name, amount, meal, calories) where the user can remove items, tap an item to edit it in the existing entry form, and "Add all" to log the rest in one action.
- Meal comes from the text when stated ("for breakfast"); otherwise defaults to a time-of-day guess, editable in review.
- Scope cuts (deliberate, for the MVP): no audio recording or in-app speech recognition; no correction loop (the user edits the text and resubmits); "my normal X" resolves to 1 serving of the matched library food.

## Capabilities

### New Capabilities
- `ai-text-logging`: describe a meal in free text; an AI model parses it against the food library into one or more proposed entries (library matches with amounts, or nutrition estimates for unknown foods); the user reviews, adjusts, and bulk-logs them.

### Modified Capabilities

<!-- none: entries created by this flow are ordinary food-logging entries; the Add food dialog's existing behavior is unchanged when the new action is unused -->

## Impact

- **New Edge Function**: `supabase/functions/log-from-text/` calling Gemini with the server-held `GEMINI_API_KEY` (same secret as the existing functions; free-tier rate limits now shared across three functions).
- **New client code**: `src/api/logFromText.ts` (clone of the `identifyFood.ts` fetch/abort/revalidate pattern), a text-input overlay component, and a review-list component.
- **Touched**: `src/components/EntryForm.tsx` (second header action + handing a reviewed item to the form for editing); day-log state via the existing `addEntry` path called once per accepted item — no storage or schema changes.
- **Unchanged**: data model, persistence, existing AI photo flows.
