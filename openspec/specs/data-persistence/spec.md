# data-persistence Specification

## Purpose
Persist food entries and goals durably in a hosted Supabase Postgres database, scoped to the authenticated user, behind a swappable storage interface.

## Requirements

### Requirement: Durable hosted persistence
The system SHALL persist all food entries and user goals in a hosted Supabase Postgres database, scoped to the authenticated user, so that data survives page reloads, browser restarts, cleared site data, and is available from any device the user signs in on.

#### Scenario: Data survives reload
- **WHEN** the user logs entries, then reloads the page
- **THEN** the same entries and goals are displayed

#### Scenario: Data available on another device
- **WHEN** the user signs in on a different browser or device
- **THEN** the same entries and goals are displayed

### Requirement: User-scoped data access
Every row in `food_entries`, `goals`, and `foods` MUST be owned by a user, and Row Level Security policies MUST restrict select, insert, update, and delete to rows where the owner matches the authenticated user.

#### Scenario: RLS blocks foreign data
- **WHEN** a request is made with a session belonging to user A for rows owned by user B
- **THEN** the database returns no rows and rejects writes

### Requirement: Backend unreachable handling
The app is online-only. When the Supabase backend cannot be reached, the system SHALL surface a clear error state to the user and MUST NOT report a write as successful when it did not persist.

#### Scenario: Backend unreachable on load
- **WHEN** the app cannot reach Supabase while loading a day's entries
- **THEN** an error state with a retry option is shown instead of an empty day log

#### Scenario: Backend unreachable on write
- **WHEN** adding, updating, or deleting an entry fails because the backend is unreachable
- **THEN** the user is informed the change was not saved and the UI does not show it as persisted

### Requirement: Storage abstraction
All reads and writes of entries, goals, and library foods MUST go through a single storage interface (e.g., `StorageRepository`) with async methods; UI components MUST NOT access the Supabase client directly, so the backing implementation can be substituted (e.g., in tests, or a future alternative backend) without UI changes.

#### Scenario: Swappable backend
- **WHEN** the Supabase implementation is replaced by another implementation of the same interface (e.g., in-memory in tests)
- **THEN** the application compiles and functions without changes to UI components

### Requirement: Day-keyed retrieval
The storage layer SHALL support retrieving all entries for a given calendar date efficiently.

#### Scenario: Load a day's entries
- **WHEN** the app requests entries for a specific date
- **THEN** the storage layer returns exactly the entries whose date matches, without loading other days

### Requirement: Food library persistence
The system SHALL persist library foods in the hosted database, scoped to the authenticated user. The storage layer SHALL support loading all of a user's non-archived foods in a single request, and retrieving per-meal suggestions (most recent and most frequent foods for a given meal) without loading all food entries client-side.

#### Scenario: Library loads once per session
- **WHEN** the app starts for a signed-in user
- **THEN** the full non-archived library is fetched in one request and reused for name matching without further per-keystroke requests

#### Scenario: Suggestions computed server-side
- **WHEN** the app requests suggestions for a meal
- **THEN** the storage layer returns the recent and most-used foods for that meal without transferring the user's full entry history

### Requirement: Week-range retrieval
The storage layer SHALL support retrieving, for a given range of calendar dates, each date's consumed calorie total, effective calorie-burn goal (applying the same per-day-override-else-default precedence as single-day retrieval), and whether any entries exist for that date, in a single request.

#### Scenario: Load a week's deficit data
- **WHEN** the app requests the range summary for a set of dates spanning a calendar week
- **THEN** the storage layer returns one result per date in that range without the client issuing a separate request per date

#### Scenario: Override applied within a range
- **WHEN** a date within the requested range has a per-day goal override
- **THEN** the returned effective goal for that date reflects the override, not the default

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

### Requirement: Weekly deficit goal persistence
The system SHALL persist a single weekly deficit goal value per user, separate from the per-day calorie/macro goals, with no per-week history.

#### Scenario: Weekly deficit goal survives reload
- **WHEN** the user saves a weekly deficit goal, then reloads the page
- **THEN** the same weekly deficit goal value is used

#### Scenario: Unset weekly deficit goal
- **WHEN** the user has never saved a weekly deficit goal
- **THEN** the storage layer reports it as unset rather than a default numeric value

### Requirement: Structured serving persistence
The system SHALL persist serving data structurally, with no free-text serving description column. Library foods MUST persist the count label and optional equivalence (amount + unit, both present or both absent, unit constrained to the fixed unit set). Food entries MUST persist the logged amount and unit, the serving-anchor snapshot, and the derived servings multiplier, so an entry is fully self-contained for display, editing, and totals. Server-side meal suggestions MUST return each food's serving anchor.

#### Scenario: Entry round-trips self-contained
- **WHEN** an entry logged as 45 g of a food anchored at "1 can (drained) = 120 g" is saved and later loaded
- **THEN** the loaded entry carries the amount, unit, anchor snapshot, and multiplier without consulting the foods table

#### Scenario: Suggestions carry the anchor
- **WHEN** the app requests suggestions for a meal
- **THEN** each suggested food includes its count label and equivalence so selection can populate the unit picker
