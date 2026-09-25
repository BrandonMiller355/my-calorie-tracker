## MODIFIED Requirements

### Requirement: Personal food library
The system SHALL maintain a per-user library of saved foods. Each library food MUST record a name, per-serving calories, carbs (g), protein (g), and fat (g), and a serving anchor (count label, defaulting to "serving", plus optional single-dimension equivalence per the serving-units capability), and MAY record a description (brand, prep notes) and a recipe (free-text prep instructions). Each library food MUST also record a default logging unit (per the serving-units capability) — its count label unless a weight or volume unit its equivalence offers is chosen — and a "skip macro/calorie mismatch check" flag, defaulting to off, which suppresses the macro/calorie mismatch warning when the food is logged (per the food-logging capability). Library foods MUST be deduplicated per user on the normalized (case-insensitive, trimmed) name.

#### Scenario: Duplicate name resolves to one food
- **WHEN** a food is captured or created with a name that normalizes to the same value as an existing library food (e.g. "pb&j " vs "PB&J")
- **THEN** no second library food is created; the existing food is used

#### Scenario: Custom count label with equivalence
- **WHEN** the user defines a food with label "can (drained)" equal to 120 g
- **THEN** logging that food offers "can (drained)" and all weight units

#### Scenario: Recipe is optional free text
- **WHEN** a library food is created or edited without a recipe
- **THEN** the food is saved with no recipe, and nothing else about creating or logging it is affected

#### Scenario: New foods default to not skipping the mismatch check
- **WHEN** a library food is captured or created
- **THEN** its skip macro/calorie mismatch check flag is off, so the mismatch warning applies until the user chooses to save a mismatched entry anyway

#### Scenario: Created foods count by default
- **WHEN** a library food is created on the library screen without choosing a default logging unit
- **THEN** its default logging unit is its count label, so logging it starts at 1 of that label

### Requirement: Silent auto-capture on logging
When the user logs an entry whose name does not match any library food, the system SHALL silently save it to the library with the entry's nutrition values, the serving anchor as defined in the form, a default logging unit of the unit the entry was logged in when that is a weight or volume unit (otherwise its count label), its source (manual or search), and the photo held in the form for that new food, if any (per the food-library-photos capability). When the name matches an existing library food, the system SHALL link the entry to that food. Quick calories-only entries (source `quick`, per the quick-calorie-logging capability) are exempt: logging one MUST NOT create, match, modify, or link any library food. Adjusting nutrition, serving-anchor values, or the logged unit in the form for a matched food MUST NOT modify the library food unless the user explicitly did so through the entry form's "Edit nutrition" library-update flow (per the food-logging capability); a matched food's stored values, serving anchor, and default logging unit are otherwise left as they were. Auto-capture failure MUST NOT prevent the entry itself from being saved.

#### Scenario: New food captured on first log
- **WHEN** the user logs "Chicken breast" for the first time with an anchor of "1 serving = 100 g", whether typed manually or selected from online search
- **THEN** a library food "Chicken breast" is created with the logged nutrition values and that anchor, without any additional user action

#### Scenario: A food first logged by weight is weighed from then on
- **WHEN** the user logs "Banana" for the first time as 130 g, with an anchor of "1 banana = 118 g"
- **THEN** the captured library food's default logging unit is g, so the next time Banana is picked the form starts at 118 g

#### Scenario: A food first logged by count keeps counting
- **WHEN** the user logs "Bread" for the first time as 2 slice, with an anchor of "1 slice = 28 g"
- **THEN** the captured library food's default logging unit is its count label, slice

#### Scenario: New food captured with its photo
- **WHEN** the user logs a food the library does not know and has attached a photo to it in the form
- **THEN** the captured library food is created with the logged values and that photo becomes its image, per the food-library-photos capability

#### Scenario: Logging a different amount does not overwrite the library
- **WHEN** the user selects a library food and only changes the logged amount and unit (without opening "Edit nutrition"), then saves the entry
- **THEN** the entry reflects the new amount but the library food's nutrition values, serving anchor, and default logging unit are unchanged

#### Scenario: Capture failure does not block logging
- **WHEN** saving the entry succeeds but saving the library food fails
- **THEN** the entry is persisted and no error blocks the user

#### Scenario: Quick entries are never captured
- **WHEN** the user logs a quick calories-only entry
- **THEN** no library food is created, matched, modified, or linked

