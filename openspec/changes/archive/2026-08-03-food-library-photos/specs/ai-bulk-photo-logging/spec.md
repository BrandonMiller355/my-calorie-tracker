## ADDED Requirements

### Requirement: Auto-attach a reviewed photo when its matched food is logged
When a reviewed row is logged against its matched library food and that food has no photo yet, the system SHALL attach that row's photo to the food as its image, using the photo already held for the row (no re-capture). Auto-attach MUST NOT overwrite an image the food already has, and MUST be applied per row from that row's own photo and picked food. It SHALL be non-blocking per the food-library-photos capability: it MUST NOT delay or block bulk logging, and a failed attach MUST NOT affect the logged entries. Rows that are not logged — unrecognized rows and rows the user removed — SHALL attach nothing.

#### Scenario: Logged row attaches its photo to an image-less food
- **WHEN** a reviewed row matched to a food with no photo is logged
- **THEN** that row's photo is attached to that food as its image, without holding up the bulk log

#### Scenario: Each logged row attaches its own photo
- **WHEN** two rows in a batch are logged against two different image-less foods
- **THEN** each food receives its own row's photo as its image

#### Scenario: Row matched to a food that already has a photo
- **WHEN** a logged row's food already has a photo
- **THEN** its existing photo is preserved and the row's photo is not stored

#### Scenario: Unrecognized and removed rows attach nothing
- **WHEN** a batch contains an unrecognized row and a row the user removed before logging
- **THEN** neither contributes an image to any food

## MODIFIED Requirements

### Requirement: Batch state is ephemeral
The photos, chaining notes, identification results, and review rows SHALL be held only in client memory for the life of the overlay and MUST NOT be persisted to Supabase or any other store, except that when a reviewed row is logged against a matched library food with no existing image, that row's photo MAY be uploaded to the user's own food-image storage as that food's image per the auto-attach behavior. Closing the overlay (by logging all rows, cancelling, or navigating away) SHALL discard the photos, notes, results, and rows from memory; nothing about the batch other than an auto-attached matched-food image is stored anywhere.

#### Scenario: Cancel discards everything
- **WHEN** the user cancels the overlay after identification has produced rows
- **THEN** no entries are created, no images are attached, nothing about the batch is stored anywhere, and the entry form is as they left it

#### Scenario: Only matched-food images survive logging
- **WHEN** the user logs the batch and some rows matched image-less foods
- **THEN** the only batch data that persists is each such food's newly attached image; the photos, notes, results, and rows are otherwise discarded from memory
