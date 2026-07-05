# user-auth Specification

## Purpose
Gate the app behind a Supabase Auth session for a single-user deployment: email + password sign-in, persistent sessions, sign-out, and no self-service signup.

## Requirements

### Requirement: Email and password sign-in
The system SHALL allow a user to sign in with an email address and password via Supabase Auth.

#### Scenario: Successful sign-in
- **WHEN** the user submits a valid email and password on the login screen
- **THEN** a session is established and the app navigates to the day log

#### Scenario: Invalid credentials
- **WHEN** the user submits an incorrect email or password
- **THEN** the login screen shows an error message and no session is established

### Requirement: Authentication gate
All application screens (day log, search, settings) MUST be inaccessible without an authenticated session; unauthenticated visitors SHALL see only the login screen.

#### Scenario: Unauthenticated visit
- **WHEN** a visitor without a session opens any app route
- **THEN** the login screen is shown instead of the requested screen

#### Scenario: Authenticated visit
- **WHEN** a user with a valid session opens the app
- **THEN** the requested screen renders without prompting for credentials

### Requirement: Session persistence
The system SHALL persist the session in the browser and restore it automatically, so the user does not re-enter credentials on every visit; expired sessions SHALL be refreshed automatically while the refresh token is valid.

#### Scenario: Returning user
- **WHEN** a signed-in user closes the browser and returns later with a valid session
- **THEN** the app loads directly to the day log without a login prompt

### Requirement: Sign-out
The system SHALL provide a sign-out action that ends the session and returns to the login screen.

#### Scenario: User signs out
- **WHEN** the user activates sign-out from the settings screen
- **THEN** the session is cleared and the login screen is shown

### Requirement: No self-service signup
The application MUST NOT offer a sign-up flow; user accounts are provisioned manually in the Supabase dashboard, and public signups SHALL be disabled in the Supabase project's auth settings.

#### Scenario: No signup path in UI
- **WHEN** a visitor views the login screen
- **THEN** no sign-up or registration option is presented
