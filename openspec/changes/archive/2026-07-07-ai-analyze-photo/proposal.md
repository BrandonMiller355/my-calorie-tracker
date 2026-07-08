## Why

Whole dishes (home-cooked meals, restaurant plates) have no barcode and are tedious to log: the user has to guess a name, search for an approximation, or hand-enter macros. A photo-based AI estimate turns "plate of food in front of me" into a pre-filled entry in one step, complementing barcode scanning for packaged foods.

## What Changes

- New "AI analyze" action on the search screen, alongside the existing barcode scan action.
- New camera capture overlay: single shutter-button frame grab (photo → canvas → JPEG), reusing the barcode scanner's camera lifecycle patterns but without a detection loop.
- Photo analysis via Google's Gemini API (free tier) rather than a paid provider — this is a personal single-user app, so free-tier rate limits are a non-issue.
- New Supabase Edge Function `analyze-food` that verifies the caller's Supabase JWT, holds `GEMINI_API_KEY` as a function secret, calls the Gemini API (free tier) with a structured-output schema, and returns a typed `{ name, calories, fat, carbs, protein }` estimate. The key never ships in the client bundle.
- New estimate-review UI: the estimate is presented as an explicit "AI estimate" (guess, not a database lookup) with the option to accept it or refine it.
- Multi-turn refinement chat: the user can send follow-up corrections (e.g. "there's rice under it too") and get a revised estimate. Conversation state is ephemeral and client-held — never persisted to Supabase.
- Accepting an estimate enters the existing `select()`/prefill add-entry flow used by search and barcode results, preserving `fromForm` context (meal, date).
- First Edge Function in the project: adds `supabase/functions/` and its deploy/secret-management workflow.

## Capabilities

### New Capabilities

- `ai-food-analysis`: Photo capture of a dish, server-proxied Gemini vision estimation of name/calories/macros, multi-turn refinement chat, and acceptance into the add-entry prefill flow.

### Modified Capabilities

<!-- none: food-search requirements are unchanged; the AI analyze action is an addition owned by the new capability, and existing search/scan behavior is untouched -->

## Impact

- **Client code**: `src/screens/SearchScreen.tsx` (new action + analysis states), new `src/components/PhotoCapture.tsx` (or similar) capture overlay, new estimate-review/chat component, new `src/api/analyzeFood.ts` client for the Edge Function.
- **Server/infra**: new `supabase/functions/analyze-food/` Edge Function (Deno); `GEMINI_API_KEY` set as a Supabase function secret; function deployed via Supabase CLI or dashboard.
- **External services**: Google Gemini API (free tier; per-minute/per-day rate limits, no billing). Supabase Edge Function invocations (free-tier volumes at single-user scale).
- **Dependencies**: no new npm dependencies in the client. Edge Function calls Gemini over plain `fetch` (no SDK needed).
- **Database**: none. Estimates are not persisted; an accepted estimate enters the form as a prefill and saves as `source: 'search'` like other prefills, which the existing check constraint already allows (no schema migration).
- **Testing**: camera and Edge Function are untestable in jsdom; unit-test the client API wrapper and screen state handling with stubs, verify the camera/analysis path manually on the deployed site (same approach as scan-barcode).
