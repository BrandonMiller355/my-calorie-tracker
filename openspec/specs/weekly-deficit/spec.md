# weekly-deficit Specification

## Purpose
Show the user their running calorie deficit for the current calendar week (Monday through the selected date), compared against an optional weekly deficit goal, so they can track progress toward a weekly target rather than just a daily one.

## Requirements

### Requirement: Weekly deficit goal setting
The system SHALL let the user set a weekly calorie deficit goal (a single kcal target) in Settings, persist it, and apply it to every week until changed. The goal SHALL NOT be versioned per week — a change applies uniformly when viewing any week, past or present.

#### Scenario: Set weekly deficit goal
- **WHEN** the user saves a weekly deficit goal value in settings
- **THEN** the weekly deficit widget compares the computed deficit-to-date against the new value on every week viewed thereafter, including past weeks

#### Scenario: No weekly deficit goal set
- **WHEN** the user has never set a weekly deficit goal
- **THEN** the weekly deficit widget still shows the computed deficit-to-date, without a comparison to a goal

### Requirement: Weekly deficit-to-date display
The system SHALL display, on the day log screen, the sum of (calorie burn goal − consumed calories) for each date from the Monday of the selected date's calendar week through the selected date, inclusive.

#### Scenario: Viewing today
- **WHEN** the selected date is today
- **THEN** the widget shows the sum from this week's Monday through today, updating as entries are added, edited, or deleted on any day in that range

#### Scenario: Viewing a past date
- **WHEN** the user navigates to a date in a previous calendar week
- **THEN** the widget shows the sum from that week's Monday through the selected date only, not the full week

#### Scenario: Viewing the first day of a week
- **WHEN** the selected date is a Monday
- **THEN** the widget shows that single day's deficit only

### Requirement: Missing log data disclaimer
The system SHALL indicate when the displayed weekly deficit-to-date includes one or more elapsed days with zero logged entries, since a day with nothing logged cannot be distinguished from a day that was not logged at all.

#### Scenario: A past day in range has no entries
- **WHEN** any date strictly before the selected date within the displayed range has zero food entries
- **THEN** the widget shows a disclaimer that some days are missing log entries

#### Scenario: Today has no entries yet
- **WHEN** the selected date is today and today has zero entries so far
- **THEN** today's emptiness alone does not trigger the disclaimer

#### Scenario: A fully-elapsed selected date has no entries
- **WHEN** the selected date is a past date (not today) and it has zero entries
- **THEN** the disclaimer is shown, since the selected date itself has already elapsed
