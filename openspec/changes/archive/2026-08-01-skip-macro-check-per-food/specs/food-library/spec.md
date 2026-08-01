## MODIFIED Requirements

### Requirement: Personal food library
The system SHALL maintain a per-user library of saved foods. Each library food MUST record a name, per-serving calories, carbs (g), protein (g), and fat (g), and a serving anchor (count label, defaulting to "serving", plus optional single-dimension equivalence per the serving-units capability), and MAY record a description (brand, prep notes) and a recipe (free-text prep instructions). Each library food MUST also record a "skip macro/calorie mismatch check" flag, defaulting to off, which suppresses the macro/calorie mismatch warning when the food is logged (per the food-logging capability). Library foods MUST be deduplicated per user on the normalized (case-insensitive, trimmed) name.

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

## ADDED Requirements

### Requirement: Mismatch warning when saving a library food directly
When the user creates or edits a food on the Food Library screen and its entered calories do not roughly match what its macros add up to (the same check used at logging time, skipped when all three macros are zero), the system SHALL warn with a confirmation prompt and save only if the user chooses to proceed. If the food being edited already has its skip macro/calorie mismatch check flag set, the system SHALL save without warning. When the warning is shown and the user chooses to save anyway, the system SHALL set that flag on the saved food, so it never warns again — on this screen or when logged (per food-logging). A "save as new food" fork MUST be treated as a new food: it does not inherit the source food's flag and warns on its own mismatch. Choosing not to proceed MUST leave the food unsaved.

#### Scenario: Editing into a mismatch warns and blocks on cancel
- **WHEN** the user edits a food's calories so they no longer match its macros and cancels the warning
- **THEN** the food is not saved

#### Scenario: Save anyway opts the food out on this screen and when logged
- **WHEN** the user saves a mismatched food from the library screen and chooses to save anyway
- **THEN** the food is saved with its skip-mismatch flag set, and neither editing it again nor logging it shows the warning

#### Scenario: An opted-out food does not warn
- **WHEN** the user edits a food that already has its skip-mismatch flag set, leaving a mismatch in place
- **THEN** no warning is shown and the flag is preserved

#### Scenario: A fork does not inherit the opt-out
- **WHEN** the user forks an opted-out food via "save as new food" and the fork's values still mismatch
- **THEN** the warning is shown for the fork, independent of the source food's flag
