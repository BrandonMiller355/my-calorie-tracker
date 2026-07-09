## MODIFIED Requirements

### Requirement: Computed nutrition display
When the entry form's nutrition is already known (a library food was selected, a search result was prefilled, or an existing entry is being edited), the form SHALL hide the per-serving nutrition inputs behind an "Edit nutrition" action and instead show, updating live with the logged amount and unit: the computed nutrition this entry will contribute, and the per-serving reference (count label, equivalence, and per-serving calories). The inputs SHALL remain visible (not collapsed) when defining a new food, or when a search result is missing nutrients that require confirmation, and visible inputs MUST be labeled as being per one serving.

Revealing the inputs when the entry is linked to an existing library food (by current name match or a carried reference) MUST also reveal the serving label and weight/volume equivalence fields, matching the Food Library screen's edit form, and MUST show a note that saving will update the food library. Saving in this state SHALL update the linked library food's name-scoped anchor and nutrition values in addition to saving the current entry, so that future logs of that food reflect the change; a failure to update the library food MUST NOT be silent — it SHALL surface the same save-failure indication used for a failed entry save.

Revealing the inputs when the entry has no linked library food (never captured, or the link no longer resolves to a library food) SHALL show only the nutrition inputs, and editing values SHALL affect this entry only and MUST NOT create or modify any library food.

#### Scenario: Computed display tracks the logged amount
- **WHEN** the form is prefilled with a food anchored at "1 can (drained) = 240 g" with 210 kcal per serving and the user enters 45 g
- **THEN** the form shows approximately 39.4 kcal for this entry before saving, without the per-serving inputs being visible

#### Scenario: Edit nutrition updates the linked library food
- **WHEN** the user selects a library food, clicks "Edit nutrition", changes the serving equivalence and calories, and saves
- **THEN** the entry is saved with the entered values and the linked library food's anchor and calories are updated to match, so the next time this food is logged it reflects the change

#### Scenario: Edit nutrition without a linked food stays entry-only
- **WHEN** the user edits nutrition on an entry that was never captured to the library, or whose linked food has since been archived or deleted
- **THEN** only the nutrition inputs are shown, the entry stores the changed values, and no library food is created or modified

#### Scenario: Edit nutrition on a past entry does not touch other history
- **WHEN** the user edits nutrition on a logged entry that is linked to a library food also referenced by other, already-logged entries, and saves
- **THEN** the edited entry and the library food reflect the new values, and every other previously-logged entry keeps the values it was originally saved with

#### Scenario: Missing search nutrients stay visible
- **WHEN** the form is prefilled from a search result lacking one or more macros
- **THEN** the nutrition inputs are shown (flagged for confirmation), not collapsed
