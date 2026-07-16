# quick-calorie-logging Specification

## Purpose
Let the user log a calorie estimate (optionally with macro estimates and a free-text description) without naming a food, so one-off guesses — restaurant meals, bites, unknowable dishes — never pollute the food library.

## Requirements

### Requirement: Log a calories-only entry
The system SHALL let the user log a quick entry consisting of a required calorie value, optional carbs, protein, and fat values, and an optional free-text description, without naming a food or providing an amount, unit, or serving anchor. The entry point SHALL be a fixed "log calories only" action shown at the bottom of the name field's dropdown, available both when the field is empty and while typing. Selecting it SHALL switch the entry form to a quick mode showing only the meal selector, calories and macro inputs, and a description input. The nutrition values MUST pass the same validation as a normal entry's.

A saved quick entry SHALL be stored as a regular food entry with name "Calories", source `quick`, the entered calories and macros (blank macro inputs defaulting to 0), a logged amount of 1 of the default serving label with no equivalence, and the description stored on the entry itself.

#### Scenario: Quick action available at the bottom of the dropdown
- **WHEN** the user focuses the name field (empty or with typed text)
- **THEN** a "log calories only" action appears as the last item of the dropdown, below any library matches and the other fixed actions

#### Scenario: Log a quick estimate
- **WHEN** the user selects the quick action, enters 450 calories, 30 g protein, and description "wedding buffet", and saves to dinner
- **THEN** an entry named "Calories" appears under dinner contributing 450 kcal and 30 g protein to the day's totals, and it persists like any other entry

#### Scenario: Macros and description are optional
- **WHEN** the user saves a quick entry with only a calorie value
- **THEN** the entry saves successfully with 0 carbs, protein, and fat and no description

#### Scenario: Invalid nutrition values rejected
- **WHEN** the user submits the quick form with an empty calorie value, or a negative or non-numeric value for calories or any macro
- **THEN** the submission is rejected with a validation message and nothing is saved

### Requirement: Quick entries bypass the food library
Saving a quick entry MUST NOT create, modify, match, or link any library food, regardless of whether a library food named "Calories" exists.

#### Scenario: No auto-capture on quick save
- **WHEN** the user saves a quick calories entry
- **THEN** the food library contains exactly the same foods as before the save, and the entry has no library-food reference

#### Scenario: Existing "Calories" library food is ignored
- **WHEN** a library food named "Calories" exists and the user saves a quick entry
- **THEN** the entry is not linked to that food and the food is not modified

### Requirement: Quick entry display
In the day log, a quick entry SHALL show "Calories" as its name, and its secondary line SHALL show the description (when present) where a normal entry shows its logged quantity, followed by the usual macro breakdown. The calorie display and per-meal subtotal treatment are unchanged from normal entries.

#### Scenario: Description shown in the meal list
- **WHEN** a quick entry with description "wedding buffet", 450 kcal, and 30 g protein is listed under a meal
- **THEN** the row shows "Calories" with a secondary line leading with "wedding buffet" followed by the macro breakdown, and its calorie value

### Requirement: Edit a quick entry
Editing an entry with source `quick` SHALL reopen the quick form (meal, calories, macros, description) rather than the full food form, and saving SHALL update the entry without touching the food library. Quick entries SHALL be deletable like any other entry.

#### Scenario: Edit updates nutrition and description
- **WHEN** the user opens a quick entry, changes calories from 450 to 500, sets fat to 20, and edits the description text, then saves
- **THEN** the entry and day totals reflect the new values and no library food is created or modified
