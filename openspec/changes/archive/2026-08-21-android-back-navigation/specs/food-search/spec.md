## MODIFIED Requirements

### Requirement: Select a search result
The system SHALL let the user select a result and hand its name, nutrition data, and serving anchor to the food-logging flow, pre-filled and editable before saving. When the search screen was opened from within the add-entry form, selecting a result — or taking one of the search screen's own return paths, such as its manual-entry fallback — SHALL return the user to that form with its in-progress context — notably the selected meal — restored. The platform back signal is not one of those paths: per the app-navigation capability it returns to the Log tab without reopening the form.

#### Scenario: Select result to log
- **WHEN** the user selects a search result
- **THEN** the add-entry form opens pre-filled with the result's name, nutrition values, and serving anchor for the user to adjust meal, amount, and unit

#### Scenario: Return to an in-progress form
- **WHEN** the user opened search from the add-entry form's "search online" action with meal "lunch" selected, then selects a result
- **THEN** the add-entry form reopens pre-filled with the result and the meal still set to "lunch"

#### Scenario: Manual-entry fallback restores the form
- **WHEN** the user opened search from the add-entry form and takes the search screen's manual-entry fallback
- **THEN** the add-entry form reopens with its in-progress context, including the selected meal

#### Scenario: Back leaves search without reopening the form
- **WHEN** the user opened search from the add-entry form and presses back with no layer open
- **THEN** the Log tab is shown and the entry form is not reopened

#### Scenario: Standalone search unchanged
- **WHEN** the user opens the search screen directly (not from the add-entry form) and selects a result
- **THEN** the add-entry form opens pre-filled with the result using the default meal behavior
