# ai-food-identify Specification

## Purpose
Log a food already in the personal library without typing its name or weight: photograph the food (typically on the kitchen scale), match it against the library via an AI vision model, and prefill the entry form — including the weight, when readable — with the matched food's nutrition. Falls back to the ai-food-analysis estimate flow when nothing in the library matches.

## Requirements

### Requirement: Identify entry point in the Add Food dialog
The Add Food dialog (entry form in add mode) SHALL offer an "identify from photo" camera action at the top right whenever a photo source (camera capture or file selection) is available. The action MUST NOT be rendered when editing an existing entry, and all other entry-form behavior SHALL be unchanged when the action is unused.

#### Scenario: Action shown when adding
- **WHEN** the user opens the Add Food dialog in a browser with a photo source available
- **THEN** the identify-from-photo action is visible at the top of the dialog

#### Scenario: Action hidden when editing
- **WHEN** the user opens the dialog to edit an existing entry
- **THEN** no identify-from-photo action is shown

### Requirement: Photo capture with pre-send review
The identify flow SHALL obtain its photo through the same photo source selection and pre-send review behavior as the ai-food-analysis capability: capture or choose a photo, then review the frozen frame with a retake action, an optional free-text context note, an explicit send action, and a cancel action. Identification MUST NOT begin before the send action is activated, and cancelling at any point before send MUST return to the entry form with its prior state intact.

#### Scenario: Review before send
- **WHEN** the user captures a photo from the identify action
- **THEN** the frozen frame is shown with retake, an optional note field, send, and cancel — and no identification request has been sent

#### Scenario: Cancel preserves the form
- **WHEN** the user cancels from capture or review
- **THEN** no request is sent and the entry form is exactly as they left it

### Requirement: Server-proxied identification with a protected API key
The system SHALL identify photos through a dedicated `identify-food` Supabase Edge Function that holds the AI provider's API key (Gemini) as a server-side secret and rejects requests without a valid Supabase session JWT. Each request SHALL carry the photo, the optional context note, and the user's non-archived library foods (id, name, optional description, and serving-weight information); archived foods MUST NOT be sent or matched. The function MUST be stateless: the photo, note, library payload, and result MUST NOT be persisted server-side, and the client SHALL discard them when the identify flow closes.

#### Scenario: Authenticated user requests identification
- **WHEN** a signed-in user sends a photo for identification
- **THEN** the Edge Function calls the Gemini API with the server-held key and returns the identification result

#### Scenario: Unauthenticated request rejected
- **WHEN** a request without a valid Supabase JWT reaches the Edge Function
- **THEN** the request is rejected without calling the Gemini API

#### Scenario: Archived foods excluded
- **WHEN** the user's library contains archived foods
- **THEN** those foods are not included in the request and can never be returned as candidates

#### Scenario: Nothing persisted
- **WHEN** the identify flow closes (by filling the form, cancelling, or navigating away)
- **THEN** the photo, note, and candidates are discarded and nothing about them is stored anywhere

### Requirement: Ranked candidate identification
The identification SHALL return between zero and three candidate library-food ids, ranked with a confidence value: exactly one candidate when the model is confident, two or three when it is torn between plausible library foods, and none when no library food plausibly matches. Every returned id MUST be one of the ids submitted in the request; ids that are not MUST be discarded by server-side revalidation.

#### Scenario: Confident single match
- **WHEN** the photo clearly shows one library food
- **THEN** exactly one candidate id is returned

#### Scenario: Torn between similar foods
- **WHEN** the photo could plausibly be two or three different library foods (e.g. two visually similar chicken dishes)
- **THEN** those candidates are returned ranked by confidence

#### Scenario: Food not in the library
- **WHEN** the photographed food matches nothing in the submitted list
- **THEN** an empty candidate list is returned rather than a forced match

#### Scenario: Fabricated id discarded
- **WHEN** the model returns an id that was not in the request's food list
- **THEN** the server drops that candidate before responding

### Requirement: Optional weight from the photo
The identification response MAY include a weight amount in grams tagged with its source. When a scale display is visible and clearly legible, the amount SHALL be read verbatim from the display (converted to grams when the display shows another unit) with source `scale`, trusting the displayed value as the net weight. When no legible scale display is present, an amount with source `estimate` MAY be returned only when the visible portion can be judged against the matched food's known per-serving weight. When neither applies — including an unreadable or ambiguous display — the response MUST omit the amount rather than guess.

