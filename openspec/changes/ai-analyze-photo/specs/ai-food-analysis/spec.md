## ADDED Requirements

### Requirement: AI analyze entry point on the search screen
The search screen SHALL offer an "AI analyze" action, alongside the barcode scan action, only when the browser exposes `navigator.mediaDevices.getUserMedia`. When camera capture is unavailable, the action MUST NOT be rendered and all other search behavior SHALL be unchanged.

#### Scenario: Action shown when camera capture is available
- **WHEN** the user opens the search screen in a browser with `navigator.mediaDevices.getUserMedia`
- **THEN** an AI analyze action is visible alongside the text search input

#### Scenario: Action hidden when camera capture is unavailable
- **WHEN** the user opens the search screen in a browser without `navigator.mediaDevices.getUserMedia`
- **THEN** no AI analyze action is shown and text search works as before

### Requirement: Single-shot photo capture
The system SHALL, when the AI analyze action is activated, open a camera view using the rear-facing camera with a shutter action that captures a single frame as a JPEG whose long edge does not exceed 1024 pixels. The camera stream MUST be stopped when a photo is captured, the user cancels, or the user navigates away.

#### Scenario: User captures a photo
- **WHEN** the user activates the shutter action
- **THEN** the current camera frame is captured as a downscaled JPEG, the camera stream is stopped, and analysis begins

#### Scenario: User cancels without capturing
- **WHEN** the user dismisses the camera view without capturing
- **THEN** the camera stream is stopped and the user returns to the search screen with its prior state intact

#### Scenario: Camera access denied or unavailable
- **WHEN** the user denies camera access or no camera is available
- **THEN** the system shows a non-blocking message and offers text search and manual entry as fallbacks

### Requirement: Server-proxied analysis with a protected API key
The system SHALL analyze captured photos through a Supabase Edge Function that holds the AI provider's API key (Gemini) as a server-side secret and rejects requests that do not carry a valid Supabase session JWT. The provider API key MUST NOT be included in the client bundle or transmitted to the browser.

#### Scenario: Authenticated user requests analysis
- **WHEN** a signed-in user submits a captured photo for analysis
- **THEN** the Edge Function calls the Gemini API with the server-held key and returns the analysis result to the client

#### Scenario: Unauthenticated request rejected
- **WHEN** a request without a valid Supabase JWT reaches the Edge Function
- **THEN** the request is rejected without calling the Gemini API

### Requirement: Structured food estimate
The analysis SHALL return a structured estimate containing a dish name, calories, fat, carbs, and protein for the photographed portion, plus a one-line confidence note describing the model's key assumption. All nutrient values MUST be numbers (never absent).

#### Scenario: Estimate returned for a dish photo
- **WHEN** a photo of a dish is analyzed successfully
- **THEN** the client receives a name, numeric calories/fat/carbs/protein for the photographed portion, and a confidence note

#### Scenario: Analysis fails
- **WHEN** the analysis request fails (network error, provider error, or malformed response)
- **THEN** the system shows a non-blocking error message with a retry action for the same photo and offers manual entry as a fallback

### Requirement: Estimate review before acceptance
The system SHALL present the estimate for review before it can be used: the captured photo, the estimated name and nutrition explicitly labeled as an AI estimate, and the confidence note. The estimate MUST NOT enter the add-entry flow without an explicit user acceptance action.

#### Scenario: Estimate presented for review
- **WHEN** analysis completes
- **THEN** the user sees the photo, the estimate labeled as an AI estimate, the confidence note, an option to refine, and an option to accept

#### Scenario: User dismisses the review
- **WHEN** the user closes the review without accepting
- **THEN** no entry is created and the search screen's prior state is intact

### Requirement: Multi-turn estimate refinement
The system SHALL let the user send free-text corrections about the current photo and receive a revised estimate that replaces the displayed one. The conversation (photo, corrections, estimates) SHALL be held only in client memory for the life of the review and MUST NOT be persisted to Supabase or any other store.

#### Scenario: User refines the estimate
- **WHEN** the user submits a correction such as "there's rice under it too"
- **THEN** a revised estimate for the same photo, accounting for all corrections so far, replaces the displayed estimate

#### Scenario: Refinement request fails
- **WHEN** a refinement request fails
- **THEN** the previous estimate remains displayed with a non-blocking error message and a retry action for the same correction

#### Scenario: Conversation is ephemeral
- **WHEN** the user closes the review (by accepting, cancelling, or navigating away)
- **THEN** the photo, corrections, and estimates are discarded and nothing about them is persisted

### Requirement: Accepted estimate enters the existing prefill flow
The system SHALL, on acceptance, hand the estimate to the existing result-selection flow as a search result whose serving is one "serving" (the photographed portion, with no weight equivalence), opening the add-entry form pre-filled with the estimated name and nutrition and preserving any in-progress form context (such as the selected meal). The saved entry SHALL use the same source classification as other prefilled results.

#### Scenario: User accepts an estimate
- **WHEN** the user accepts the displayed estimate
- **THEN** the add-entry form opens pre-filled with the estimate's name and nutrition, per one serving, with any in-progress meal context preserved

#### Scenario: Accepted values remain editable
- **WHEN** the pre-filled form opens after acceptance
- **THEN** the user can edit any value before saving, as with any other prefilled result
