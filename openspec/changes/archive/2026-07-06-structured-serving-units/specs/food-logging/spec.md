# food-logging Delta Spec

## ADDED Requirements

### Requirement: Computed nutrition display
When the entry form's nutrition is already known (a library food was selected, a search result was prefilled, or an existing entry is being edited), the form SHALL hide the per-serving nutrition inputs behind an "Edit nutrition" action and instead show, updating live with the logged amount and unit: the computed nutrition this entry will contribute, and the per-serving reference (count label, equivalence, and per-serving calories). Revealing the inputs and editing values SHALL affect this entry only and MUST NOT modify the library food. The inputs SHALL remain visible (not collapsed) when defining a new food, or when a search result is missing nutrients that require confirmation, and visible inputs MUST be labeled as being per one serving.

#### Scenario: Computed display tracks the logged amount
- **WHEN** the form is prefilled with a food anchored at "1 can (drained) = 240 g" with 210 kcal per serving and the user enters 45 g
- **THEN** the form shows approximately 39.4 kcal for this entry before saving, without the per-serving inputs being visible

#### Scenario: Edit nutrition is entry-only
- **WHEN** the user clicks "Edit nutrition" on a library-linked entry, changes calories, and saves
- **THEN** the entry stores the changed value and the library food is unchanged

#### Scenario: Missing search nutrients stay visible
- **WHEN** the form is prefilled from a search result lacking one or more macros
- **THEN** the nutrition inputs are shown (flagged for confirmation), not collapsed

## MODIFIED Requirements

### Requirement: Log a food entry
The system SHALL allow the user to add a food entry to a specific day and meal (breakfast, lunch, dinner, or snacks). Each entry MUST record a name, per-serving calories, carbs (g), protein (g), and fat (g), a logged amount and unit, and a snapshot of the food's serving anchor (count label and optional equivalence). The servings multiplier MUST be derived from the logged amount and unit at save time per the serving-units capability.

#### Scenario: Add entry manually
- **WHEN** the user submits the add-entry form with a name, meal, and nutrition values for the selected day
- **THEN** the entry appears under that meal for that day and is persisted

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
