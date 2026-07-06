# food-search Specification

## Purpose
TBD - created by syncing change add-calorie-tracker. Update Purpose after review.

## Requirements

### Requirement: Search external food database
The system SHALL provide a search screen where the user enters a text query and receives matching foods from a public food database API (Open Food Facts).

#### Scenario: Successful search
- **WHEN** the user submits a query that matches foods in the database
- **THEN** the system displays a list of results, each showing the food name and per-serving calories, carbs, protein, and fat where available

#### Scenario: No results
- **WHEN** the user submits a query with no matches
- **THEN** the system shows a "no results" message and offers manual entry as a fallback

#### Scenario: API unavailable
- **WHEN** the search request fails or times out
- **THEN** the system shows a non-blocking error message and offers manual entry as a fallback

### Requirement: Select a search result
The system SHALL let the user select a result and hand its name, nutrition data, and serving anchor to the food-logging flow, pre-filled and editable before saving. When the search screen was opened from within the add-entry form, selecting a result (or navigating back) SHALL return the user to that form with its in-progress context — notably the selected meal — restored.

#### Scenario: Select result to log
- **WHEN** the user selects a search result
- **THEN** the add-entry form opens pre-filled with the result's name, nutrition values, and serving anchor for the user to adjust meal, amount, and unit

#### Scenario: Return to an in-progress form
- **WHEN** the user opened search from the add-entry form's "search online" action with meal "lunch" selected, then selects a result
- **THEN** the add-entry form reopens pre-filled with the result and the meal still set to "lunch"

#### Scenario: Standalone search unchanged
- **WHEN** the user opens the search screen directly (not from the add-entry form) and selects a result
- **THEN** the add-entry form opens pre-filled with the result using the default meal behavior

### Requirement: Incomplete nutrition data
The system MUST handle results with missing nutrient fields by treating missing values as blank (not zero) in the pre-filled form and requiring the user to confirm before saving.

#### Scenario: Result missing a macro
- **WHEN** a selected result lacks a value for one or more macros
- **THEN** the corresponding form fields are blank and flagged for the user to fill in or confirm

### Requirement: Structured serving data from results
The system SHALL map each search result's serving information to a structured anchor. When per-serving nutrients exist and the result carries a parseable positive serving quantity in grams or milliliters, the anchor SHALL be "1 serving = that quantity". When only per-100g (or per-100ml) nutrients exist, the result's nutrition SHALL be treated as one serving anchored at 100 g (or 100 ml). Serving data that is missing, non-positive, or in an unrecognized unit MUST degrade to a count-only anchor (label "serving", no equivalence) — never to a wrong equivalence.

#### Scenario: Per-100g result is loggable by weight
- **WHEN** a result has only per-100g nutrients and the user selects it and logs 45 g
- **THEN** the entry's totals are 45% of the per-100g values

#### Scenario: Unusable serving data degrades safely
- **WHEN** a result has per-serving nutrients but its serving quantity is missing or in an unrecognized unit
- **THEN** the result is offered with a count-only "serving" anchor and no weight or volume units
