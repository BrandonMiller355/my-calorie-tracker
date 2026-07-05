# food-logging Specification (delta)

## MODIFIED Requirements

### Requirement: Log a food entry
The system SHALL allow the user to add a food entry to a specific day and meal (breakfast, lunch, dinner, or snacks). Each entry MUST record a name, calories, carbs (g), protein (g), and fat (g), and MAY record a serving description, quantity, and a reference to the library food it came from. The name field SHALL be a combobox backed by the user's food library: it suggests per-meal foods when empty, matches library foods as the user types, and offers online search and manual entry as fallback actions. Entries MUST store their own copies of nutrition values regardless of how the name was chosen.

#### Scenario: Add entry manually
- **WHEN** the user submits the add-entry form with a name, meal, and nutrition values for the selected day
- **THEN** the entry appears under that meal for that day and is persisted

#### Scenario: Add entry from library selection
- **WHEN** the user selects a food from the name combobox and confirms
- **THEN** an entry is created with the library food's nutrition values (as adjusted in the form) and a reference to that library food

#### Scenario: Add entry from search selection
- **WHEN** the user selects a food from online search results and confirms the meal and quantity
- **THEN** an entry is created with the food's nutrition values scaled by quantity

#### Scenario: Reject invalid nutrition values
- **WHEN** the user submits an entry with a negative or non-numeric value for calories or any macro
- **THEN** the system rejects the submission and shows a validation message without saving
