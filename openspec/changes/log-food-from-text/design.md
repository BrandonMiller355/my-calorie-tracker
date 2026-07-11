## Context

The app has two AI photo flows with a proven shape: a stateless, JWT-verified Supabase Edge Function holding the Gemini key (`analyze-food` estimates nutrition for unknown dishes; `identify-food` matches a photo against the library payload and returns candidate ids that the server revalidates), a thin client API module (`src/api/identifyFood.ts` pattern: plain fetch + AbortSignal + client-side revalidation), and overlays hosted by `EntryForm` that resolve into form prefills (`handleIdentified`, `applyEstimate`).

This change adds a text flow: one free-text description ("2 slices of sara lee bread with 1 serving of pbfit") becomes one or more logged entries. Unlike the photo flows, a single utterance can produce **multiple** items, which the one-entry-at-a-time `EntryForm` cannot represent — that multi-item step is the only genuinely new architecture.

## Goals / Non-Goals

**Goals:**
- One sentence → several proposed entries: library matches with amounts where the text names known foods, nutrition estimates where it doesn't.
- Review before anything is logged; nothing persists until the user confirms.
- Voice via the phone keyboard's dictation key (autofocused input), zero audio handling.
- Reuse the existing Edge Function pattern, client API pattern, and form-prefill paths wherever the item count allows.

**Non-Goals:**
- Audio recording, in-app speech recognition, or Web Speech API (future change).
- A correction/refinement loop like analyze-food's — the user edits the text and resubmits.
- Interpreting habitual quantities ("my normal shake" = 1 serving of the match).
- Per-item candidate choosers (identify's "torn between 2–3" UX) — see Decisions.

## Decisions

### 1. One Edge Function returning a mixed item list
`log-from-text` receives `{ text, meal, foods }` — `foods` being the same non-archived library payload `identify-food` sends (id, name, description, servingLabel, servingGrams) — and returns `{ items: [...] }`. Each item is a flat object the server revalidates into one of two kinds:

- **match**: `foodId` (must be in the request payload, else revalidation drops it) + optional amount + optional `meal`
- **estimate**: `name` + `calories/fat/carbs/protein` for the described portion + `confidenceNote` + optional `meal` (analyze-food's shape)

One call does parsing, matching, and estimating; Gemini's response schema can't express unions, so the schema is one object with all-optional fields and the server classifies each item (foodId wins when valid; else name+nutrition; else the item is dropped). Zero surviving items → a clear "couldn't understand that" error, not an empty success.

*Alternative considered*: separate parse and estimate calls (reusing analyze-food for unknowns) — doubles latency and rate-limit spend on the shared free-tier key for no quality gain.

### 2. At most one match per item, no candidate chooser
Where identify-food returns up to 3 ranked candidates, each text item carries at most one `foodId` (the model's best). Ambiguity ("bread" when two breads exist) is resolved by the review step: the item shows the matched food's name and calories, and a wrong match is fixed by editing the text or the item. A per-item chooser inside a multi-item list is disproportionate UI for the MVP.

### 3. Amounts as `servings` or `grams`, mirroring `IdentifiedAmount`
The model returns per match-item either `servings` (count of the food's serving label: "2 slices" → 2 when servingLabel is "slice") or `grams` ("150 g of rice"). The client applies grams only when the food's anchor offers `g` as a unit (same rule as `handleIdentified` at EntryForm.tsx:326); otherwise it falls back to 1 serving. Estimates are always 1 × the described portion, like `mapEstimateToResult`. Free-text units from the model are never trusted directly into the unit picker.

### 4. Unstated meal defaults to the dialog's meal, not time-of-day
The overlay is opened from the Add food dialog, which already carries the meal the user tapped "+" on (`defaultMeal`) — a stronger signal than the clock. The request sends that meal as context; the model only returns `meal` when the text states one ("for breakfast"). Review shows each item's meal as an editable select. (Supersedes the time-of-day idea from exploration: the form context is more predictable and already in hand.)

### 5. Single item skips review and prefills the form; multiple items get a review list
- **Exactly one item**: resolve it straight into the open `EntryForm` — matches through the `selectFood`/`handleIdentified` path, estimates through `applyEstimate`. All existing validation, macro-check, and "Edit nutrition" semantics apply unchanged. This is the common case ("I had my whey protein shake").
- **Two or more items**: the overlay shows a review list — per item: name (+ matched-food description), amount input + unit select (limited to that item's `availableUnits`), meal select, live computed calories, and a remove action. A primary **"Add N entries"** button logs them all.

*Alternative considered*: tap-an-item-to-edit handing off to `EntryForm` (floated during exploration). Rejected for the MVP: the overlay is *hosted by* the form, so handing one item down either drops the remaining items or requires a suspended-review state machine across two modals. Inline amount/unit/meal edits cover the realistic corrections; deeper nutrition edits are one tap away post-log via the existing entry edit flow.

### 6. Bulk add reuses `addEntry` sequentially, with per-item failure reporting
"Add N entries" derives each entry exactly as the form would — nutrition snapshot from the matched library food (or the estimate), `quantity` via `deriveQuantity`, `foodId` link for matches, `source: 'manual'` for matches (like a combobox pick) and `'search'` for estimates (like an accepted AI estimate) — and awaits `addEntry` per item. On a failure, already-added items stay added, the failed and remaining items stay in the list, and the standard save-failure message shows. No new storage APIs, no transaction (entries are independent rows).

### 7. Function mechanics copy `identify-food` verbatim where possible
CORS headers, JWT verification via deployment config, `GEMINI_API_KEY` secret, `gemini-3.5-flash`, JSON response schema + server-side revalidation, `thinkingConfig: { thinkingLevel: 'minimal' }`, the 429 → friendly-message mapping, and statelessness (text, payload, and result live only for the request; the client discards them when the overlay closes).

## Risks / Trade-offs

- **Wrong library match logged silently** (e.g. "bread" → the wrong bread) → review step always shows the resolved food name and computed calories before anything persists; single-item prefill lands in the form, which shows the same.
- **Shared Gemini free-tier rate limits** across three functions → same 429 messaging as identify; usage is single-user and bursty, acceptable for MVP.
- **Brand/abbreviation recall** ("pbfit") depends on library names/descriptions reaching the model → the payload already includes descriptions; users can improve recall by enriching descriptions, and the no-match path still yields a usable estimate item.
- **Partial bulk-add failure leaves the day half-logged** → per-item error handling keeps unfailed items in the list; entries are independent, so no corruption is possible.
- **No nutrition editing in the multi-item review** → deliberate cut; the existing entry edit flow covers it immediately after logging.

## Migration Plan

Pure addition: deploy the new Edge Function (`supabase functions deploy log-from-text` — `GEMINI_API_KEY` secret already set project-wide), then ship the SPA. No schema changes, no data migration; rollback is removing the button.

## Open Questions

- Button glyph for the header action (💬✨ vs 🎤✨ — 🎤 telegraphs the dictation intent even though the mic itself is the keyboard's). Cosmetic; decide during implementation.
