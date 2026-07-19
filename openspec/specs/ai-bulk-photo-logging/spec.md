# ai-bulk-photo-logging Specification

## Purpose
Log a meal that was assembled incrementally on a tared kitchen scale (beans, then cheese sauce, then salsa — one photo per addition) in a single pass: select the photos from the device gallery, identify each photo's newly added food against the library via sequential chained identify-food requests, and bulk-log every item from one editable review list. Builds on the ai-food-identify capability without changing its server contract.

## Requirements
### Requirement: Bulk-photos entry point in the Log Food dialog
The Log Food dialog (entry form in add mode) SHALL offer a "bulk photos" action in its header alongside the identify-from-photo and log-from-text actions. The action MUST NOT be rendered when editing an existing entry, and all other entry-form behavior SHALL be unchanged when the action is unused.

#### Scenario: Action shown when adding
- **WHEN** the user opens the Log Food dialog to add an entry
- **THEN** the bulk-photos action is visible in the dialog header alongside the identify-from-photo and log-from-text actions

#### Scenario: Action hidden when editing
- **WHEN** the user opens the dialog to edit an existing entry
- **THEN** no bulk-photos action is shown

### Requirement: Multi-photo selection from the device gallery
Activating the bulk-photos action SHALL open the device's native file picker restricted to images with multi-selection enabled; the flow is gallery-only and SHALL NOT offer camera capture. Each selected image SHALL be downscaled and re-encoded as a JPEG whose long edge does not exceed 1024 pixels, using the same output constraints as the single-photo flows. The selected photos SHALL be ordered by their file modification time (capture time for gallery photos), ascending, and this order SHALL define the identification sequence. The system SHALL enforce an upper bound on the number of photos per batch, rejecting larger selections with a non-blocking message instead of processing a truncated subset.

#### Scenario: User selects several photos
- **WHEN** the user activates the bulk-photos action and selects three gallery photos
- **THEN** all three are downscaled to the standard photo constraints and ordered by file modification time ascending for identification

#### Scenario: User cancels the picker
- **WHEN** the user dismisses the native file picker without choosing files
- **THEN** nothing is identified and the entry form is exactly as they left it

#### Scenario: Selection exceeds the batch cap
- **WHEN** the user selects more photos than the batch limit
- **THEN** a non-blocking message states the limit and the user can reselect; no identification requests are sent

#### Scenario: A selected file is not a decodable image
- **WHEN** one selected file cannot be decoded as an image
- **THEN** a non-blocking message identifies the problem and the remaining decodable photos proceed

### Requirement: Sequential chained identification of each photo's new addition
The system SHALL identify the photos one at a time, in order, through the existing `identify-food` Edge Function without server-side changes, sending each request the user's non-archived library foods per that capability's rules. Every request after the first SHALL carry a client-built context note in the request's note field stating: which foods (top-ranked candidate and any returned weight) earlier photos in the sequence contained, that a later photo may show the same dish with a new item added and only the new addition is to be identified, and that the scale is tared before each addition so a visible scale reading is the new item's weight alone. A photo that was not recognized SHALL be represented in later notes as an unidentified addition. While identification runs, the system SHALL show which photo of how many is being analyzed. Identification requests MUST be sequential, never parallel.

#### Scenario: Second photo identifies only the addition
- **WHEN** photo 1 was identified as black beans at 142 g and photo 2 (the same bowl with cheese sauce added, scale re-tared and reading 89 g) is sent
- **THEN** the request's note states the dish already contained black beans (142 g), that only the new addition is to be identified, and that the scale is tared between additions — and the resulting row is the cheese-sauce match at 89 g, not beans

#### Scenario: Progress shown during the batch
- **WHEN** the second of four photos is being identified
- **THEN** the user sees an indication equivalent to "Analyzing photo 2 of 4"

#### Scenario: Unrecognized photo still advances the chain
- **WHEN** photo 2 returned no candidates and photo 3 is sent
- **THEN** photo 3's note describes the dish as containing photo 1's food plus an unidentified addition

### Requirement: Single review list of identified items
When the batch completes, the system SHALL present all results as one review list, in identification order, with one row per photo showing: the photo's thumbnail, the matched food's name, an editable amount and unit, and an editable meal selection defaulting to the dialog's selected meal. Amount and unit SHALL be prefilled by the single-photo rules: the returned gram amount with unit grams when the food's serving anchor offers grams as a logging unit, otherwise 1 of the food's serving label with any gram amount ignored. An amount whose source is an AI visual estimate SHALL be visibly labeled as such. Each row SHALL offer a remove action. Nothing SHALL be logged before the explicit bulk-log action.

