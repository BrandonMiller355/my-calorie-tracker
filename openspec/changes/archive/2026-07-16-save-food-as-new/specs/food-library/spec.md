## MODIFIED Requirements

### Requirement: Library management
The system SHALL provide a library management screen where the user can view saved foods, create a new food directly ("add food item"), edit a food's name, description, recipe, serving anchor (count label and equivalence), and nutrition values, and archive a food. Archived foods MUST be excluded from suggestions and name search but MUST NOT be deleted. Nutrition values MUST pass the same validation as food entries, and the serving anchor MUST pass serving-units validation. Each food's recipe, when present, MUST be viewable from this screen behind a collapsed "View recipe" disclosure rather than shown inline.

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
