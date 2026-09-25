## MODIFIED Requirements

### Requirement: Confident match fills the form in place
When exactly one candidate is returned, the system SHALL fill the open entry form from that library food exactly as if the user had selected it from the name combobox: name, per-serving nutrition, link to the library food, and unit options derived from its serving anchor. When the response includes a weight amount and the food's serving anchor offers grams as a logging unit, the form's amount and unit SHALL be prefilled with that amount in grams, and focus SHALL NOT move to the amount field; otherwise the amount and unit SHALL start at the food's default portion, including the focused and selected amount for a weight or volume default, exactly as a combobox pick does (per the food-logging capability). An `estimate`-sourced weight SHALL be visibly labeled as an AI-estimated weight. All prefilled values MUST remain editable before saving. Identification and prefilling MUST NOT themselves modify the library food; once filled, the form behaves exactly as if the food had been picked from the combobox, including the "Edit nutrition" library-update semantics defined by the food-logging capability.

#### Scenario: Match with scale weight
- **WHEN** identification returns one candidate anchored at "1 serving = 100 g" and 142 grams from the scale
- **THEN** the form is filled with that food's name and nutrition, amount 142, unit g, and the live computed-nutrition preview reflects 1.42 servings

#### Scenario: Matched food has no weight equivalence
- **WHEN** identification returns one candidate whose anchor has no equivalence, plus a gram amount
- **THEN** the form is filled with that food and amount 1 of its serving label, ignoring the gram amount

#### Scenario: Weighed food without a usable weight
- **WHEN** identification returns one candidate anchored at "1 banana = 118 g" with default logging unit g, and no weight amount
- **THEN** the form is filled with that food at 118 g, with the amount field focused and its value selected

#### Scenario: Estimated weight is labeled
- **WHEN** the prefilled amount came from source `estimate`
- **THEN** the user sees it labeled as an AI-estimated weight before saving

#### Scenario: Prefill does not touch the library
- **WHEN** the user adjusts the prefilled amount and unit (without opening "Edit nutrition") and saves the entry
- **THEN** the entry stores the adjusted values and the matched library food's nutrition and serving anchor are unchanged
