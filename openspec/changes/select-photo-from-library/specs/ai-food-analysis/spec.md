## MODIFIED Requirements

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

## ADDED Requirements

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
