## ADDED Requirements

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
