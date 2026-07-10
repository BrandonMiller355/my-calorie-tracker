## ADDED Requirements

### Requirement: Analysis startable from an already-captured photo
The analyze flow SHALL be startable with a photo supplied by its host (e.g. the no-match handoff from the ai-food-identify capability) instead of opening a capture view. When started with a supplied photo, the flow SHALL enter at the pre-send photo review step with that photo as the frozen frame and any host-supplied context note prefilled, and all review behaviors (retake, note editing, send, cancel) SHALL work as they do for a freshly captured photo.

#### Scenario: Handoff enters at pre-send review
- **WHEN** the identify flow hands its photo and note to the analyze flow
- **THEN** the analyze flow opens at the pre-send review showing that photo with the note prefilled, without a capture step

#### Scenario: Retake still available after handoff
- **WHEN** the user activates retake on a review reached via a supplied photo
- **THEN** the supplied frame is discarded and the normal photo-source selection opens for a new photo

## MODIFIED Requirements

### Requirement: Accepted estimate enters the existing prefill flow
The system SHALL, on acceptance, hand the estimate to the host as a search result whose serving is one "serving" (the photographed portion, with no weight equivalence), pre-filled with the estimated name and nutrition. When the flow is hosted from the search screen, acceptance SHALL open the add-entry form pre-filled, preserving any in-progress form context (such as the selected meal). When the flow is hosted from an already-open entry form, acceptance SHALL fill that form in place, preserving its meal and date, without navigating. The saved entry SHALL use the same source classification as other prefilled results.

#### Scenario: User accepts an estimate
- **WHEN** the user accepts the displayed estimate from the search screen
- **THEN** the add-entry form opens pre-filled with the estimate's name and nutrition, per one serving, with any in-progress meal context preserved

#### Scenario: User accepts an estimate inside the entry form
- **WHEN** the user accepts the displayed estimate in a flow hosted from an open entry form
- **THEN** that form's fields are filled with the estimate's name and nutrition, per one serving, keeping the form's meal and date

#### Scenario: Accepted values remain editable
- **WHEN** the pre-filled form opens after acceptance
- **THEN** the user can edit any value before saving, as with any other prefilled result
