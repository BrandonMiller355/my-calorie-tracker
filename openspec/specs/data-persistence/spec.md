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
