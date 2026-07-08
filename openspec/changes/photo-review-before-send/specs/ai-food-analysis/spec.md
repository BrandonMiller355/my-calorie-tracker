## ADDED Requirements

### Requirement: Pre-send photo review
The system SHALL present the captured photo for review before any analysis request is sent. The review step SHALL show the frozen captured frame (with the camera stream stopped) and offer: a retake action that discards the frame and reopens the camera, an optional free-text context note about the meal (e.g. "I didn't eat the ranch"), an explicit send action that starts analysis, and a cancel action. Analysis MUST NOT begin before the send action is activated. A non-empty context note SHALL be included in the analysis conversation from the first request onward, exactly as if it were the earliest user correction, and SHALL be treated with the same ephemerality as the rest of the conversation.

#### Scenario: User retakes the photo
- **WHEN** the user activates the retake action on the review step
- **THEN** the captured frame is discarded, the camera view reopens for a new capture, and any context note already typed is preserved

#### Scenario: User sends with a context note
- **WHEN** the user types a context note and activates send
- **THEN** a single analysis request is sent carrying the photo with the note as the first correction, and later refinement corrections are applied after the note

#### Scenario: User sends without a note
- **WHEN** the user activates send with the note field empty or whitespace
- **THEN** the analysis request is sent with no corrections, matching prior first-analysis behavior

#### Scenario: User cancels from the review step
- **WHEN** the user cancels on the review step
- **THEN** no analysis request is sent, the photo and note are discarded, and the user returns to the search screen with its prior state intact

## MODIFIED Requirements

### Requirement: Single-shot photo capture
The system SHALL, when the AI analyze action is activated, open a camera view using the rear-facing camera with a shutter action that captures a single frame as a JPEG whose long edge does not exceed 1024 pixels. The camera stream MUST be stopped when a photo is captured, the user cancels, or the user navigates away. Capturing a photo SHALL lead to the pre-send review step, not directly to analysis.

#### Scenario: User captures a photo
- **WHEN** the user activates the shutter action
- **THEN** the current camera frame is captured as a downscaled JPEG, the camera stream is stopped, and the pre-send review step is shown

#### Scenario: User cancels without capturing
- **WHEN** the user dismisses the camera view without capturing
- **THEN** the camera stream is stopped and the user returns to the search screen with its prior state intact

#### Scenario: Camera access denied or unavailable
- **WHEN** the user denies camera access or no camera is available
- **THEN** the system shows a non-blocking message and offers text search and manual entry as fallbacks
