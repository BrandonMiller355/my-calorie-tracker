## MODIFIED Requirements

### Requirement: Library-first name search
As the user types in the name field, the system SHALL match against the library's food names and descriptions (case-insensitive) and show matching foods in a dropdown, each with its description as a secondary line. Matches SHALL be ordered by match quality first (name matches above description-only matches), then by how recently each food was last logged (most recent first, across all meals), with never-logged foods last in alphabetical order. As the user types, the system SHALL additionally match against saved meal names (case-insensitive, per the saved-meals capability), showing matching non-archived saved meals in the dropdown distinguished by a "meal" badge; saved meals do NOT appear in the focused-empty-field suggestions and are surfaced only by name match. The dropdown MUST always offer fixed actions after any matches: searching the online food database for the typed text and using the typed text as a new food via manual entry (both only while text is typed), and logging calories only (per the quick-calorie-logging capability) as the last item in both the empty-field and typing states. Selecting a library food SHALL pre-fill the form with its nutrition values and serving anchor, and populate the unit picker from that anchor. Selecting a saved meal SHALL NOT pre-fill the entry form; instead it SHALL open the meal-log confirm sheet (per the saved-meals capability) for that meal.

#### Scenario: Match on description
- **WHEN** the library contains "PB&J" with description "15g jelly, 16g pbfit, 2 sara lee slices" and the user types "pbfit"
- **THEN** "PB&J" appears in the dropdown

#### Scenario: Recently used matches come first
- **WHEN** the library contains "Apple crumble" (last logged weeks ago) and "Apple pie" (logged yesterday) and the user types "apple"
- **THEN** "Apple pie" appears above "Apple crumble" in the dropdown

#### Scenario: Select a library food
- **WHEN** the user selects a library food anchored at "1 can (drained) = 120 g" from the dropdown
- **THEN** the form's name, calories, and macros are pre-filled and the unit picker offers "can (drained)" plus weight units

#### Scenario: Free text is never a dead end
- **WHEN** the user types a name matching nothing in the library
- **THEN** the dropdown still offers "search online" and "use as new food" actions, and submitting the form logs the food manually

#### Scenario: Quick action is last in every state
- **WHEN** the name field is focused with no text, or has typed text with matches or none
- **THEN** the "log calories only" action is offered as the final dropdown item

#### Scenario: Saved meal matches by name with a badge
- **WHEN** the user has a saved meal "Taco salad" and types "taco" in the name field
- **THEN** "Taco salad" appears in the dropdown marked as a meal, distinct from library foods

#### Scenario: Selecting a meal opens the confirm sheet
- **WHEN** the user selects the "Taco salad" meal from the dropdown
- **THEN** the entry form is not pre-filled and the meal-log confirm sheet opens for that meal

### Requirement: Library management
The system SHALL provide a library management screen where the user can view saved foods, create a new food directly ("add food item"), edit a food's name, description, recipe, serving anchor (count label and equivalence), and nutrition values, and archive a food. Archived foods MUST be excluded from suggestions and name search but MUST NOT be deleted. Nutrition values MUST pass the same validation as food entries, and the serving anchor MUST pass serving-units validation. Each food's recipe, when present, MUST be viewable from this screen behind a collapsed "View recipe" disclosure rather than shown inline.

The screen SHALL separate saved foods and saved meals into distinct Foods and Meals views. In the Foods view the system SHALL provide a multi-select mode in which the user can select two or more foods and create a saved meal from the selection (per the saved-meals capability). The Meals view SHALL present saved meals for viewing, editing, and archiving as defined by the saved-meals capability.

When editing an existing food, the system SHALL additionally offer a secondary "save as new food" action that saves the form's current values as a new library food and leaves the edited food unchanged. This action MUST be offered only while the name in the form differs from the edited food's name under the same normalization the library deduplicates on, and MUST NOT replace or pre-empt the primary "save changes" action, which continues to save in place including under a changed name. Both actions MUST enforce the library's normalized-name deduplication: "save changes" against every other food, and "save as new food" against every food including the one being edited.

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
