## MODIFIED Requirements

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

## ADDED Requirements

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
