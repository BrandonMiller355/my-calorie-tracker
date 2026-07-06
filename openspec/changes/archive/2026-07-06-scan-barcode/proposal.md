## Why

Logging packaged food today means typing a text query and picking through fuzzy search results. Nearly every packaged product carries a barcode, and Open Food Facts — the database the app already searches — is keyed by that barcode. Scanning turns a multi-step type-and-pick flow into a single camera point for an exact match.

## What Changes

- Add a scan button to the search screen that opens a camera view and detects EAN-13/UPC-A barcodes using the browser-native `BarcodeDetector` API.
- The button is feature-detected: it is only shown when `BarcodeDetector` is available (Android/Chrome). No polyfill or fallback engine — unsupported browsers simply never see the feature.
- A detected barcode is looked up via the Open Food Facts product-by-barcode endpoint (`/api/v2/product/{code}`), reusing the existing product mapping and retry logic. A miss on a 12-digit UPC-A code is retried once with the zero-padded 13-digit form.
- A found product feeds the existing result-selection flow into the add-entry form (preserving in-progress form context such as meal, exactly like a text search result).
- Product not found and camera permission denied both land on the existing manual-entry fallback path. Barcodes are not persisted anywhere.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `food-search`: adds barcode scanning as a second way to find a food — new requirements for the feature-detected scan entry point, camera-based barcode detection, barcode product lookup, and safe fallback when the product is unknown or the camera is unavailable.

## Impact

- `src/api/openFoodFacts.ts`: new `getProductByBarcode()` alongside `searchFoods()`, sharing `mapProduct` and the retry wrapper.
- `src/screens/SearchScreen.tsx`: scan button (feature-detected) and integration with the existing `select()` flow.
- New camera/scanner UI component with a `BarcodeDetector` frame loop and camera stream lifecycle management.
- No new dependencies. Requires a secure context for `getUserMedia` (GitHub Pages deployment already satisfies this; testing on a phone means deploying).
