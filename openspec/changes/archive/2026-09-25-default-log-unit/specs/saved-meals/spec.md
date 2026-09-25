## MODIFIED Requirements

### Requirement: Create a meal from selected foods
The system SHALL let the user create a saved meal by selecting two or more foods from the food library's Foods list and choosing to create a meal from the selection. The system SHALL open a meal builder seeded with the selected foods, each defaulting to that food's default portion (per the serving-units capability): 1 of the food's own serving count (1 serving, or 1 of the food's custom count label), or for a food that defaults to a weight or volume unit, what one count equals in that unit. In the builder the user SHALL be able to name the meal and adjust each component's amount and unit (from the units the component food's serving anchor offers) before saving. Saving MUST enforce the saved-meal name validation and per-user normalized-name deduplication.

#### Scenario: Build a meal from a multi-selection
- **WHEN** the user selects four foods in the library, each counted by default, and chooses "create meal from 4 foods"
- **THEN** a builder opens listing those four foods each at 1 serving, and the user can name the meal and change any component's portion before saving

#### Scenario: Weighed foods seed at their serving weight
- **WHEN** one of the selected foods is anchored at "1 banana = 118 g" with default logging unit g
- **THEN** the builder lists that food at 118 g

#### Scenario: Adjust a component portion in the builder
- **WHEN** the user, in the builder, changes a component from 1 serving to 100 g for a food whose anchor allows weight units
- **THEN** that component is saved with amount 100 and unit "g", and the meal total reflects the new portion

#### Scenario: Reject an unnamed meal
- **WHEN** the user tries to save a meal with a blank name
- **THEN** the save is rejected with a validation message and no meal is created
