## MODIFIED Requirements

### Requirement: Silent auto-capture on logging
When the user logs an entry whose name does not match any library food, the system SHALL silently save it to the library with the entry's nutrition values, the serving anchor as defined in the form, and its source (manual or search). When the name matches an existing library food, the system SHALL link the entry to that food. Quick calories-only entries (source `quick`, per the quick-calorie-logging capability) are exempt: logging one MUST NOT create, match, modify, or link any library food. Adjusting nutrition or serving-anchor values in the form for a matched food MUST NOT modify the library food unless the user explicitly did so through the entry form's "Edit nutrition" library-update flow (per the food-logging capability); a matched food's stored values and serving anchor are otherwise left as they were. Auto-capture failure MUST NOT prevent the entry itself from being saved.

#### Scenario: New food captured on first log
- **WHEN** the user logs "Chicken breast" for the first time with an anchor of "1 serving = 100 g", whether typed manually or selected from online search
- **THEN** a library food "Chicken breast" is created with the logged nutrition values and that anchor, without any additional user action

#### Scenario: Logging a different amount does not overwrite the library
- **WHEN** the user selects a library food and only changes the logged amount and unit (without opening "Edit nutrition"), then saves the entry
- **THEN** the entry reflects the new amount but the library food's nutrition values and serving anchor are unchanged

#### Scenario: Capture failure does not block logging
- **WHEN** saving the entry succeeds but saving the library food fails
- **THEN** the entry is persisted and no error blocks the user

#### Scenario: Quick entries are never captured
- **WHEN** the user logs a quick calories-only entry
- **THEN** no library food is created, matched, modified, or linked

### Requirement: Library-first name search
As the user types in the name field, the system SHALL match against the library's food names and descriptions (case-insensitive) and show matching foods in a dropdown, each with its description as a secondary line. The dropdown MUST always offer fixed actions after any matches: searching the online food database for the typed text and using the typed text as a new food via manual entry (both only while text is typed), and logging calories only (per the quick-calorie-logging capability) as the last item in both the empty-field and typing states. Selecting a library food SHALL pre-fill the form with its nutrition values and serving anchor, and populate the unit picker from that anchor.

#### Scenario: Match on description
- **WHEN** the library contains "PB&J" with description "15g jelly, 16g pbfit, 2 sara lee slices" and the user types "pbfit"
- **THEN** "PB&J" appears in the dropdown

#### Scenario: Select a library food
- **WHEN** the user selects a library food anchored at "1 can (drained) = 120 g" from the dropdown
- **THEN** the form's name, calories, and macros are pre-filled and the unit picker offers "can (drained)" plus weight units

#### Scenario: Free text is never a dead end
- **WHEN** the user types a name matching nothing in the library
- **THEN** the dropdown still offers "search online" and "use as new food" actions, and submitting the form logs the food manually

#### Scenario: Quick action is last in every state
- **WHEN** the name field is focused with no text, or has typed text with matches or none
- **THEN** the "log calories only" action is offered as the final dropdown item
