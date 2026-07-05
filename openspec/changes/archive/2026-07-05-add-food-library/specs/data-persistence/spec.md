# data-persistence Specification (delta)

## ADDED Requirements

### Requirement: Food library persistence
The system SHALL persist library foods in the hosted database, scoped to the authenticated user. The storage layer SHALL support loading all of a user's non-archived foods in a single request, and retrieving per-meal suggestions (most recent and most frequent foods for a given meal) without loading all food entries client-side.

#### Scenario: Library loads once per session
- **WHEN** the app starts for a signed-in user
- **THEN** the full non-archived library is fetched in one request and reused for name matching without further per-keystroke requests

#### Scenario: Suggestions computed server-side
- **WHEN** the app requests suggestions for a meal
- **THEN** the storage layer returns the recent and most-used foods for that meal without transferring the user's full entry history

## MODIFIED Requirements

### Requirement: User-scoped data access
Every row in `food_entries`, `goals`, and `foods` MUST be owned by a user, and Row Level Security policies MUST restrict select, insert, update, and delete to rows where the owner matches the authenticated user.

#### Scenario: RLS blocks foreign data
- **WHEN** a request is made with a session belonging to user A for rows owned by user B
- **THEN** the database returns no rows and rejects writes

### Requirement: Storage abstraction
All reads and writes of entries, goals, and library foods MUST go through a single storage interface (e.g., `StorageRepository`) with async methods; UI components MUST NOT access the Supabase client directly, so the backing implementation can be substituted (e.g., in tests, or a future alternative backend) without UI changes.

#### Scenario: Swappable backend
- **WHEN** the Supabase implementation is replaced by another implementation of the same interface (e.g., in-memory in tests)
- **THEN** the application compiles and functions without changes to UI components
