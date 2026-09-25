## MODIFIED Requirements

### Requirement: Amount resolution for matched items
A library-match item MAY carry an amount expressed either as a count of the food's serving label or as a weight in grams. A serving count SHALL prefill the amount in the food's serving label unit. A gram amount SHALL prefill the amount in grams only when the food's serving anchor offers grams as a logging unit; otherwise the item SHALL start at the food's default portion (per the serving-units capability). An item with no stated amount — including habitual phrasing such as "my normal shake" — SHALL likewise start at the food's default portion. Estimate items SHALL always enter as 1 serving representing the described portion.

#### Scenario: Serving-count amount
- **WHEN** the description says "2 slices" and the matched food's serving label is "slice"
- **THEN** the item is prefilled with amount 2 in that serving label

#### Scenario: Gram amount with weight-anchored food
- **WHEN** the description says "150 g of rice" and the matched food's anchor has a weight equivalence
- **THEN** the item is prefilled with amount 150 in grams

#### Scenario: Gram amount without weight equivalence
- **WHEN** the description states a weight but the matched food's anchor has no equivalence
- **THEN** the item is prefilled with amount 1 of the food's serving label

#### Scenario: No amount stated
- **WHEN** the description references a food without a quantity (e.g. "my normal whey protein shake") and that food counts by default
- **THEN** the item is prefilled with amount 1 of the food's serving label

#### Scenario: No amount stated for a weighed food
- **WHEN** the description mentions a banana without a quantity, and the matched food is anchored at "1 banana = 118 g" with default logging unit g
- **THEN** the item is prefilled with 118 g

### Requirement: Single parsed item fills the form in place
When parsing yields exactly one item, the system SHALL close the overlay and fill the open entry form with it instead of showing a review list. A library match SHALL fill the form exactly as if the user had selected that food from the name combobox, with the resolved amount, unit, and meal applied in place of the food's default portion, and without moving focus to the amount field; an estimate SHALL fill the form exactly as an accepted AI photo estimate does (a new one-serving food). All prefilled values MUST remain editable before saving, and the filled form SHALL behave identically to those existing flows, including the "Edit nutrition" library-update semantics.

#### Scenario: Single library match
- **WHEN** parsing "I had my normal whey protein shake" yields one match for a food that counts by default
- **THEN** the form is filled with that food's name and nutrition, amount 1 of its serving label, and the dialog's meal, ready to edit or save

#### Scenario: Single estimate
- **WHEN** parsing yields one estimate item
- **THEN** the form is filled as a new one-serving food with the estimated nutrition, exactly like an accepted AI photo estimate
