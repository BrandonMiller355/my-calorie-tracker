## Context

The app is a Vite/React SPA on GitHub Pages backed by Supabase (auth + Postgres with RLS; publishable key in the bundle, secrets never). `SearchScreen` already hosts two entry paths that end in the same place: text search and barcode scan both produce a `FoodSearchResult` and call `select()`, which navigates to the add-entry form with a prefill while preserving `fromForm` context (meal, date). `BarcodeScanner` established the camera patterns: overlay component (not a route), `getUserMedia({ video: { facingMode: 'environment' } })`, tracks stopped on every exit path, permission/no-camera errors rendered inline with a manual-entry fallback.

This change adds a third entry path — photograph a dish, get a Gemini vision estimate of name/calories/macros, optionally refine it via chat, accept into the same prefill flow. Unlike barcode scanning (local browser API, keyless), this path calls a third-party API with a secret key, which forces a server-side component: the project's first Supabase Edge Function.

Constraints: no Gemini key in the client bundle (house rule in `.env.example`; the bundle is public on GitHub Pages). Target device is Android/Chrome. No new npm dependencies in the client. Estimates and conversations are never persisted. Camera requires a secure context — testing happens on the deployed site, as with scan-barcode.

## Goals / Non-Goals

**Goals:**
- Photograph a dish from the search screen and land in a pre-filled add-entry form.
- Keep the Gemini key server-side; only authenticated app users can trigger analysis.
- Let the user correct the AI ("there's rice under it too") and get a revised estimate before accepting.
- Present the result as an explicit estimate, not a database fact.
- Reuse `select()`/prefill, `fromForm` context, and the existing camera-error affordances unchanged.

**Non-Goals:**
- Persisting photos, estimates, or chat transcripts (to Supabase or anywhere).
- A general nutrition chatbot; the chat exists only to refine the current photo's estimate.
- Serving-size decomposition (grams of each component, `servingSize` equivalences). The estimate covers the photographed portion as one serving.
- Barcode/OCR of nutrition labels via AI (the barcode path already covers packaged foods).
- Offline behavior, iOS/Safari-specific work, or rate limiting beyond what auth provides.

## Decisions

**Proxy via a Supabase Edge Function (`analyze-food`), not a client-side key or a separate host.** The client sends the user's JWT; the function runs with `verify_jwt` enabled so unauthenticated calls are rejected before our code runs. `GEMINI_API_KEY` lives in Supabase function secrets. Alternatives: key in the bundle (rejected — public bundle, anyone could consume the key's quota or get it revoked; violates the project's own `.env.example` rule) and a Cloudflare Worker (rejected — new platform, new deploy story, when Supabase is already authenticated infrastructure in this app). This is the project's first Edge Function; code lives at `supabase/functions/analyze-food/index.ts` (Deno, plain `fetch` to Gemini — no SDK), deployed with the Supabase CLI (`npx supabase functions deploy analyze-food`), secret set once via `npx supabase secrets set`. The function must handle CORS (respond to `OPTIONS`, echo the allowed origin) because the SPA origin (github.io) differs from the functions origin.

**Gemini free tier as the provider.** The user has a free-tier Gemini API key; a personal tracker's usage (a few analyses a day, each with maybe a few refinement turns) sits comfortably inside free-tier rate limits, making the feature cost nothing to run. The provider is invisible to the client — the function's request/response contract is provider-neutral — so swapping providers later is a function-only change. Free-tier 429s are mapped to a "rate-limited, try again in a minute" message. Trade-off accepted: Google may use free-tier inputs for product improvement; the inputs here are food photos, which the user is fine with.

