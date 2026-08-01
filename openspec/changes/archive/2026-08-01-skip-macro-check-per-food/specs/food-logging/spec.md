## ADDED Requirements

### Requirement: Macro/calorie mismatch warning

When the user saves a food entry whose entered calories do not roughly match what its carbs, protein, and fat add up to (per the Atwater estimate, with generous tolerance, and skipped entirely when all three macros are zero), the system SHALL warn the user with a confirmation prompt and save only if the user chooses to proceed. The warning MUST be suppressible per library food: if the entry is linked to a library food whose "skip macro/calorie mismatch check" flag (per the food-library capability) is set, the system SHALL save the entry without showing the warning. When the warning is shown and the user chooses to save anyway, the system SHALL set that flag on the linked library food, so future logs of the same food never show the warning again. Choosing not to proceed MUST leave the entry unsaved and the flag unchanged.

Setting the flag on "save anyway" applies only when the entry is linked to a library food (an existing match or a food captured as part of this save). Quick calories-only entries (source `quick`, per the quick-calorie-logging capability) never link a library food, so the warning is never suppressed for them and no flag is set.

#### Scenario: Mismatch warns and blocks on cancel
- **WHEN** the user saves an entry whose calories differ from the macro estimate beyond tolerance, the warning appears, and the user cancels
- **THEN** the entry is not saved and no library food flag is changed

#### Scenario: Save anyway suppresses the warning for that food thereafter
- **WHEN** the user saves a mismatched entry linked to (or capturing) a library food and chooses to save anyway
- **THEN** the entry is saved, that library food's skip-mismatch flag is set, and logging the same food again saves without showing the warning

#### Scenario: Flagged food never warns
- **WHEN** the user logs a food whose linked library food already has the skip-mismatch flag set, with mismatched calories
- **THEN** the entry saves silently with no warning

#### Scenario: Matching macros never warn
- **WHEN** the user saves an entry whose calories match the macro estimate within tolerance, or whose macros are all zero
- **THEN** no warning is shown and no flag is set, regardless of the linked food's flag

#### Scenario: Quick entries are never suppressed
- **WHEN** the user saves a mismatched quick calories-only entry and chooses to save anyway
- **THEN** the entry is saved and no library food is created, linked, or flagged
