# food-logging Specification

## Purpose
TBD - created by syncing change add-calorie-tracker. Update Purpose after review.

## Requirements

### Requirement: Log a food entry
The system SHALL allow the user to add a food entry to a specific day and meal (breakfast, lunch, dinner, or snacks). Each entry MUST record a name, per-serving calories, carbs (g), protein (g), and fat (g), a logged amount and unit, and a snapshot of the food's serving anchor (count label and optional equivalence), and MAY record a reference to the library food it came from. The name field SHALL be a combobox backed by the user's food library (per the food-library capability), and entries MUST store their own copies of nutrition values regardless of how the name was chosen. The servings multiplier MUST be derived from the logged amount and unit at save time per the serving-units capability.

#### Scenario: Add entry manually
- **WHEN** the user submits the add-entry form with a name, meal, and nutrition values for the selected day
- **THEN** the entry appears under that meal for that day and is persisted

#### Scenario: Add entry from library selection
- **WHEN** the user selects a food from the name combobox and confirms
- **THEN** an entry is created with the library food's nutrition values (as adjusted in the form) and a reference to that library food

#### Scenario: Add entry from search selection
- **WHEN** the user selects a food from search results and confirms the meal, amount, and unit
- **THEN** an entry is created with the food's nutrition values scaled by the derived servings multiplier

#### Scenario: Log by weight
- **WHEN** the user logs 45 g of a food anchored at "1 serving = 100 g" with 200 kcal per serving
- **THEN** the entry contributes 90 kcal to the day's totals

#### Scenario: Reject invalid nutrition values
- **WHEN** the user submits an entry with a negative or non-numeric value for calories, any macro, or the logged amount
- **THEN** the system rejects the submission and shows a validation message without saving

### Requirement: Edit a food entry
The system SHALL allow the user to edit any field of an existing entry, including moving it to a different meal. The unit options offered while editing MUST be resolved from the entry's own serving-anchor snapshot, not from the current state of any library food.

#### Scenario: Update entry values
- **WHEN** the user edits an entry's calories and saves
- **THEN** the entry and the day's totals reflect the new value immediately

#### Scenario: Edit survives a later library change
- **WHEN** the user edits an entry logged as 45 g after the linked library food's serving equivalence was later changed or removed
- **THEN** the edit form still offers the entry's original unit options and re-derives the multiplier from the entry's own snapshot

### Requirement: Delete a food entry
The system SHALL allow the user to delete an entry.

#### Scenario: Delete entry
- **WHEN** the user deletes an entry
- **THEN** it is removed from the meal list and the day's totals update immediately

### Requirement: Entries grouped by meal
The system SHALL display a day's entries grouped under breakfast, lunch, dinner, and snacks, with a per-meal calorie subtotal.

#### Scenario: View day log
- **WHEN** the user views a day that has entries in multiple meals
- **THEN** each entry is listed under its meal and each meal shows its calorie subtotal

### Requirement: Computed nutrition display
When the entry form's nutrition is already known (a library food was selected, a search result was prefilled, or an existing entry is being edited), the form SHALL hide the per-serving nutrition inputs behind an "Edit nutrition" action and instead show, updating live with the logged amount and unit: the computed nutrition this entry will contribute, and the per-serving reference (count label, equivalence, and per-serving calories). The inputs SHALL remain visible (not collapsed) when defining a new food, or when a search result is missing nutrients that require confirmation, and visible inputs MUST be labeled as being per one serving.

Revealing the inputs when the entry is linked to an existing library food (by current name match or a carried reference) MUST also reveal the serving label and weight/volume equivalence fields, matching the Food Library screen's edit form, and MUST show a note that saving will update the food library. Saving in this state SHALL update the linked library food's name-scoped anchor and nutrition values in addition to saving the current entry, so that future logs of that food reflect the change; a failure to update the library food MUST NOT be silent — it SHALL surface the same save-failure indication used for a failed entry save.

Revealing the inputs when the entry has no linked library food (never captured, or the link no longer resolves to a library food) SHALL show only the nutrition inputs, and editing values SHALL affect this entry only and MUST NOT create or modify any library food.

#### Scenario: Computed display tracks the logged amount
- **WHEN** the form is prefilled with a food anchored at "1 can (drained) = 240 g" with 210 kcal per serving and the user enters 45 g
- **THEN** the form shows approximately 39.4 kcal for this entry before saving, without the per-serving inputs being visible

#### Scenario: Edit nutrition updates the linked library food
- **WHEN** the user selects a library food, clicks "Edit nutrition", changes the serving equivalence and calories, and saves
- **THEN** the entry is saved with the entered values and the linked library food's anchor and calories are updated to match, so the next time this food is logged it reflects the change

#### Scenario: Edit nutrition without a linked food stays entry-only
- **WHEN** the user edits nutrition on an entry that was never captured to the library, or whose linked food has since been archived or deleted
- **THEN** only the nutrition inputs are shown, the entry stores the changed values, and no library food is created or modified

#### Scenario: Edit nutrition on a past entry does not touch other history
- **WHEN** the user edits nutrition on a logged entry that is linked to a library food also referenced by other, already-logged entries, and saves
- **THEN** the edited entry and the library food reflect the new values, and every other previously-logged entry keeps the values it was originally saved with

#### Scenario: Missing search nutrients stay visible
- **WHEN** the form is prefilled from a search result lacking one or more macros
- **THEN** the nutrition inputs are shown (flagged for confirmation), not collapsed

### Requirement: Macro/calorie mismatch warning

When the user saves a food entry whose entered calories do not roughly match what its carbs, protein, and fat add up to (per the Atwater estimate, with generous tolerance, and skipped entirely when all three macros are zero), the system SHALL warn the user with a confirmation prompt and save only if the user chooses to proceed. The warning MUST be suppressible per library food: if the entry is linked to a library food whose "skip macro/calorie mismatch check" flag (per the food-library capability) is set, the system SHALL save the entry without showing the warning. When the warning is shown and the user chooses to save anyway, the system SHALL set that flag on the linked library food, so future logs of the same food never show the warning again. Choosing not to proceed MUST leave the entry unsaved and the flag unchanged.

Setting the flag on "save anyway" applies only when the entry is linked to a library food (an existing match or a food captured as part of this save). Quick calories-only entries (source `quick`, per the quick-calorie-logging capability) never link a library food, so the warning is never suppressed for them and no flag is set.

#### Scenario: Mismatch warns and blocks on cancel
- **WHEN** the user saves an entry whose calories differ from the macro estimate beyond tolerance, the warning appears, and the user cancels
- **THEN** the entry is not saved and no library food flag is changed

#### Scenario: Save anyway suppresses the warning for that food thereafter
- **WHEN** the user saves a mismatched entry linked to (or capturing) a library food and chooses to save anyway
- **THEN** the entry is saved, that library food's skip-mismatch flag is set, and logging the same food again saves without showing the warning

#### Scenario: Flagged food never warns
- **WHEN** the user logs a food whose linked library food already has the skip-mismatch flag set, with mismatched calories
- **THEN** the entry saves silently with no warning

#### Scenario: Matching macros never warn
- **WHEN** the user saves an entry whose calories match the macro estimate within tolerance, or whose macros are all zero
- **THEN** no warning is shown and no flag is set, regardless of the linked food's flag

#### Scenario: Quick entries are never suppressed
- **WHEN** the user saves a mismatched quick calories-only entry and chooses to save anyway
- **THEN** the entry is saved and no library food is created, linked, or flagged
