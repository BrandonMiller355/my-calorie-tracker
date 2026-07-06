## Context

The app is a Vite/React SPA deployed to GitHub Pages. `SearchScreen` debounce-searches Open Food Facts (OFF) via `searchFoods()` in `src/api/openFoodFacts.ts`, which already models OFF's product shape (`OffProduct`), maps it to `FoodSearchResult` (`mapProduct`), and wraps requests in retry logic for OFF's intermittent 503s. A selected result navigates to the add-entry form via `select()`, carrying `fromForm` context (meal, date). OFF is keyed by barcode — the `code` field the app already uses as a result id — so barcode lookup is an exact-key variant of the existing search.

Constraints: the user's target device is Android/Chrome only; no interest in iOS/Safari support. No new dependencies desired. `getUserMedia` requires a secure context — fine on GitHub Pages, which is also the intended test path (deploy, then scan with the phone).

## Goals / Non-Goals

**Goals:**
- Scan a packaged product's barcode from the search screen and land in the pre-filled add-entry form in one step.
- Reuse the existing OFF mapping (`mapProduct`), retry wrapper, and `select()` flow unchanged.
- Degrade invisibly: browsers without `BarcodeDetector` never see the feature.

**Non-Goals:**
- iOS/Safari/Firefox support, polyfills, or WASM detection engines.
- Persisting barcodes (in the food library, entries, or anywhere else).
- Scanning QR codes or formats beyond retail product barcodes.
- Local-library-by-barcode lookup before hitting the network.

## Decisions

**Native `BarcodeDetector`, feature-detected, no fallback engine.** The user's device is Android/Chrome, where the API is hardware-backed and free. A ponyfill (`barcode-detector`/zxing-wasm) would add ~1 MB of WASM to cover browsers the user explicitly doesn't care about. Detection gate: `'BarcodeDetector' in window` decides whether the scan button renders at all — no runtime error paths for unsupported browsers. Formats restricted to `['ean_13', 'upc_a', 'upc_e', 'ean_8']` to keep detection fast and avoid QR false-positives.

**Lookup lives in `openFoodFacts.ts` as `getProductByBarcode(code, { signal })`.** Uses `GET https://world.openfoodfacts.org/api/v2/product/{code}` with the same `fields` list as search. The v2 endpoint returns `{ status: 1, product: {...} }` on hit; a miss is an HTTP 404 carrying a `status: 0` body — both the 404 and a status-0 body map to a `null` return (distinct from a thrown error, which means "lookup failed"). Reuses the `RetryableError`/`searchWithRetry`-style retry loop (extract the generic retry helper rather than duplicating it) and `mapProduct` for the result. No ranking/filtering — it's an exact key.

**Zero-pad retry for UPC-A.** OFF stores some US products under the 13-digit zero-padded EAN form. On a `status: 0` miss for a 12-digit code, retry once with `'0' + code`. Handled inside `getProductByBarcode` so callers see one lookup. (Chrome typically reports UPC-A as 12 digits with format `upc_a`; some devices report the same barcode as `ean_13` already padded — trying the raw code first, padded second covers both.)

**Scanner is an overlay on `SearchScreen`, not a route.** A `BarcodeScanner` component rendered conditionally by `SearchScreen` (local `scanning` state) rather than a new router path. Rationale: `fromForm` context lives in `location.state`; staying on the same location means no re-threading of that state through another navigation hop. Cancel is just `setScanning(false)`.

**Camera lifecycle.** On mount: `getUserMedia({ video: { facingMode: 'environment' } })` into a `<video>` element. Detection loop: `requestAnimationFrame` (or a modest `setInterval`, ~200 ms) calling `detector.detect(video)`; first non-empty result wins. On any exit (detection, cancel, unmount): stop all `MediaStream` tracks in a cleanup effect — leaked camera streams keep the phone's camera indicator on. Permission denial (`NotAllowedError`) and no-camera (`NotFoundError`) render an inline message with the existing manual-entry link instead of the video.

**Post-scan states reuse the existing search-state pattern.** After a detection, `SearchScreen` runs the lookup with the same loading/error affordances text search uses:
- found → call the existing `select(result)` (meal context preserved for free)
- `null` (not found) → "not found" message with the existing manual-entry `Link` (same shape as the empty-results block)
- thrown error → error block with retry (re-run lookup with the captured code) and manual-entry link

## Risks / Trade-offs

- [`BarcodeDetector` availability doesn't guarantee it detects 1D formats] → check `BarcodeDetector.getSupportedFormats()` async at mount and treat "no ean_13/upc_a support" the same as API-absent (hide the button). Cheap and removes the worst surprise.
- [Camera behavior is untestable in jsdom] → keep `BarcodeScanner` thin; unit-test `getProductByBarcode` (hit, zero-pad retry, miss, error) and the SearchScreen state handling by stubbing the scanner; verify the camera path manually on the deployed site.
- [OFF product endpoint rate limit (100 req/min) ] → not a realistic risk for one user scanning by hand; no client throttle needed.
- [Detection loop battery/CPU cost] → interval-based detection at ~5 fps is plenty for retail barcodes and cheaper than per-frame rAF.
- [Testing requires deploy] → accepted by the user; `getUserMedia` won't run over LAN HTTP, and that's fine.

## Open Questions

None — engine, entry point, fallback behavior, and persistence were all settled during exploration.
