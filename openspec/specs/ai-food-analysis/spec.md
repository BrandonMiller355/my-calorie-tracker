# ai-food-analysis Specification

## Purpose
Log dishes that have no barcode (home-cooked meals, restaurant plates) by photographing them: a server-proxied AI vision model estimates the dish name, calories, and macros; the user can refine the estimate through corrections and accept it into the standard add-entry prefill flow.

## Requirements

### Requirement: AI analyze entry point on the search screen
The search screen SHALL offer an "AI analyze" action, alongside the barcode scan action. The action SHALL be shown unconditionally: photo selection from the device's file picker is always available, independent of camera support, so the action is never hidden.

#### Scenario: Action shown regardless of camera support
- **WHEN** the user opens the search screen, whether or not the browser exposes `navigator.mediaDevices.getUserMedia`
- **THEN** an AI analyze action is visible alongside the text search input

### Requirement: Single-shot photo capture
The system SHALL, when the AI analyze action is activated and camera capture is available, open a camera view using the rear-facing camera with a shutter action that captures a single frame as a JPEG whose long edge does not exceed 1024 pixels. The camera view SHALL also offer a "choose from library" action (see the photo selection requirement) as an alternative to the shutter. The camera stream MUST be stopped when a photo is captured, a library photo is chosen instead, the user cancels, or the user navigates away. Capturing a photo SHALL lead to the pre-send review step, not directly to analysis.

#### Scenario: User captures a photo
- **WHEN** the user activates the shutter action
- **THEN** the current camera frame is captured as a downscaled JPEG, the camera stream is stopped, and the pre-send review step is shown

#### Scenario: User cancels without capturing
- **WHEN** the user dismisses the camera view without capturing
- **THEN** the camera stream is stopped and the user returns to the search screen with its prior state intact

#### Scenario: Camera access denied or unavailable
- **WHEN** the user denies camera access or no camera is available
- **THEN** the system shows a non-blocking message and offers photo selection from the device library as the primary way to proceed, alongside text search and manual entry as fallbacks

### Requirement: Photo selection from device library
The system SHALL offer a "choose from library" action that opens the device's native file picker restricted to images. A selected image SHALL be downscaled and re-encoded as a JPEG whose long edge does not exceed 1024 pixels, using the same output constraints as a camera capture, before entering the pre-send review step. This action SHALL be available whenever the AI analyze flow is open, whether or not camera capture is available; when camera capture is unavailable, it is the sole way to provide a photo.

#### Scenario: User chooses a photo from their library
- **WHEN** the user activates "choose from library" and selects an image file
- **THEN** the image is downscaled to the same size/quality constraints as a camera capture and the pre-send review step is shown with that image

#### Scenario: User cancels the file picker
- **WHEN** the user dismisses the native file picker without choosing a file
- **THEN** no photo is captured and photo source selection remains shown

#### Scenario: Selected file can't be used as a photo
- **WHEN** the chosen file is not a decodable image (corrupt, unsupported format, or similar)
- **THEN** the system shows a non-blocking message and lets the user choose a different file

### Requirement: Pre-send photo review
The system SHALL present the chosen or captured photo for review before any analysis request is sent. The review step SHALL show the frozen photo (with the camera stream, if any, stopped) and offer: a retake action that discards the photo and returns to photo source selection (camera view and/or library picker, whichever are available), an optional free-text context note about the meal (e.g. "I didn't eat the ranch"), an explicit send action that starts analysis, and a cancel action. Analysis MUST NOT begin before the send action is activated. A non-empty context note SHALL be included in the analysis conversation from the first request onward, exactly as if it were the earliest user correction, and SHALL be treated with the same ephemerality as the rest of the conversation.

#### Scenario: User retakes or re-chooses the photo
- **WHEN** the user activates the retake action on the review step
- **THEN** the photo is discarded, photo source selection reopens for a new capture or file choice, and any context note already typed is preserved

#### Scenario: User sends with a context note
- **WHEN** the user types a context note and activates send
- **THEN** a single analysis request is sent carrying the photo with the note as the first correction, and later refinement corrections are applied after the note

#### Scenario: User sends without a note
- **WHEN** the user activates send with the note field empty or whitespace
- **THEN** the analysis request is sent with no corrections, matching prior first-analysis behavior

#### Scenario: User cancels from the review step
- **WHEN** the user cancels on the review step
- **THEN** no analysis request is sent, the photo and note are discarded, and the user returns to the search screen with its prior state intact

### Requirement: Analysis startable from an already-captured photo
The analyze flow SHALL be startable with a photo supplied by its host (e.g. the no-match handoff from the ai-food-identify capability) instead of opening a capture view. When started with a supplied photo, the flow SHALL enter at the pre-send photo review step with that photo as the frozen frame and any host-supplied context note prefilled, and all review behaviors (retake, note editing, send, cancel) SHALL work as they do for a freshly captured photo.

#### Scenario: Handoff enters at pre-send review
- **WHEN** the identify flow hands its photo and note to the analyze flow
- **THEN** the analyze flow opens at the pre-send review showing that photo with the note prefilled, without a capture step

#### Scenario: Retake still available after handoff
- **WHEN** the user activates retake on a review reached via a supplied photo
- **THEN** the supplied frame is discarded and the normal photo-source selection opens for a new photo

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
