# food-library Specification

## Purpose
Maintain a self-populating, per-user library of saved foods so repeat logging is a one-tap action: foods are captured automatically as they are logged, suggested per meal, searchable from the entry form's name field, and manageable (create/edit/archive) on a dedicated screen.

## Requirements

### Requirement: Personal food library
The system SHALL maintain a per-user library of saved foods. Each library food MUST record a name and per-serving calories, carbs (g), protein (g), and fat (g), and MAY record a description (brand, prep notes, weights) and a serving description. Library foods MUST be deduplicated per user on the normalized (case-insensitive, trimmed) name.

#### Scenario: Duplicate name resolves to one food
- **WHEN** a food is captured or created with a name that normalizes to the same value as an existing library food (e.g. "pb&j " vs "PB&J")
- **THEN** no second library food is created; the existing food is used

### Requirement: Silent auto-capture on logging
When the user logs an entry whose name does not match any library food, the system SHALL silently save it to the library with the entry's nutrition values and its source (manual or search). When the name matches an existing library food, the system SHALL link the entry to that food and MUST NOT modify the library food's stored values, even if the user adjusted nutrition values in the form. Auto-capture failure MUST NOT prevent the entry itself from being saved.

#### Scenario: New food captured on first log
- **WHEN** the user logs "Chicken breast" for the first time, whether typed manually or selected from online search
- **THEN** a library food "Chicken breast" is created with the logged nutrition values, without any additional user action

#### Scenario: One-off tweak does not overwrite the library
- **WHEN** the user selects a library food, edits its calories in the form for this occasion only, and saves the entry
- **THEN** the entry stores the tweaked value but the library food's calories are unchanged

#### Scenario: Capture failure does not block logging
- **WHEN** saving the entry succeeds but saving the library food fails
- **THEN** the entry is persisted and no error blocks the user

### Requirement: Per-meal suggestions
When the name field is focused and empty, the system SHALL suggest up to 3 library foods most recently logged for the currently selected meal, followed by up to 3 library foods most frequently logged for that meal. The two groups MUST NOT repeat a food, frequency MUST be counted per meal (not across all meals), archived foods MUST be excluded, and the lists SHALL come up short rather than padding with foods from other meals.

#### Scenario: Focused empty field shows meal-specific suggestions
- **WHEN** the user opens the add-food form with meal "breakfast" and focuses the empty name field
- **THEN** up to 3 breakfast-recent foods and up to 3 breakfast-most-used foods are shown, with no food appearing twice

#### Scenario: Sparse history yields short lists
- **WHEN** only 2 distinct foods have ever been logged for the selected meal
- **THEN** only those foods are suggested; no foods from other meals fill the remaining slots

### Requirement: Library-first name search
As the user types in the name field, the system SHALL match against the library's food names and descriptions (case-insensitive) and show matching foods in a dropdown, each with its description as a secondary line. The dropdown MUST always offer two actions: searching the online food database for the typed text, and using the typed text as a new food via manual entry. Selecting a library food SHALL pre-fill the form with its nutrition values and serving description.

#### Scenario: Match on description
- **WHEN** the library contains "PB&J" with description "15g jelly, 16g pbfit, 2 sara lee slices" and the user types "pbfit"
- **THEN** "PB&J" appears in the dropdown

#### Scenario: Select a library food
- **WHEN** the user selects a library food from the dropdown
- **THEN** the form's name, calories, macros, and serving description are pre-filled from the library food

#### Scenario: Free text is never a dead end
- **WHEN** the user types a name matching nothing in the library
- **THEN** the dropdown still offers "search online" and "use as new food" actions, and submitting the form logs the food manually

### Requirement: Library management
The system SHALL provide a library management screen where the user can view saved foods, create a new food directly ("add food item"), edit a food's name, description, serving description, and nutrition values, and archive a food. Archived foods MUST be excluded from suggestions and name search but MUST NOT be deleted. Nutrition values MUST pass the same validation as food entries.

#### Scenario: Create a food without logging it
- **WHEN** the user creates a food from the library screen
- **THEN** it is saved to the library and appears in name search without ever having been logged

#### Scenario: Archive removes from suggestions only
- **WHEN** the user archives a library food that appears in past entries
- **THEN** it no longer appears in suggestions or search, and past entries referencing it are unchanged

### Requirement: Snapshot semantics
Food entries SHALL store their own copies of name and nutrition values at logging time. Editing a library food MUST NOT change any existing entry.

#### Scenario: Library edit leaves history intact
- **WHEN** the user edits a library food's calories after having logged it last week
- **THEN** last week's entry and daily totals are unchanged; only future logs pick up the new value
