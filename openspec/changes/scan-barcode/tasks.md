## 1. Barcode lookup API

- [x] 1.1 Extract the retry loop in `src/api/openFoodFacts.ts` into a generic helper shared by search and lookup (behavior unchanged for `searchFoods`)
- [x] 1.2 Add `getProductByBarcode(code, { signal })`: GET `/api/v2/product/{code}` with the existing `fields` list, map `status: 1` through `mapProduct`, return `null` on `status: 0`, throw on request failure
- [x] 1.3 Add the zero-pad retry: on a miss for a 12-digit code, retry once with the 13-digit zero-padded form inside `getProductByBarcode`
- [x] 1.4 Unit tests for `getProductByBarcode`: found, miss, zero-pad hit, zero-pad miss, retryable HTTP failure, abort

## 2. Scanner component

- [x] 2.1 Create `BarcodeScanner` component: start rear camera via `getUserMedia({ video: { facingMode: 'environment' } })` into a `<video>`, run `BarcodeDetector` (formats `ean_13`, `upc_a`, `upc_e`, `ean_8`) on an ~200 ms interval, call `onDetected(code)` on first hit
- [x] 2.2 Stop all media-stream tracks on detection, cancel, and unmount (cleanup effect); add a cancel affordance calling `onCancel`
- [x] 2.3 Handle `NotAllowedError`/`NotFoundError` from `getUserMedia`: render an inline message with the existing manual-entry link instead of the video

## 3. Search screen integration

- [x] 3.1 Add the scan button to `SearchScreen`, rendered only when `BarcodeDetector` exists and `getSupportedFormats()` includes a 1D retail format; toggles local `scanning` state (overlay, no new route)
- [x] 3.2 On detection, run `getProductByBarcode` with loading state; on a found product call the existing `select(result)` so `fromForm` meal context is preserved
- [x] 3.3 Handle not-found (message + manual-entry link, barcode not persisted) and lookup error (message + retry with captured code + manual-entry link), mirroring the existing empty/error blocks
- [x] 3.4 Tests: scan button hidden when `BarcodeDetector` absent; stubbed scanner detection drives lookup → select flow; not-found and error states render fallbacks with meal context intact

## 4. Verify on device

- [ ] 4.1 Run `npm run build` and tests; deploy to GitHub Pages
- [ ] 4.2 On an Android phone: scan a known product end-to-end into the add-entry form; confirm not-found fallback with an obscure barcode; confirm camera indicator turns off after cancel/detection