**Stateless function, client-held conversation, image resent per turn.** Each request carries the JPEG (base64 data URL) plus the correction turns so far; the function forwards them as a single Gemini user turn (photo part followed by correction text parts — Gemini rejects multiturn content that doesn't alternate user/model, and there are no model turns to send) and returns the estimate. Alternative: a provider-side stateful conversation — rejected because it requires provider-side storage and makes the function/API contract stateful; at single-user volumes the resend cost is nothing on the free tier. This also makes "ephemeral, never persisted" trivially true: closing the overlay discards the React state and nothing exists server-side.

**Structured outputs via Gemini's response schema.** The function calls a fast vision-capable model (default `gemini-2.5-flash`, a constant in the function — changeable without touching the client) with `responseMimeType: application/json` and a `responseSchema` requiring `{ name: string, calories: number, fat: number, carbs: number, protein: number, confidenceNote: string }`; thinking is disabled (`thinkingBudget: 0`) since a nutrition guess doesn't need it and it would slow every turn. Gemini's schema conformance is not contractually strict, so the function revalidates the parsed JSON before returning it. `confidenceNote` is a one-line model-written caveat (e.g. "assumed ~1 cup of rice") surfaced in the review UI — it gives the user something concrete to correct. No prose parsing, no regex.

**Capture is a one-shot frame grab in a new `PhotoCapture` component.** Camera opens into a `<video>` (same lifecycle rules as `BarcodeScanner`: stop all tracks on capture/cancel/unmount; same `NotAllowedError`/`NotFoundError` messages and fallback slot), a shutter button draws the current frame to a canvas, downscales so the long edge is ≤1024px, and exports JPEG (~0.8 quality) — plenty for food recognition, keeps payloads well under Edge Function request limits and Gemini image-token usage low. No detection loop, no `BarcodeDetector` — which also means the availability gate differs: the AI analyze button renders when `navigator.mediaDevices?.getUserMedia` exists (broader than the barcode button's `BarcodeDetector` gate).

**One self-contained overlay owns the whole flow.** A new `AiAnalyzeOverlay` component runs the capture → analyzing → review/chat state machine internally and exposes only `onAccept(result: FoodSearchResult)` and `onCancel()`. `SearchScreen` just toggles it (local state, same pattern as `scan.kind === 'scanning'`) and wires `onAccept` to the existing `select()`. Rationale: the barcode flow's lookup states live in `SearchScreen` and that was fine for one async hop, but capture + estimate + N chat turns is a real state machine; keeping it inside one component avoids swelling `SearchScreen` with a second, larger state enum. The review step shows the captured photo thumbnail, the estimate labeled "AI estimate" with the confidence note, a single correction text box with an "Ask again" action, and "Use this estimate".

**Accepted estimate maps to a plain `FoodSearchResult`.** `id: crypto.randomUUID()`, `servingLabel: 'serving'` (the photographed portion is the serving; no `servingSize` equivalence — the model can't reliably know weights), name and macros from the estimate. All four nutrient fields are always numbers (never `undefined`), so the form's "missing, confirm" flagging won't trigger; the estimate labeling lives in the review step, before the form. The entry saves as `source: 'search'` via the existing prefill branch in `EntryForm` — allowed by the current DB check constraint, so no migration. Alternative considered: a new `source: 'ai'` for later accuracy curiosity — rejected for v1; it's a check-constraint migration with no user-facing behavior attached.

**Client API wrapper `src/api/analyzeFood.ts`.** Mirrors `openFoodFacts.ts` in spirit: a typed `analyzeFood(request, { signal })` that invokes the Edge Function, validates the response shape, and throws a message-bearing error on failure (surfaced by the overlay's error state with retry). Turn payload type is shared between wrapper and overlay.

## Risks / Trade-offs

- [Estimates can be badly wrong — portion size from a photo is genuinely hard] → explicit "AI estimate" labeling plus the model's own `confidenceNote`; the user reviews before accepting and the form remains fully editable after. The refinement chat exists precisely to fix the common miss ("that's a bigger bowl than it looks").
- [First Edge Function: new deploy surface, new failure modes (cold start, CORS, secret misconfig)] → keep the function tiny (one route, one fetch); document deploy + secret commands in the function's README section of tasks; CORS handled explicitly; misconfiguration (missing key) returns a distinct 500 message the client shows verbatim in the error state.
- [Open proxy risk — a deployed function endpoint reachable outside the app] → `verify_jwt` restricts callers to signed-in Supabase users of this project, and sign-ups are effectively just the owner. Not adding per-user rate limiting at single-user scale.
- [Payload size: base64 JPEG per turn, resent every correction] → ≤1024px/0.8-quality capture keeps images ~100–300 KB; a multi-turn chat resends that a handful of times. Accepted at this scale — free-tier calls cost nothing.
- [Free-tier rate limits (per-minute/per-day request caps)] → single-user usage sits far below them; a 429 surfaces as a distinct "rate-limited, try again in a minute" message rather than a generic failure.
- [Camera + Edge Function untestable in jsdom] → same split as scan-barcode: unit-test `analyzeFood` wrapper (success, HTTP error, malformed response), estimate→`FoodSearchResult` mapping, and overlay state handling with a stubbed capture + stubbed API; verify camera and live analysis manually on the deployed site.
- [Analysis latency (a few seconds per turn)] → explicit "Analyzing…" state and a disabled thinking budget; the abort controller cancels on overlay close so a slow response can't act on a dismissed UI.
- [Model deprecation (`gemini-2.5-flash` naming drift)] → model id is one constant in the function; redeploying the function is the whole upgrade.

## Migration Plan

1. Deploy the Edge Function and set `GEMINI_API_KEY` before shipping the client change (the button fails gracefully into the error state if the function 404s, but there's no reason to ship them out of order).
2. Client deploys as usual via GitHub Pages. No DB changes; nothing to roll back beyond redeploying without the button.

## Open Questions

None blocking. If estimate quality disappoints, the next levers (in order): richer prompt (ask for per-component reasoning before totals), a stronger model constant, or letting the model also propose a `servingSize` weight — all server-side changes.
