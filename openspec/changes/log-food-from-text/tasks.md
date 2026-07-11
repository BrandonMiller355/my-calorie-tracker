## 1. Edge Function

- [x] 1.1 Create `supabase/functions/log-from-text/index.ts` cloned from `identify-food`: CORS, JWT-verified deployment, `GEMINI_API_KEY`, `gemini-3.5-flash` with minimal thinking, 429 mapping
- [x] 1.2 Define the request contract (`text`, `meal`, `foods` payload reusing identify's shape) and validate it (reject blank text, missing/empty foods list handled per design — foods may legitimately be empty for a new user; all items then come back as estimates)
- [x] 1.3 Write the system prompt: split the description into items; per item return `foodId` from the list OR `name` + per-portion nutrition + `confidenceNote`; optional `servings`/`grams`; `meal` only when the text states one; never force a match
- [x] 1.4 Define the Gemini response schema (flat all-optional item fields) and server-side revalidation: classify each item as match (known `foodId`) or estimate (name + finite non-negative nutrition), drop unusable items, error when none survive
- [ ] 1.5 Deploy the function and smoke-test with curl: multi-known-food text, mixed known/unknown, meal stated, gibberish

## 2. Client API

- [x] 2.1 Create `src/api/logFromText.ts` following `identifyFood.ts`: plain fetch with AbortSignal, session JWT, `buildRequestFoods` reuse (export it or mirror it), typed `TextLogItem` union (match | estimate) with client-side revalidation against submitted ids
- [x] 2.2 Add resolution helpers: match item + `LibraryFood` → prefill values (amount/unit via the grams-only-when-anchor-converts rule, default 1 serving), estimate item → `FoodSearchResult` via the `mapEstimateToResult` pattern, meal fallback to the dialog's meal
- [x] 2.3 Unit-test the API module and resolution helpers (revalidation drops bad ids, amount fallbacks, meal fallback)

## 3. Text input overlay

- [x] 3.1 Create `TextLogOverlay` component: autofocused textarea, disabled-when-blank send, cancel; phases `entering` → `parsing` → (`review` | error back to `entering` with text preserved)
- [x] 3.2 Wire the parsing call with abort-on-close and the unintelligible-description message (text preserved for edit/resend)
- [x] 3.3 Component tests: focus on open, blank send disabled, cancel logs nothing, error path preserves text

## 4. Review list and bulk add

- [x] 4.1 Build the review phase inside `TextLogOverlay`: per item show resolved name (+ matched description), amount input, unit select limited to `availableUnits` of that item's anchor, meal select, live computed calories, remove action; "Add N entries" confirm
- [x] 4.2 Implement bulk add: derive each entry like the form does (`deriveQuantity`, anchor snapshot, `foodId` link, `source` 'manual' for matches / 'search' for estimates) and await `addEntry` per item; on failure keep failed + remaining items with the save-failure message and retry only those
- [x] 4.3 Component tests: multi-item review renders all items, amount edit updates calories, remove excludes an item, partial failure keeps remaining items, confirm closes the dialog

## 5. EntryForm integration

- [x] 5.1 Add the log-from-text header action next to 📷✨ (add mode only) opening `TextLogOverlay`
- [x] 5.2 Single-item short-circuit: one match → fill via the `selectFood` path with resolved amount/unit/meal; one estimate → fill via `applyEstimate`; overlay closes
- [x] 5.3 Multi-item confirm closes the entry form after logging (dialog's job is done); cancel at any point leaves the form untouched
- [x] 5.4 Extend `EntryForm` tests: action hidden when editing, single-match prefill, single-estimate prefill, cancel preserves form state

## 6. Verify end-to-end

- [ ] 6.1 Run the full flow in the app against the deployed function: multi-item dictated-style text logs correct entries under the right meals; single-item text lands in the form; totals update
- [x] 6.2 Run the whole test suite and typecheck
