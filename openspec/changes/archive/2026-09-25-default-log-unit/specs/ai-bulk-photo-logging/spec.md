## MODIFIED Requirements

### Requirement: Single review list of identified items
When the batch completes, the system SHALL present all results as one review list, in identification order, with one row per photo showing: the photo's thumbnail, the matched food's name, an editable amount and unit, and an editable meal selection defaulting to the dialog's selected meal. Amount and unit SHALL be prefilled by the single-photo rules: the returned gram amount with unit grams when the food's serving anchor offers grams as a logging unit, otherwise the food's default portion (per the serving-units capability) with any gram amount ignored. An amount whose source is an AI visual estimate SHALL be visibly labeled as such. Each row SHALL offer a remove action. Nothing SHALL be logged before the explicit bulk-log action.

#### Scenario: Rows prefilled from scale reads
- **WHEN** three photos each matched a library food with a scale-read weight and every food's anchor offers grams
- **THEN** the review list shows three rows in photo order, each with its thumbnail, the food's name, the read weight in grams, and the dialog's meal preselected

#### Scenario: Matched food without weight equivalence
- **WHEN** a row's food has no equivalence in its serving anchor and the response included a gram amount
- **THEN** that row prefills 1 of the food's serving label and the gram amount is ignored

#### Scenario: Weighed food without a usable weight
- **WHEN** a row's food is anchored at "1 banana = 118 g" with default logging unit g, and the response included no gram amount
- **THEN** that row prefills 118 g

#### Scenario: User removes a row
- **WHEN** the user activates a row's remove action
- **THEN** the row disappears and the bulk-log count decreases accordingly
