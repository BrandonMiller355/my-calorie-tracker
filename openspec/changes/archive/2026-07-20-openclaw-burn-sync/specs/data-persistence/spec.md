## ADDED Requirements

### Requirement: Calorie-only day overrides
A per-day goal override MAY carry only a calorie value, with null macro values meaning "no macro override for this date." The storage layer SHALL return such overrides with their macro values absent, and the application SHALL derive that date's effective goals per field: the override's value where present, the default goals' value where absent. Saving a day override from the app continues to persist all four values, making its macros concrete.

#### Scenario: Effective goals for a calories-only override
- **WHEN** the app loads goals for a date whose override row has calories set and null macros
- **THEN** the effective goals for that date use the override's calories and the default goals' carbs, protein, and fat

#### Scenario: Default macro change applies to calorie-only override days
- **WHEN** the user changes the default macro goals after a calories-only override row was created for an earlier date
- **THEN** viewing that earlier date shows the new default macro goals alongside the overridden calories

#### Scenario: Full overrides are unaffected
- **WHEN** the app loads goals for a date whose override row has all four values set
- **THEN** the effective goals for that date are the override's values, exactly as before this change
