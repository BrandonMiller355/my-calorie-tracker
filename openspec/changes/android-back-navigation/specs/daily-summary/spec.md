## MODIFIED Requirements

### Requirement: Day navigation
The system SHALL allow the user to switch the selected day (previous/next and date picker), defaulting to today. Returning to today SHALL also be reachable through the platform back signal while the Log tab is showing, in a single press regardless of how many days the user moved, per the app-navigation capability.

#### Scenario: Navigate to another day
- **WHEN** the user navigates to a different date
- **THEN** the log and summary show that date's entries and totals

#### Scenario: Back returns to today
- **WHEN** the user has selected a day other than today and presses back with no layer open
- **THEN** the log and summary return to today in one press
