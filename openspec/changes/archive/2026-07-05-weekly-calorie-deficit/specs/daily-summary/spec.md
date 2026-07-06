## MODIFIED Requirements

### Requirement: Daily goals
The system SHALL let the user set daily goals for calorie burn, carbs, protein, and fat, persist them, and apply them to every day until changed. The calorie value represents an estimated calorie burn ceiling (typically sourced from an external activity tracker) rather than a fixed diet target, and is labeled "Calorie burn" wherever shown or edited.

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
