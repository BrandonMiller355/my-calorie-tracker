# daily-summary Specification

## Purpose
TBD - created by syncing change add-calorie-tracker. Update Purpose after review.

## Requirements

### Requirement: Daily totals
The system SHALL display, for the selected day, the total calories, carbs (g), protein (g), and fat (g) summed across all entries.

#### Scenario: Totals update on log change
- **WHEN** an entry is added, edited, or deleted on the selected day
- **THEN** the displayed totals recompute to match the sum of that day's entries

#### Scenario: Empty day
- **WHEN** the selected day has no entries
- **THEN** all totals display as zero

### Requirement: Daily goals
The system SHALL let the user set daily goals for calorie burn, carbs, protein, and fat, persist them, and apply them to every day until changed. The calorie value represents an estimated calorie burn ceiling (typically sourced from an external activity tracker) rather than a fixed diet target. It is labeled "Calorie burn" where the goal is set or edited (Settings, day goal editor); the daily summary on the log page labels it "Calories" for brevity.

#### Scenario: Set goals
- **WHEN** the user saves new goal values in settings
- **THEN** the summary view shows progress against the new goals on all days

#### Scenario: Default goals
- **WHEN** the user has never set goals
- **THEN** the system uses sensible defaults (2000 kcal calorie burn; 250 g carbs, 100 g protein, 65 g fat) and indicates they are defaults

### Requirement: Remaining versus goal
The system SHALL display remaining amounts (goal minus consumed) for calorie burn and each macro, and MUST clearly indicate when a goal has been exceeded. For calorie burn, "remaining" represents how much more can be eaten before exceeding the day's estimated burn.

#### Scenario: Under goal
- **WHEN** the day's consumed calories are below the calorie burn goal
- **THEN** the summary shows the positive remaining amount

#### Scenario: Over goal
- **WHEN** the day's consumed calories exceed the calorie burn goal
- **THEN** the summary shows the overage with a distinct over-goal indication

### Requirement: Day navigation
The system SHALL allow the user to switch the selected day (previous/next and date picker), defaulting to today.

#### Scenario: Navigate to another day
- **WHEN** the user navigates to a different date
- **THEN** the log and summary show that date's entries and totals