### Requirement: Library management
The system SHALL provide a library management screen where the user can view saved foods, create a new food directly ("add food item"), edit a food's name, description, recipe, serving anchor (count label and equivalence), default logging unit, and nutrition values, and archive a food. Archived foods MUST be excluded from suggestions and name search but MUST NOT be deleted. Nutrition values MUST pass the same validation as food entries, and the serving anchor MUST pass serving-units validation. The default logging unit SHALL be chosen from the food's count label and the measure units of its equivalence's dimension as currently entered in the form; while the form defines no valid equivalence, the count label SHALL be the only choice, and a chosen unit the entered equivalence does not offer SHALL be shown and saved as the count label. Each food's recipe, when present, MUST be viewable from this screen behind a collapsed "View recipe" disclosure rather than shown inline.

The screen SHALL separate saved foods and saved meals into distinct Foods and Meals views. In the Foods view the system SHALL provide a multi-select mode in which the user can select two or more foods and create a saved meal from the selection (per the saved-meals capability). The Meals view SHALL present saved meals for viewing, editing, and archiving as defined by the saved-meals capability.

When editing an existing food, the system SHALL additionally offer a secondary "save as new food" action that saves the form's current values as a new library food and leaves the edited food unchanged. This action MUST be offered only while the name in the form differs from the edited food's name under the same normalization the library deduplicates on, and MUST NOT replace or pre-empt the primary "save changes" action, which continues to save in place including under a changed name. Both actions MUST enforce the library's normalized-name deduplication: "save changes" against every other food, and "save as new food" against every food including the one being edited.

#### Scenario: Create a food without logging it
- **WHEN** the user creates a food from the library screen
- **THEN** it is saved to the library and appears in name search without ever having been logged

#### Scenario: Edit serving anchor
- **WHEN** the user changes a food's label to "slice" with equivalence 28 g on the library screen
- **THEN** future logging of that food offers "slice" and weight units, and past entries are unchanged

#### Scenario: Choose to weigh a food every time
- **WHEN** the user edits "Banana", anchored at "1 banana = 118 g", on the library screen and sets its default logging unit to g
- **THEN** future logs of Banana start at 118 g, and past entries are unchanged

#### Scenario: Default logging unit choices follow the equivalence
- **WHEN** the user edits a food with no equivalence, then enters an equivalence of 120 g
- **THEN** the count label is the only default logging unit offered until the equivalence is entered, after which the count label and every weight unit are offered

#### Scenario: Archive removes from suggestions only
- **WHEN** the user archives a library food that appears in past entries
- **THEN** it no longer appears in suggestions or search, and past entries referencing it are unchanged

#### Scenario: Add a recipe from the library screen
- **WHEN** the user opens an existing library food's edit form and enters prep instructions into the recipe field, then saves
- **THEN** the food's recipe is stored and reappears the next time the food is viewed or edited

#### Scenario: View a collapsed recipe
- **WHEN** the user opens the library list for a food that has a recipe
- **THEN** the recipe text is hidden behind a "View recipe" control until the user expands it

#### Scenario: Fork a saved food into a new one
- **WHEN** the user opens "PB&J" for editing, changes the name to "PB&J (crunchy)", adjusts its calories, and chooses "save as new food"
- **THEN** a new library food "PB&J (crunchy)" is saved with the form's values, and "PB&J" keeps its original name and calories

#### Scenario: Save as new is offered only once the name diverges
- **WHEN** the user opens a food for editing and has not changed its name, or has only changed its capitalization or surrounding whitespace
- **THEN** no "save as new food" action is offered, and "save changes" remains the only save

#### Scenario: A changed name still saves in place
- **WHEN** the user opens "Chicken" for editing, corrects the name to "Chicken breast", and chooses "save changes"
- **THEN** the existing food is renamed in place and no second food is created

#### Scenario: Fork rejects a name already in the library
- **WHEN** the user edits "PB&J", changes the name to one that normalizes to an existing food's name, and chooses "save as new food"
- **THEN** the save is rejected with the same duplicate-name error as any other colliding save, and no food is created or modified

#### Scenario: Restoring the original name withdraws the fork
- **WHEN** the user changes the name away from the edited food's name, the "save as new food" action appears, and the user restores the original name before submitting it
- **THEN** the action is withdrawn, leaving "save changes" as the only save, so a fork can never be submitted under the edited food's own name

#### Scenario: Create a meal from selected foods
- **WHEN** the user enters multi-select mode in the Foods view, selects several foods, and chooses to create a meal from the selection
- **THEN** the meal builder opens seeded with those foods (per the saved-meals capability)

#### Scenario: Meals live in their own view
- **WHEN** the user switches to the Meals view
- **THEN** saved meals are listed there and are not interleaved with saved foods in the Foods view
