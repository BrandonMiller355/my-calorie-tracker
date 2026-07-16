# food-library Specification

## Purpose
Maintain a self-populating, per-user library of saved foods so repeat logging is a one-tap action: foods are captured automatically as they are logged, suggested per meal, searchable from the entry form's name field, and manageable (create/edit/archive) on a dedicated screen.

## Requirements

### Requirement: Personal food library
The system SHALL maintain a per-user library of saved foods. Each library food MUST record a name, per-serving calories, carbs (g), protein (g), and fat (g), and a serving anchor (count label, defaulting to "serving", plus optional single-dimension equivalence per the serving-units capability), and MAY record a description (brand, prep notes) and a recipe (free-text prep instructions). Library foods MUST be deduplicated per user on the normalized (case-insensitive, trimmed) name.

#### Scenario: Duplicate name resolves to one food
- **WHEN** a food is captured or created with a name that normalizes to the same value as an existing library food (e.g. "pb&j " vs "PB&J")
- **THEN** no second library food is created; the existing food is used

#### Scenario: Custom count label with equivalence
- **WHEN** the user defines a food with label "can (drained)" equal to 120 g
- **THEN** logging that food offers "can (drained)" and all weight units

#### Scenario: Recipe is optional free text
- **WHEN** a library food is created or edited without a recipe
- **THEN** the food is saved with no recipe, and nothing else about creating or logging it is affected

### Requirement: Silent auto-capture on logging
When the user logs an entry whose name does not match any library food, the system SHALL silently save it to the library with the entry's nutrition values, the serving anchor as defined in the form, and its source (manual or search). When the name matches an existing library food, the system SHALL link the entry to that food. Quick calories-only entries (source `quick`, per the quick-calorie-logging capability) are exempt: logging one MUST NOT create, match, modify, or link any library food. Adjusting nutrition or serving-anchor values in the form for a matched food MUST NOT modify the library food unless the user explicitly did so through the entry form's "Edit nutrition" library-update flow (per the food-logging capability); a matched food's stored values and serving anchor are otherwise left as they were. Auto-capture failure MUST NOT prevent the entry itself from being saved.

#### Scenario: New food captured on first log
- **WHEN** the user logs "Chicken breast" for the first time with an anchor of "1 serving = 100 g", whether typed manually or selected from online search
- **THEN** a library food "Chicken breast" is created with the logged nutrition values and that anchor, without any additional user action

#### Scenario: Logging a different amount does not overwrite the library
- **WHEN** the user selects a library food and only changes the logged amount and unit (without opening "Edit nutrition"), then saves the entry
- **THEN** the entry reflects the new amount but the library food's nutrition values and serving anchor are unchanged

#### Scenario: Capture failure does not block logging
- **WHEN** saving the entry succeeds but saving the library food fails
- **THEN** the entry is persisted and no error blocks the user

#### Scenario: Quick entries are never captured
- **WHEN** the user logs a quick calories-only entry
- **THEN** no library food is created, matched, modified, or linked

### Requirement: Per-meal suggestions
When the name field is focused and empty, the system SHALL suggest up to 3 library foods most recently logged for the currently selected meal, followed by up to 3 library foods most frequently logged for that meal. The two groups MUST NOT repeat a food, frequency MUST be counted per meal (not across all meals), archived foods MUST be excluded, and the lists SHALL come up short rather than padding with foods from other meals.

#### Scenario: Focused empty field shows meal-specific suggestions
- **WHEN** the user opens the add-food form with meal "breakfast" and focuses the empty name field
- **THEN** up to 3 breakfast-recent foods and up to 3 breakfast-most-used foods are shown, with no food appearing twice

#### Scenario: Sparse history yields short lists
- **WHEN** only 2 distinct foods have ever been logged for the selected meal
- **THEN** only those foods are suggested; no foods from other meals fill the remaining slots

### Requirement: Library-first name search
As the user types in the name field, the system SHALL match against the library's food names and descriptions (case-insensitive) and show matching foods in a dropdown, each with its description as a secondary line. The dropdown MUST always offer fixed actions after any matches: searching the online food database for the typed text and using the typed text as a new food via manual entry (both only while text is typed), and logging calories only (per the quick-calorie-logging capability) as the last item in both the empty-field and typing states. Selecting a library food SHALL pre-fill the form with its nutrition values and serving anchor, and populate the unit picker from that anchor.