#### Scenario: Legible scale display
- **WHEN** the photo shows the food on a scale displaying "142 g"
- **THEN** the response includes 142 grams with source `scale`

#### Scenario: Display in other units
- **WHEN** the scale display legibly reads "5.0 oz"
- **THEN** the response includes the gram equivalent with source `scale`

#### Scenario: Unreadable display
- **WHEN** the scale display is blurred, glared, or ambiguous
- **THEN** the response includes no amount

#### Scenario: Visual estimate against a known serving weight
- **WHEN** no scale display is legible but the matched food has a known per-serving weight and the visible portion can be judged against it
- **THEN** the response includes an approximate gram amount with source `estimate`

### Requirement: Confident match fills the form in place
When exactly one candidate is returned, the system SHALL fill the open entry form from that library food exactly as if the user had selected it from the name combobox: name, per-serving nutrition, link to the library food, and unit options derived from its serving anchor. When the response includes a weight amount and the food's serving anchor offers grams as a logging unit, the form's amount and unit SHALL be prefilled with that amount in grams; otherwise the amount SHALL default to 1 of the food's serving label. An `estimate`-sourced weight SHALL be visibly labeled as an AI-estimated weight. All prefilled values MUST remain editable before saving. Identification and prefilling MUST NOT themselves modify the library food; once filled, the form behaves exactly as if the food had been picked from the combobox, including the "Edit nutrition" library-update semantics defined by the food-logging capability.

#### Scenario: Match with scale weight
- **WHEN** identification returns one candidate anchored at "1 serving = 100 g" and 142 grams from the scale
- **THEN** the form is filled with that food's name and nutrition, amount 142, unit g, and the live computed-nutrition preview reflects 1.42 servings

#### Scenario: Matched food has no weight equivalence
- **WHEN** identification returns one candidate whose anchor has no weight equivalence, plus a gram amount
- **THEN** the form is filled with that food and amount 1 of its serving label, ignoring the gram amount

#### Scenario: Estimated weight is labeled
- **WHEN** the prefilled amount came from source `estimate`
- **THEN** the user sees it labeled as an AI-estimated weight before saving

#### Scenario: Prefill does not touch the library
- **WHEN** the user adjusts the prefilled amount and unit (without opening "Edit nutrition") and saves the entry
- **THEN** the entry stores the adjusted values and the matched library food's nutrition and serving anchor are unchanged

### Requirement: Candidate chooser on uncertainty
When two or three candidates are returned, the system SHALL present them ranked, each showing at least the food's name and, where present, its description, and require the user to pick one before anything is filled. Picking a candidate SHALL fill the form identically to a confident match (including any weight amount). Dismissing the chooser MUST leave the entry form as it was.

#### Scenario: User picks a candidate
- **WHEN** three candidates are shown and the user picks the second
- **THEN** the form is filled from that library food, with any returned weight applied per the confident-match rules

#### Scenario: User dismisses the chooser
- **WHEN** the user dismisses the chooser without picking
- **THEN** no fields change and the entry form is as they left it

### Requirement: No-match fallback to AI estimate
When no candidates are returned, the system SHALL tell the user the food was not recognized in their library and offer to hand the same photo to the ai-food-analysis estimate flow, entering that flow at its pre-send review step with the photo (and any context note) carried over. Declining the offer MUST return to the entry form unchanged.

#### Scenario: Fallback offered
- **WHEN** identification returns no candidates
- **THEN** the user sees a message that the food isn't in their library and an action to get an AI estimate for the same photo instead

#### Scenario: Fallback declined
- **WHEN** the user declines the estimate offer
- **THEN** they return to the entry form with its prior state intact

### Requirement: Identification failure handling
When an identification request fails (network error, provider error, or malformed response), the system SHALL show a non-blocking error message with a retry action for the same photo and note, and cancelling MUST return to the entry form with its prior state intact.

#### Scenario: Request fails
- **WHEN** the identification request fails
- **THEN** an error message with a retry action is shown, and the form remains untouched behind it
