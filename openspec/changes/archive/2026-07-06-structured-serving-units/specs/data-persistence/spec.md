# data-persistence Delta Spec

## ADDED Requirements

### Requirement: Structured serving persistence
The system SHALL persist serving data structurally, with no free-text serving description column. Library foods MUST persist the count label and optional equivalence (amount + unit, both present or both absent, unit constrained to the fixed unit set). Food entries MUST persist the logged amount and unit, the serving-anchor snapshot, and the derived servings multiplier, so an entry is fully self-contained for display, editing, and totals. Server-side meal suggestions MUST return each food's serving anchor.

#### Scenario: Entry round-trips self-contained
- **WHEN** an entry logged as 45 g of a food anchored at "1 can (drained) = 120 g" is saved and later loaded
- **THEN** the loaded entry carries the amount, unit, anchor snapshot, and multiplier without consulting the foods table

#### Scenario: Suggestions carry the anchor
- **WHEN** the app requests suggestions for a meal
- **THEN** each suggested food includes its count label and equivalence so selection can populate the unit picker
