# app-navigation Specification

## Purpose
TBD - created by archiving change android-back-navigation. Update Purpose after archive.
## Requirements
### Requirement: Back dismisses the topmost open layer
The system SHALL treat the platform back signal (the Android hardware back button, or the browser's back control) as a request to dismiss the topmost dismissible layer currently on screen, rather than as a history navigation. Dismissible layers include modal forms, bottom sheets, camera and AI overlays, the confirm-photo step, the barcode scanner, the full-screen image view, and the food-name suggestion list once the user has opened it deliberately. A surface that appears without being asked for — notably the suggestion list that opens when the entry form focuses its name field for the user — SHALL NOT consume a back press, so leaving a screen never costs an extra press for something the user did not open. Dismissing SHALL be identical in effect to that layer's existing cancel path, including any cleanup that path performs, and SHALL leave the screen behind it untouched — same tab, same selected day, same in-progress state. When layers are nested, back SHALL dismiss them one at a time from the top down. A layer that runs in internal phases MAY consume the back signal by stepping back one phase instead of closing.

#### Scenario: Full-screen image returns to the screen behind it
- **WHEN** the user opens a logged entry's photo full-screen from the day log and presses back
- **THEN** the photo closes and the day log is shown as it was, and the app is not exited

#### Scenario: Back cancels an in-progress entry
- **WHEN** the user has the entry form open, partly filled in, and presses back
- **THEN** the form closes and discards its input exactly as its Cancel action does, without a confirmation prompt, and the day log is shown

#### Scenario: Nested layers unwind one at a time
- **WHEN** the user has the entry form open with the identify-from-photo overlay above it and presses back
- **THEN** the identify overlay closes, the entry form remains open with its input intact, and a further back press closes the form

#### Scenario: A phased overlay steps back within itself
- **WHEN** the user is on the review step of an overlay that captured input in an earlier step and presses back
- **THEN** the overlay returns to its earlier step rather than closing, and its captured input is retained

#### Scenario: A suggestion list the user opened is dismissed first
- **WHEN** the user types into the entry form's name field, bringing up its suggestion list, and presses back
- **THEN** the list closes, the form stays open with the typed text intact, and a further back press closes the form

#### Scenario: A self-opening suggestion list costs no press
- **WHEN** the user opens the entry form, whose name field takes focus and shows its suggestion list without being asked, and presses back
- **THEN** the form closes in that single press

#### Scenario: Dismissal does not disturb the screen behind
- **WHEN** the user opens a layer from a screen other than the day log and presses back
- **THEN** the layer closes and the user remains on that same screen, which is not remounted or reset

### Requirement: Back returns to the Log tab
With no layer open, the system SHALL treat back as a request to return to the Log tab — the app's start destination — from any other tab, in a single press. Back SHALL NOT retrace the sequence of tabs the user visited. Tab switching SHALL NOT accumulate browser history entries.

#### Scenario: Back from another tab goes to the log
- **WHEN** the user is on the Foods, Search, or Settings tab with no layer open and presses back
- **THEN** the Log tab is shown and the app is not exited

#### Scenario: Visited tabs are not retraced
- **WHEN** the user moves through several tabs and then presses back
- **THEN** the Log tab is shown directly, rather than the previously visited tab

### Requirement: Back returns to today
With no layer open and the Log tab showing a day other than today, the system SHALL treat back as a request to return to today, in a single press regardless of how many days the user moved — the same effect as the day navigator's "Today" action. This step SHALL resolve after any open layer is dismissed and only while the Log tab is showing.

#### Scenario: Back returns from a past day
- **WHEN** the user has paged the day log back several days and presses back
- **THEN** the log shows today in one press, and the app is not exited

#### Scenario: Layers take precedence over the date
- **WHEN** the user is viewing a past day with the entry form open and presses back
- **THEN** the form closes and the past day is still shown, and a further back press returns to today

### Requirement: Two-press exit with a toast hint
With nothing left to unwind — no layer open, the Log tab showing, and the selected day being today — the system SHALL NOT exit on the first back press. It SHALL instead show a transient toast reading "Press back again to exit the application" and arm an exit window of approximately two seconds. A back press within that window SHALL leave the app. If the window lapses without a second press, the system SHALL disarm and the next back press SHALL again show the hint rather than exiting.

#### Scenario: First press warns instead of exiting
- **WHEN** the user is on the Log tab showing today with no layer open and presses back
- **THEN** a toast reading "Press back again to exit the application" is shown and the app is still running

#### Scenario: Second press exits
- **WHEN** the user presses back again while the hint is showing
- **THEN** the app is exited

#### Scenario: The guard re-arms after the window lapses
- **WHEN** the user presses back, waits for the hint to disappear, and presses back again
- **THEN** the hint is shown again and the app is not exited

#### Scenario: Unwinding takes precedence over exiting
- **WHEN** the user presses back while any layer is open, another tab is showing, or a day other than today is selected
- **THEN** that step is taken instead, and no exit hint is shown

### Requirement: Escape dismisses the topmost layer
On devices with a keyboard, the system SHALL resolve the Escape key against the same topmost-layer dismissal as the back signal, so that every dismissible layer closes on Escape. Escape SHALL stop once no layer is open: it MUST NOT change tab, change the selected day, or arm the exit guard.

#### Scenario: Escape closes the topmost layer
- **WHEN** the user presses Escape with one or more layers open
- **THEN** the topmost layer is dismissed, exactly as back would dismiss it

#### Scenario: Escape with nothing open does nothing
- **WHEN** the user presses Escape with no layer open
- **THEN** nothing happens: the tab, the selected day, and the exit guard are all unchanged

### Requirement: Transient toast messages
The system SHALL provide a transient message surface that announces short, non-blocking messages and dismisses itself after a few seconds. A message SHALL be positioned so it does not obscure the bottom tab bar, SHALL be announced politely to assistive technology, and MUST NOT require or accept interaction to dismiss.

#### Scenario: Message appears and self-dismisses
- **WHEN** a transient message is shown
- **THEN** it appears above the bottom tab bar, is announced politely to assistive technology, and disappears on its own without any user action

