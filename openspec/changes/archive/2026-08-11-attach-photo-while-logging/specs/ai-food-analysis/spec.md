## MODIFIED Requirements

### Requirement: Multi-turn estimate refinement
The system SHALL let the user send free-text corrections about the current photo and receive a revised estimate that replaces the displayed one. The conversation (photo, corrections, estimates) SHALL be held only in client memory for the life of the review and MUST NOT be persisted to Supabase or any other store. On acceptance the analyzed photo MAY be handed to the host along with the estimate, in which case it remains client-side and is persisted only if the host goes on to attach it to a newly captured library food (per the food-library-photos capability); the corrections and estimates are discarded either way.

#### Scenario: User refines the estimate
- **WHEN** the user submits a correction such as "there's rice under it too"
- **THEN** a revised estimate for the same photo, accounting for all corrections so far, replaces the displayed estimate

#### Scenario: Refinement request fails
- **WHEN** a refinement request fails
- **THEN** the previous estimate remains displayed with a non-blocking error message and a retry action for the same correction

#### Scenario: Conversation is ephemeral
- **WHEN** the user closes the review by cancelling or navigating away
- **THEN** the photo, corrections, and estimates are discarded and nothing about them is persisted

#### Scenario: Only the accepted photo outlives the review
- **WHEN** the user accepts the estimate
- **THEN** the corrections and estimates are discarded, and the photo survives only as the value handed to the host, persisted only if it becomes a captured food's image

### Requirement: Accepted estimate enters the existing prefill flow
The system SHALL, on acceptance, hand the estimate to the host as a search result whose serving is one "serving" (the photographed portion, with no weight equivalence), pre-filled with the estimated name and nutrition. Acceptance SHALL also hand over the analyzed photo, so a host that can hold it may offer it as the photo for a food captured from the resulting entry (per the food-library-photos capability); a host that cannot hold a photo SHALL ignore it, and the estimate itself SHALL be unaffected either way. When the flow is hosted from the search screen, acceptance SHALL open the add-entry form pre-filled, preserving any in-progress form context (such as the selected meal). When the flow is hosted from an already-open entry form, acceptance SHALL fill that form in place, preserving its meal and date, without navigating. The saved entry SHALL use the same source classification as other prefilled results.

#### Scenario: User accepts an estimate
- **WHEN** the user accepts the displayed estimate from the search screen
- **THEN** the add-entry form opens pre-filled with the estimate's name and nutrition, per one serving, with any in-progress meal context preserved

#### Scenario: User accepts an estimate inside the entry form
- **WHEN** the user accepts the displayed estimate in a flow hosted from an open entry form
- **THEN** that form's fields are filled with the estimate's name and nutrition, per one serving, keeping the form's meal and date, and the analyzed photo is held by that form as the photo for the food it would capture

#### Scenario: Accepted values remain editable
- **WHEN** the pre-filled form opens after acceptance
- **THEN** the user can edit any value before saving, as with any other prefilled result

#### Scenario: Held photo remains the user's to change
- **WHEN** the entry form holds the analyzed photo after acceptance
- **THEN** the user can replace or remove it before saving, exactly as with a photo they chose themselves
