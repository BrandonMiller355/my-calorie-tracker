## ADDED Requirements

### Requirement: Week-range retrieval
The storage layer SHALL support retrieving, for a given range of calendar dates, each date's consumed calorie total, effective calorie-burn goal (applying the same per-day-override-else-default precedence as single-day retrieval), and whether any entries exist for that date, in a single request.

#### Scenario: Load a week's deficit data
- **WHEN** the app requests the range summary for a set of dates spanning a calendar week
- **THEN** the storage layer returns one result per date in that range without the client issuing a separate request per date

#### Scenario: Override applied within a range
- **WHEN** a date within the requested range has a per-day goal override
- **THEN** the returned effective goal for that date reflects the override, not the default

### Requirement: Weekly deficit goal persistence
The system SHALL persist a single weekly deficit goal value per user, separate from the per-day calorie/macro goals, with no per-week history.

#### Scenario: Weekly deficit goal survives reload
- **WHEN** the user saves a weekly deficit goal, then reloads the page
- **THEN** the same weekly deficit goal value is used

#### Scenario: Unset weekly deficit goal
- **WHEN** the user has never saved a weekly deficit goal
- **THEN** the storage layer reports it as unset rather than a default numeric value
