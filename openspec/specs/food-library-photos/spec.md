# food-library-photos Specification

## Purpose
Give each library food an optional photo so the library is recognizable at a glance: store one downscaled JPEG per food in a private Supabase Storage bucket, let the user attach/replace/remove it from the food editor, and display it via short-lived signed URLs. Photos are purely additive and never required to create, edit, log, or match a food.
## Requirements
### Requirement: Optional photo per library food
Each library food MAY have at most one associated photo. The photo SHALL be stored as a downscaled JPEG produced by the same pipeline as the app's other photo flows (long edge not exceeding 1024 pixels), held in a private Supabase Storage bucket, and referenced from the food's row by a stored path. A food without a photo SHALL behave exactly as it does today; the photo is purely additive and never required to create, edit, log, or match a food.

#### Scenario: Food with no photo is unaffected
- **WHEN** a food that has never had a photo is created, edited, logged, or shown in the library
- **THEN** every existing behavior is unchanged and no image is fetched or displayed for it

#### Scenario: Photo stored as a downscaled JPEG
- **WHEN** a photo is attached to a food
- **THEN** it is stored as a JPEG whose long edge does not exceed 1024 pixels in the private food-image bucket, and the food's row records the stored image path

#### Scenario: At most one photo per food
- **WHEN** a food that already has a photo receives a new one
- **THEN** the new photo replaces the old one and the food still references exactly one image

### Requirement: Per-user isolation of food images
Food images SHALL be readable and writable only by the user who owns the food, enforced by storage access policies keyed to the user, mirroring the row-level isolation already applied to the `foods` table. A user MUST NOT be able to read, overwrite, or delete another user's food images.

#### Scenario: Owner reads their own image
- **WHEN** a signed-in user requests the image for one of their foods
- **THEN** access is granted and the image is retrievable

#### Scenario: Non-owner is denied
- **WHEN** a request targets a food image owned by a different user
- **THEN** access is denied and the image is not retrievable

### Requirement: Attach, replace, and remove a photo from the food editor
The food form SHALL let the user attach a photo to the food, replace an existing photo, and remove the photo. Attaching or replacing SHALL obtain the image through the app's existing photo-source selection (camera capture or file selection) and downscale it through the shared pipeline before upload. Removing SHALL clear both the stored image and the food's reference to it. These actions SHALL be available both when editing an existing library food and when adding a new one, presented identically in the two forms. A photo chosen while adding a food SHALL be held until the food is saved and then attached to it; abandoning the add SHALL leave nothing stored.

#### Scenario: Attach a photo while adding a food
- **WHEN** the user chooses an image on the add-food form and saves the new food
- **THEN** the food is created first and the image is then uploaded to its private image path, so the new food shows that photo

#### Scenario: Photo discarded with an abandoned add
- **WHEN** the user chooses an image on the add-food form and then removes it, or cancels the form
- **THEN** nothing is uploaded and no image is stored

#### Scenario: Attach a photo to a food without one
- **WHEN** the user edits a food that has no photo, chooses an image, and saves
- **THEN** the image is downscaled, uploaded to the food's private image path, and the food thereafter shows that photo

#### Scenario: Replace an existing photo
- **WHEN** the user edits a food that already has a photo and chooses a different image
- **THEN** the new image replaces the stored one and the food shows the new photo

#### Scenario: Remove a photo
- **WHEN** the user removes the photo from a food that has one
- **THEN** the stored image is deleted, the food's image reference is cleared, and the food renders as a food with no photo

### Requirement: Image upload never blocks the primary action
Uploading, replacing, or removing a food image SHALL be non-blocking: saving a food, logging an entry, or completing an AI-match flow MUST NOT be delayed or prevented by image transfer, and MUST succeed even if the image transfer is still in flight or ultimately fails. A failed image transfer SHALL surface quietly (a non-blocking indication) without discarding or reverting the user's primary action, and MUST NOT corrupt the food's non-image data.

#### Scenario: Save completes regardless of upload
- **WHEN** the user saves a food edit that includes a new photo
- **THEN** the food's textual and nutrition changes are saved immediately and the image upload proceeds without holding up the save

#### Scenario: Upload failure does not lose the food edit
- **WHEN** the image upload for a saved food fails
- **THEN** the food's saved non-image changes are retained, a non-blocking indication of the image problem is shown, and the food simply has no (or its prior) image

