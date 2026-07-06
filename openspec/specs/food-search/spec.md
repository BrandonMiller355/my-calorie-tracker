# food-search Specification

## Purpose
TBD - created by syncing change add-calorie-tracker. Update Purpose after review.

## Requirements

### Requirement: Search external food database
The system SHALL provide a search screen where the user enters a text query and receives matching foods from a public food database API (Open Food Facts).

#### Scenario: Successful search
- **WHEN** the user submits a query that matches foods in the database
- **THEN** the system displays a list of results, each showing the food name and per-serving calories, carbs, protein, and fat where available

#### Scenario: No results
- **WHEN** the user submits a query with no matches
- **THEN** the system shows a "no results" message and offers manual entry as a fallback

#### Scenario: API unavailable
- **WHEN** the search request fails or times out
- **THEN** the system shows a non-blocking error message and offers manual entry as a fallback

### Requirement: Select a search result
The system SHALL let the user select a result and hand its name, nutrition data, and serving anchor to the food-logging flow, pre-filled and editable before saving. When the search screen was opened from within the add-entry form, selecting a result (or navigating back) SHALL return the user to that form with its in-progress context — notably the selected meal — restored.

#### Scenario: Select result to log
- **WHEN** the user selects a search result
- **THEN** the add-entry form opens pre-filled with the result's name, nutrition values, and serving anchor for the user to adjust meal, amount, and unit

#### Scenario: Return to an in-progress form
- **WHEN** the user opened search from the add-entry form's "search online" action with meal "lunch" selected, then selects a result
- **THEN** the add-entry form reopens pre-filled with the result and the meal still set to "lunch"

#### Scenario: Standalone search unchanged
- **WHEN** the user opens the search screen directly (not from the add-entry form) and selects a result
- **THEN** the add-entry form opens pre-filled with the result using the default meal behavior

### Requirement: Incomplete nutrition data
The system MUST handle results with missing nutrient fields by treating missing values as blank (not zero) in the pre-filled form and requiring the user to confirm before saving.

#### Scenario: Result missing a macro
- **WHEN** a selected result lacks a value for one or more macros
- **THEN** the corresponding form fields are blank and flagged for the user to fill in or confirm

### Requirement: Structured serving data from results
The system SHALL map each search result's serving information to a structured anchor. When per-serving nutrients exist and the result carries a parseable positive serving quantity in grams or milliliters, the anchor SHALL be "1 serving = that quantity". When only per-100g (or per-100ml) nutrients exist, the result's nutrition SHALL be treated as one serving anchored at 100 g (or 100 ml). Serving data that is missing, non-positive, or in an unrecognized unit MUST degrade to a count-only anchor (label "serving", no equivalence) — never to a wrong equivalence.

#### Scenario: Per-100g result is loggable by weight
- **WHEN** a result has only per-100g nutrients and the user selects it and logs 45 g
- **THEN** the entry's totals are 45% of the per-100g values

#### Scenario: Unusable serving data degrades safely
- **WHEN** a result has per-serving nutrients but its serving quantity is missing or in an unrecognized unit
- **THEN** the result is offered with a count-only "serving" anchor and no weight or volume units

### Requirement: Feature-detected scan entry point
The search screen SHALL offer a barcode scan action only when the browser exposes the native `BarcodeDetector` API. When the API is unavailable, the scan action MUST NOT be rendered and all other search behavior SHALL be unchanged.

#### Scenario: Supported browser shows scan action
- **WHEN** the user opens the search screen in a browser where `BarcodeDetector` is available
- **THEN** a scan action is visible alongside the text search input

#### Scenario: Unsupported browser hides scan action
- **WHEN** the user opens the search screen in a browser without `BarcodeDetector`
- **THEN** no scan action is shown and text search works as before

### Requirement: Camera barcode detection
The system SHALL, when the scan action is activated, open a camera view using the rear-facing camera and detect EAN-13 and UPC-A barcodes from the live stream using `BarcodeDetector`. The camera stream MUST be stopped when a barcode is detected, the user cancels, or the user navigates away.

#### Scenario: Barcode detected
- **WHEN** the user points the camera at a product barcode
- **THEN** the system captures the decoded barcode value, stops the camera, and proceeds to product lookup

#### Scenario: User cancels scanning
- **WHEN** the user dismisses the camera view without a detection
- **THEN** the camera stream is stopped and the user returns to the search screen with its prior state intact

#### Scenario: Camera permission denied
- **WHEN** the user denies camera access (or the camera is unavailable)
- **THEN** the system shows a non-blocking message and offers text search and manual entry as fallbacks

### Requirement: Barcode product lookup
The system SHALL look up a scanned barcode against the Open Food Facts product-by-barcode API and map a found product to a search result using the same nutrition and serving mapping rules as text search results. When a 12-digit UPC-A lookup finds no product, the system SHALL retry once with the 13-digit zero-padded form before treating the product as not found.

#### Scenario: Product found
- **WHEN** a scanned barcode matches a product in the database
- **THEN** the product is handed to the existing result-selection flow, opening the add-entry form pre-filled with its name, nutrition values, and serving anchor, preserving any in-progress form context (such as the selected meal)

#### Scenario: UPC-A found under zero-padded code
- **WHEN** a 12-digit barcode lookup misses but the 13-digit zero-padded form matches a product
- **THEN** the product is returned as if the original lookup had succeeded

#### Scenario: Product not found
- **WHEN** a scanned barcode matches no product (including after the zero-pad retry)
- **THEN** the system shows a "not found" message and offers manual entry as a fallback, and the barcode is not persisted

#### Scenario: Lookup request fails
- **WHEN** the barcode lookup request fails after retries
- **THEN** the system shows a non-blocking error message and offers manual entry as a fallback