#### Scenario: Rows prefilled from scale reads
- **WHEN** three photos each matched a library food with a scale-read weight and every food's anchor offers grams
- **THEN** the review list shows three rows in photo order, each with its thumbnail, the food's name, the read weight in grams, and the dialog's meal preselected

#### Scenario: Matched food without weight equivalence
- **WHEN** a row's food has no weight equivalence in its serving anchor and the response included a gram amount
- **THEN** that row prefills 1 of the food's serving label and the gram amount is ignored

#### Scenario: User removes a row
- **WHEN** the user activates a row's remove action
- **THEN** the row disappears and the bulk-log count decreases accordingly

### Requirement: Ambiguous identifications resolved inline without stalling the batch
When a photo's identification returns two or three candidates, the batch SHALL continue without interruption: the row SHALL preselect the top-ranked candidate, be visibly marked as uncertain, and offer an inline picker of the returned candidates showing at least each food's name. Changing the picked candidate SHALL re-prefill that row's amount and unit from the newly picked food per the prefill rules. No blocking chooser SHALL appear during identification.

#### Scenario: Uncertain row preselects the top candidate
- **WHEN** a photo returns two ranked candidates
- **THEN** identification of the remaining photos continues, and the finished list shows that row preselected to the top candidate, marked uncertain, with both candidates pickable inline

#### Scenario: User picks the other candidate
- **WHEN** the user switches an uncertain row to the second candidate
- **THEN** the row shows that food's name and re-prefilled amount and unit, and logging uses the picked food

### Requirement: Unrecognized photos excluded from logging
When a photo's identification returns no candidates, its row SHALL state that the photo was not recognized in the library, SHALL be excluded from the bulk-log count and from logging, and SHALL offer only removal. The flow SHALL NOT offer the AI-estimate fallback for unrecognized photos.

#### Scenario: Unrecognized row shown but not logged
- **WHEN** one of four photos returns no candidates
- **THEN** the review list shows that row as not recognized, the bulk-log action counts three entries, and logging creates three entries

### Requirement: Bulk logging from the review list
The bulk-log action SHALL be labeled with the count of loggable rows and disabled while any loggable row's amount is invalid or no loggable rows remain. Activating it SHALL save the rows as ordinary food entries one at a time to the dialog's date, each with its row's food, amount, unit, and meal, removing each row as it is saved. When every row is saved, the overlay and the Log Food dialog SHALL close. If a save fails, already-saved entries SHALL remain logged, the remaining rows SHALL stay in the list with a non-blocking error, and the bulk-log action SHALL retry only what remains.

#### Scenario: All rows logged
- **WHEN** the user activates "Add 3 entries" and all saves succeed
- **THEN** three entries exist on the dialog's date with each row's food, amount, unit, and meal, and the dialog closes

#### Scenario: Save fails partway
- **WHEN** the second of three saves fails
- **THEN** the first entry remains logged, the two remaining rows stay listed with an error message, and the bulk-log action offers to add the remaining two

#### Scenario: Invalid amount blocks logging
- **WHEN** a loggable row's amount is empty or not a positive number
- **THEN** the bulk-log action is disabled until the amount is corrected or the row is removed

### Requirement: Mid-batch identification failure keeps progress
When an identification request fails (network error, provider error, rate limit, or malformed response), the system SHALL keep the rows already identified, surface a non-blocking error message, and offer a retry action that resumes identification from the failed photo rather than restarting the batch. Cancelling instead SHALL return to the entry form with its prior state intact.

#### Scenario: Retry resumes from the failed photo
- **WHEN** the third of five photos fails with a rate-limit error
- **THEN** rows for the first two photos are kept, the error is shown, and retry re-sends photo 3 and then continues with photos 4 and 5

### Requirement: Batch state is ephemeral
The photos, chaining notes, identification results, and review rows SHALL be held only in client memory for the life of the overlay and MUST NOT be persisted to Supabase or any other store. Closing the overlay (by logging all rows, cancelling, or navigating away) SHALL discard them all.

#### Scenario: Cancel discards everything
- **WHEN** the user cancels the overlay after identification has produced rows
- **THEN** no entries are created, nothing about the batch is stored anywhere, and the entry form is as they left it

