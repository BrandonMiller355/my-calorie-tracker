## Purpose

Let users save a reusable named grouping of library foods with a portion for each — a "meal" such as a taco salad — and log the whole thing in one gesture, so a multi-component food no longer has to be logged one item at a time on every day it is eaten.

## ADDED Requirements

### Requirement: Saved meal definition
The system SHALL maintain a per-user collection of saved meals. Each saved meal MUST record a name and an ordered list of components, where each component references a library food and records a logged amount and unit for that food. A saved meal MUST NOT store its own nutrition values; a meal's nutrition is computed on demand by summing each component's referenced library food nutrition, scaled by the servings multiplier derived from the component's amount and unit per the serving-units capability. Saved meals MUST be deduplicated per user on the normalized (case-insensitive, trimmed) name, and a saved meal MAY share a name with a library food. A saved meal MUST have at least one component.

#### Scenario: Meal total tracks its component foods
- **WHEN** a saved meal references a library food whose per-serving calories are later edited on the library screen
- **THEN** the meal's displayed total reflects the edited value the next time the meal is viewed or logged, without the meal being edited

#### Scenario: Component portion drives the contribution
- **WHEN** a meal component logs 100 g of a food anchored at "1 serving = 100 g" with 200 kcal per serving
- **THEN** that component contributes 200 kcal to the meal's total and to the entry it produces when logged

#### Scenario: Duplicate meal name resolves to one meal
- **WHEN** the user saves a meal whose name normalizes to the same value as an existing saved meal
- **THEN** the save is rejected with a duplicate-name error and no second meal is created

### Requirement: Create a meal from selected foods
The system SHALL let the user create a saved meal by selecting two or more foods from the food library's Foods list and choosing to create a meal from the selection. The system SHALL open a meal builder seeded with the selected foods, each defaulting to a logged amount of 1 of the food's own serving count (1 serving, or 1 of the food's custom count label). In the builder the user SHALL be able to name the meal and adjust each component's amount and unit (from the units the component food's serving anchor offers) before saving. Saving MUST enforce the saved-meal name validation and per-user normalized-name deduplication.

#### Scenario: Build a meal from a multi-selection
- **WHEN** the user selects four foods in the library and chooses "create meal from 4 foods"
- **THEN** a builder opens listing those four foods each at 1 serving, and the user can name the meal and change any component's portion before saving

#### Scenario: Adjust a component portion in the builder
- **WHEN** the user, in the builder, changes a component from 1 serving to 100 g for a food whose anchor allows weight units
- **THEN** that component is saved with amount 100 and unit "g", and the meal total reflects the new portion

#### Scenario: Reject an unnamed meal
- **WHEN** the user tries to save a meal with a blank name
- **THEN** the save is rejected with a validation message and no meal is created

### Requirement: Manage saved meals
The system SHALL present saved meals in a dedicated Meals view within the food library screen, listing each meal with its live computed total and a control to expand its component breakdown (each component's food name and portion). The system SHALL let the user edit a saved meal's name and components (add, remove, or re-portion components) and archive a saved meal. Archived meals MUST be excluded from the entry form's name search and MUST NOT be deleted.

#### Scenario: View meals with breakdown
- **WHEN** the user opens the Meals view and expands a saved meal
- **THEN** the meal's live total and each component food with its portion are shown

#### Scenario: Edit a meal's components
- **WHEN** the user removes a component from a saved meal and saves
- **THEN** the meal is stored without that component and its total is recomputed accordingly

#### Scenario: Archive a meal
- **WHEN** the user archives a saved meal
- **THEN** it no longer appears in the entry form's name search, and is not deleted

### Requirement: Log a meal as fanned-out entries
The system SHALL let the user log a saved meal into a chosen meal slot (breakfast, lunch, dinner, or snacks) for the current day. Selecting a meal to log SHALL first present a confirm sheet listing the meal's components with their portions, the meal's live computed total, and the target slot. On confirmation, the system SHALL create one ordinary food entry per available component, each with the component food's current nutrition and serving-anchor snapshot scaled by the component's amount and unit, linked to that component library food, and assigned to the chosen slot and day — identical in shape to entries created by logging each food individually. The saved meal itself SHALL NOT be recorded on the resulting entries, and logging a meal MUST NOT alter the meal's own recency or frequency for suggestions.

#### Scenario: Confirm sheet precedes logging
- **WHEN** the user selects a saved meal to log
- **THEN** a confirm sheet appears listing the components, the live total, and the target slot before any entry is created

#### Scenario: Fan out into entries on confirm
- **WHEN** the user confirms logging a four-component meal into lunch for the current day
- **THEN** four food entries appear under lunch, one per component, each carrying that component food's nutrition scaled by its portion and linked to that library food

#### Scenario: Logged entries are ordinary entries
- **WHEN** a meal has been logged and the user later edits or deletes one of the resulting entries
- **THEN** that entry behaves exactly like any individually logged entry, and the other entries and the saved meal are unaffected

### Requirement: Skip unavailable components when logging
When a saved meal is logged, the system SHALL skip any component whose referenced library food no longer resolves (archived or removed) and log only the resolvable components. The confirm sheet SHALL indicate how many components are unavailable and will be skipped. If every component is unavailable, the system SHALL NOT create any entry and SHALL indicate that nothing can be logged.

#### Scenario: One component unavailable
- **WHEN** the user logs a four-component meal in which one component's library food has been archived
- **THEN** the confirm sheet notes that one item is unavailable, and confirming logs three entries for the resolvable components only

#### Scenario: All components unavailable
- **WHEN** the user attempts to log a meal whose every component food has been archived or removed
- **THEN** no entry is created and the sheet indicates there is nothing left to log
