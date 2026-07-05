## ADDED Requirements

### Requirement: Log a food entry
The system SHALL allow the user to add a food entry to a specific day and meal (breakfast, lunch, dinner, or snacks). Each entry MUST record a name, calories, carbs (g), protein (g), and fat (g), and MAY record a serving description and quantity.

#### Scenario: Add entry manually
- **WHEN** the user submits the add-entry form with a name, meal, and nutrition values for the selected day
- **THEN** the entry appears under that meal for that day and is persisted

#### Scenario: Add entry from search selection
- **WHEN** the user selects a food from search results and confirms the meal and quantity
- **THEN** an entry is created with the food's nutrition values scaled by quantity

#### Scenario: Reject invalid nutrition values
- **WHEN** the user submits an entry with a negative or non-numeric value for calories or any macro
- **THEN** the system rejects the submission and shows a validation message without saving

### Requirement: Edit a food entry
The system SHALL allow the user to edit any field of an existing entry, including moving it to a different meal.

#### Scenario: Update entry values
- **WHEN** the user edits an entry's calories and saves
- **THEN** the entry and the day's totals reflect the new value immediately

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
