## ADDED Requirements

### Requirement: Default logging unit and default portion
Every library food SHALL have a default logging unit: either its count label, or — only when its serving anchor has an equivalence — one of the measure units of that equivalence's dimension. The count label is the default logging unit unless one of those measure units is chosen. The food's default portion is the amount and unit its logging starts at when no amount is known yet: 1 of the count label when the default logging unit is the count label; otherwise the equivalence amount converted into the default logging unit, rounded to at most two decimal places. A default logging unit that the food's current anchor does not offer (its equivalence was removed, or changed to the other dimension) MUST be treated as the count label rather than rejected. The default logging unit is a preference of the library food alone: it MUST NOT be snapshotted onto entries, and it MUST NOT change which units a food can be logged in or how the servings multiplier is derived.

#### Scenario: Weighed food starts at its serving weight
- **WHEN** a food anchored at "1 banana = 118 g" has default logging unit g
- **THEN** its default portion is 118 g, which derives a servings multiplier of exactly 1

#### Scenario: Default converted into another unit of the dimension
- **WHEN** a food anchored at "1 serving = 28 g" has default logging unit oz
- **THEN** its default portion is 0.99 oz

#### Scenario: Counted food starts at one count
- **WHEN** a food anchored at "1 slice = 28 g" keeps its count label as the default logging unit
- **THEN** its default portion is 1 slice

#### Scenario: Count-only food can only count
- **WHEN** a food has no equivalence
- **THEN** its count label is its only possible default logging unit, and its default portion is 1 of that label

#### Scenario: Stale default falls back to counting
- **WHEN** a food whose default logging unit is g has its equivalence changed to "1 cup = 240 ml"
- **THEN** its default logging unit is treated as its count label and its default portion is 1 cup
