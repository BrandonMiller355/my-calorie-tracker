# food-search Specification (delta)

## MODIFIED Requirements

### Requirement: Select a search result
The system SHALL let the user select a result and hand its name and nutrition data to the food-logging flow, pre-filled and editable before saving. When the search screen was opened from within the add-entry form, selecting a result (or navigating back) SHALL return the user to that form with its in-progress context — notably the selected meal — restored.

#### Scenario: Select result to log
- **WHEN** the user selects a search result
- **THEN** the add-entry form opens pre-filled with the result's name and nutrition values for the user to adjust meal and quantity

#### Scenario: Return to an in-progress form
- **WHEN** the user opened search from the add-entry form's "search online" action with meal "lunch" selected, then selects a result
- **THEN** the add-entry form reopens pre-filled with the result and the meal still set to "lunch"

#### Scenario: Standalone search unchanged
- **WHEN** the user opens the search screen directly (not from the add-entry form) and selects a result
- **THEN** the add-entry form opens pre-filled with the result using the default meal behavior
