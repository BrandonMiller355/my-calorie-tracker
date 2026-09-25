# serving-units Specification

## Purpose
Define the structured serving-unit model shared by food logging, the food library, search, and persistence: a fixed set of weight and volume measure units with in-dimension conversion, a per-food serving anchor (a customizable count label plus an optional single-unit equivalence) that nutrition values are stored against, the rules for which units a food may be logged in, and the derivation of an entry's servings multiplier from its logged amount and unit.

## Requirements

### Requirement: Unit set and dimensions
The system SHALL support a fixed set of measure units in two dimensions: weight (g, oz, lb, kg) and volume (ml, fl oz, cup, tbsp, tsp). Amounts MUST convert between units of the same dimension using fixed factors, and the system MUST NOT convert between weight and volume.

#### Scenario: Convert within a dimension
- **WHEN** an amount of 1 oz is converted to grams
- **THEN** the result is 28.3495 g

#### Scenario: No cross-dimension conversion
- **WHEN** a food's serving equivalence is in grams
- **THEN** volume units are not offered for logging that food, and no gram↔milliliter conversion is ever performed

### Requirement: Serving anchor
Every food SHALL have a serving anchor consisting of a count label (defaulting to "serving", customizable, e.g. "can (drained)") and optionally an equivalence stating what one count equals as a positive amount of a single measure unit (e.g. 1 can (drained) = 120 g). Nutrition values are always stored per one count. The count label MUST NOT equal any of the nine measure unit names, and an equivalence amount MUST be greater than zero.

#### Scenario: Anchor with weight equivalence
- **WHEN** a food defines label "can (drained)" with equivalence 120 g
- **THEN** its nutrition values mean "per 1 can (drained)" and 1 can (drained) is treated as exactly 120 g

#### Scenario: Reserved label rejected
- **WHEN** the user tries to set a food's count label to "g"
- **THEN** the system rejects it with a validation message

### Requirement: Available logging units
When logging or editing an entry, the system SHALL offer the food's count label as a unit, plus all units of the equivalence's dimension when an equivalence exists. Foods without an equivalence SHALL offer only the count label.

#### Scenario: Weight-anchored food offers weight units
- **WHEN** the user logs a food anchored at "1 serving = 100 g"
- **THEN** the unit picker offers "serving", g, oz, lb, and kg — and no volume units

#### Scenario: Count-only food offers only its label
- **WHEN** the user logs a food with label "bowl" and no equivalence
- **THEN** the unit picker offers only "bowl"

### Requirement: Servings multiplier derivation
The system SHALL derive an entry's servings multiplier from its logged amount and unit at save time: an amount in the count label yields the amount itself; an amount in a measure unit yields the ratio of the logged amount to the equivalence, converted through the dimension's base unit. Nutrition totals MUST equal per-serving values times this multiplier.

#### Scenario: Multiplier from count
- **WHEN** the user logs 2 "can (drained)" of a food
- **THEN** the multiplier is 2

#### Scenario: Multiplier from weight
- **WHEN** the user logs 45 g of a food anchored at "1 serving = 100 g" with 200 kcal per serving
- **THEN** the multiplier is 0.45 and the entry contributes 90 kcal

#### Scenario: Multiplier across units of one dimension
- **WHEN** the user logs 1 oz of a food anchored at "1 serving = 28.3495 g"
- **THEN** the multiplier is 1

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