### Requirement: Display food photos via signed URLs
When a food has a photo, the library SHALL display it as a small thumbnail, retrieving it through a short-lived signed URL rather than a public URL. Images SHALL be fetched lazily so that loading the library list does not require downloading every food's image up front, and a food whose image is still loading or fails to load SHALL fall back to the food's normal text-only presentation without breaking the list.

#### Scenario: Thumbnail shown in the library
- **WHEN** the library renders a food that has a photo
- **THEN** its thumbnail is shown, sourced from a short-lived signed URL for that food's private image

#### Scenario: List load stays lean
- **WHEN** the food library list is loaded
- **THEN** food images are fetched lazily rather than all up front, so the list's initial load does not depend on downloading every image

#### Scenario: Missing or failed image degrades gracefully
- **WHEN** a food's image cannot be retrieved
- **THEN** the food is shown in its normal text-only form and the rest of the list is unaffected

### Requirement: Attach a photo while logging
The entry form SHALL offer attach, replace, and remove photo actions in two states: while it is defining a brand-new food — not editing an existing entry, not a quick calories-only entry, and its name does not match a library food — and while a matched library food's own fields are revealed for editing (the "Edit nutrition" state of the food-logging capability, which writes those fields back to that food). The actions SHALL obtain the image through the app's existing photo-source selection (camera capture or file selection) and downscale it through the shared pipeline, presented the same way as on the add-food form. A quick calories-only entry SHALL never offer them, and neither SHALL an entry with no library food behind it.

For a brand-new food the chosen photo SHALL be held only in the form until the entry is saved and the food is captured by the library's auto-capture behavior, and then attached to that captured food; nothing SHALL be stored before the entry is saved. For a matched food the photo belongs to a food that already exists, so attaching, replacing, or removing SHALL take effect on that food immediately and independently of whether the entry is saved — the same behavior as editing its photo on the Food Library screen.

When the form stops defining a new food — the user selects a library food, the name comes to match an existing food, or the form switches to a quick calories-only entry — any held photo SHALL be discarded, since there is no new food left to attach it to, and the matched food's own photo SHALL be left untouched unless the user then acts on it deliberately.

Attaching SHALL be non-blocking per this capability's upload requirement: the entry is logged and the food captured first, and a failed or in-flight upload MUST NOT delay the save, prevent the entry from being logged, or discard the captured food.

#### Scenario: Photo attached to a food captured from logging
- **WHEN** the user types a name the library does not know, chooses a photo in the entry form, and saves the entry
- **THEN** the entry is logged, a library food is captured for that name, and the photo is uploaded to that food's private image path so the food thereafter shows it

#### Scenario: Matched food's photo is editable alongside its other fields
- **WHEN** the form's name matches an existing library food, whether selected from the dropdown or typed, and that food's fields are revealed for editing
- **THEN** its photo is offered for attaching, replacing, or removing beside the name, and the chosen change is applied to that library food straight away, whether or not the entry is then saved

#### Scenario: Matched food's photo is look-only until its fields are revealed
- **WHEN** the form's name matches an existing library food whose fields are still collapsed behind "Edit nutrition"
- **THEN** that food's photo is shown as a thumbnail with no attach, replace, or remove action

#### Scenario: Held photo dropped when the form stops defining a new food
- **WHEN** the user chooses a photo while defining a new food and then selects an existing library food from the dropdown
- **THEN** the held photo is discarded, nothing is uploaded, and the selected food's photo is unchanged

#### Scenario: Photo discarded with an abandoned entry
- **WHEN** the user chooses a photo in the entry form and then removes it, or closes the form without saving
- **THEN** nothing is uploaded and no image is stored

#### Scenario: No photo action for calories only or an entry with no library food
- **WHEN** the user switches the form to a quick calories-only entry, or reveals the nutrition of an entry that links to no library food
- **THEN** no photo action is offered, because there is no food for a photo to belong to

#### Scenario: Logging is never held up by the upload
- **WHEN** the user saves an entry that carries a photo for a newly captured food
- **THEN** the entry and the captured food are saved immediately and the image upload proceeds without holding up the save

#### Scenario: Upload failure leaves the entry and food intact
- **WHEN** the image upload for a food captured from logging fails
- **THEN** the entry stays logged and the captured food keeps all of its non-image values, simply with no photo

#### Scenario: Nothing to attach when capture is skipped
- **WHEN** the entry is saved but the library food is not captured (auto-capture failed, per the food-library capability)
- **THEN** the entry is still logged and no image is uploaded, because there is no food to attach it to

