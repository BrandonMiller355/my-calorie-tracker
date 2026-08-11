## MODIFIED Requirements

### Requirement: Silent auto-capture on logging
When the user logs an entry whose name does not match any library food, the system SHALL silently save it to the library with the entry's nutrition values, the serving anchor as defined in the form, its source (manual or search), and the photo held in the form for that new food, if any (per the food-library-photos capability). When the name matches an existing library food, the system SHALL link the entry to that food. Quick calories-only entries (source `quick`, per the quick-calorie-logging capability) are exempt: logging one MUST NOT create, match, modify, or link any library food. Adjusting nutrition or serving-anchor values in the form for a matched food MUST NOT modify the library food unless the user explicitly did so through the entry form's "Edit nutrition" library-update flow (per the food-logging capability); a matched food's stored values and serving anchor are otherwise left as they were. Auto-capture failure MUST NOT prevent the entry itself from being saved.

#### Scenario: New food captured on first log
- **WHEN** the user logs "Chicken breast" for the first time with an anchor of "1 serving = 100 g", whether typed manually or selected from online search
- **THEN** a library food "Chicken breast" is created with the logged nutrition values and that anchor, without any additional user action

#### Scenario: New food captured with its photo
- **WHEN** the user logs a food the library does not know and has attached a photo to it in the form
- **THEN** the captured library food is created with the logged values and that photo becomes its image, per the food-library-photos capability

#### Scenario: Logging a different amount does not overwrite the library
- **WHEN** the user selects a library food and only changes the logged amount and unit (without opening "Edit nutrition"), then saves the entry
- **THEN** the entry reflects the new amount but the library food's nutrition values and serving anchor are unchanged

#### Scenario: Capture failure does not block logging
- **WHEN** saving the entry succeeds but saving the library food fails
- **THEN** the entry is persisted and no error blocks the user

#### Scenario: Quick entries are never captured
- **WHEN** the user logs a quick calories-only entry
- **THEN** no library food is created, matched, modified, or linked
