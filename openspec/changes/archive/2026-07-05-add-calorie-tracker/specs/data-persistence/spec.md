## ADDED Requirements

### Requirement: Durable local persistence
The system SHALL persist all food entries and user goals in browser IndexedDB so that data survives page reloads and browser restarts on the same device.

#### Scenario: Data survives reload
- **WHEN** the user logs entries, then reloads the page
- **THEN** the same entries and goals are displayed

#### Scenario: Storage unavailable
- **WHEN** IndexedDB cannot be opened (e.g., blocked by browser settings)
- **THEN** the app still runs with in-memory data and warns the user that data will not be saved

### Requirement: Storage abstraction
All reads and writes of entries and goals MUST go through a single storage interface (e.g., `StorageRepository`) with async methods; UI components MUST NOT access IndexedDB directly, so a remote database implementation can be substituted later without UI changes.

#### Scenario: Swappable backend
- **WHEN** the IndexedDB implementation is replaced by another implementation of the same interface
- **THEN** the application compiles and functions without changes to UI components

### Requirement: Day-keyed retrieval
The storage layer SHALL support retrieving all entries for a given calendar date efficiently.

#### Scenario: Load a day's entries
- **WHEN** the app requests entries for a specific date
- **THEN** the storage layer returns exactly the entries whose date matches, without loading other days