#### Scenario: Match on description
- **WHEN** the library contains "PB&J" with description "15g jelly, 16g pbfit, 2 sara lee slices" and the user types "pbfit"
- **THEN** "PB&J" appears in the dropdown

#### Scenario: Select a library food
- **WHEN** the user selects a library food anchored at "1 can (drained) = 120 g" from the dropdown
- **THEN** the form's name, calories, and macros are pre-filled and the unit picker offers "can (drained)" plus weight units

#### Scenario: Free text is never a dead end
- **WHEN** the user types a name matching nothing in the library
- **THEN** the dropdown still offers "search online" and "use as new food" actions, and submitting the form logs the food manually

#### Scenario: Quick action is last in every state
- **WHEN** the name field is focused with no text, or has typed text with matches or none
- **THEN** the "log calories only" action is offered as the final dropdown item

### Requirement: Library management
The system SHALL provide a library management screen where the user can view saved foods, create a new food directly ("add food item"), edit a food's name, description, recipe, serving anchor (count label and equivalence), and nutrition values, and archive a food. Archived foods MUST be excluded from suggestions and name search but MUST NOT be deleted. Nutrition values MUST pass the same validation as food entries, and the serving anchor MUST pass serving-units validation. Each food's recipe, when present, MUST be viewable from this screen behind a collapsed "View recipe" disclosure rather than shown inline.

#### Scenario: Create a food without logging it
- **WHEN** the user creates a food from the library screen
- **THEN** it is saved to the library and appears in name search without ever having been logged

#### Scenario: Edit serving anchor
- **WHEN** the user changes a food's label to "slice" with equivalence 28 g on the library screen
- **THEN** future logging of that food offers "slice" and weight units, and past entries are unchanged

#### Scenario: Archive removes from suggestions only
- **WHEN** the user archives a library food that appears in past entries
- **THEN** it no longer appears in suggestions or search, and past entries referencing it are unchanged

#### Scenario: Add a recipe from the library screen
- **WHEN** the user opens an existing library food's edit form and enters prep instructions into the recipe field, then saves
- **THEN** the food's recipe is stored and reappears the next time the food is viewed or edited

#### Scenario: View a collapsed recipe
- **WHEN** the user opens the library list for a food that has a recipe
- **THEN** the recipe text is hidden behind a "View recipe" control until the user expands it

### Requirement: Snapshot semantics
Food entries SHALL store their own copies of name, nutrition values, serving anchor, and logged amount and unit at logging time. Editing a library food MUST NOT change any existing entry.

#### Scenario: Library edit leaves history intact
- **WHEN** the user edits a library food's calories or serving anchor after having logged it last week
- **THEN** last week's entry and daily totals are unchanged; only future logs pick up the new values

### Requirement: Recipe available while logging
When the user is defining a brand-new food in the entry form (not editing an existing entry, not matched to an existing library food), the system SHALL offer a control next to the description field to add a recipe, which is saved to the new library food on capture. When the entry form's name field is matched to an existing library food that has a recipe, the system SHALL show a collapsed "View recipe" control next to that food's description so the user can reread prep instructions before logging.

#### Scenario: Add a recipe while defining a new food
- **WHEN** the user is logging a food for the first time (e.g. "Cheesy mash"), opens the recipe control, and enters prep instructions before saving the entry
- **THEN** the newly captured library food is saved with that recipe

#### Scenario: Reread a recipe while logging a known food
- **WHEN** the user selects an existing library food that has a saved recipe while logging an entry
- **THEN** a collapsed "View recipe" control appears next to the food's description, and expanding it shows the saved prep instructions

#### Scenario: No control when there is nothing to show or set
- **WHEN** the user is editing an existing entry, or has matched a library food with no recipe and is not defining a new food
- **THEN** no recipe control is shown for that food in the entry form beyond what "Personal food library" and "Library management" already provide
