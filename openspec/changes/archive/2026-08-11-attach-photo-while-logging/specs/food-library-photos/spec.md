## ADDED Requirements

### Requirement: Attach a photo while logging a new food
The entry form SHALL offer attach, replace, and remove photo actions while it is defining a brand-new food — that is, while the form is not editing an existing entry, is not a quick calories-only entry, and its name does not match a library food. The actions SHALL obtain the image through the app's existing photo-source selection (camera capture or file selection) and downscale it through the shared pipeline, presented the same way as on the add-food form. The chosen photo SHALL be held only in the form until the entry is saved and the food is captured by the library's auto-capture behavior, and then attached to that captured food. Nothing SHALL be stored before the entry is saved.

When the form stops defining a new food — the user selects a library food, the name comes to match an existing food, or the form switches to a quick calories-only entry — the actions SHALL be withdrawn and any held photo discarded, since there is no new food left to attach it to. An entry that links to an existing library food SHALL attach nothing, leaving that food's photo (or absence of one) untouched.

Attaching SHALL be non-blocking per this capability's upload requirement: the entry is logged and the food captured first, and a failed or in-flight upload MUST NOT delay the save, prevent the entry from being logged, or discard the captured food.

#### Scenario: Photo attached to a food captured from logging
- **WHEN** the user types a name the library does not know, chooses a photo in the entry form, and saves the entry
- **THEN** the entry is logged, a library food is captured for that name, and the photo is uploaded to that food's private image path so the food thereafter shows it

#### Scenario: No photo action for a matched food
- **WHEN** the form's name matches an existing library food, whether selected from the dropdown or typed
- **THEN** no attach action is offered in the entry form and that food's existing photo is left untouched

#### Scenario: Held photo dropped when the form stops defining a new food
- **WHEN** the user chooses a photo while defining a new food and then selects an existing library food from the dropdown
- **THEN** the held photo is discarded, nothing is uploaded, and the selected food's photo is unchanged

#### Scenario: Photo discarded with an abandoned entry
- **WHEN** the user chooses a photo in the entry form and then removes it, or closes the form without saving
- **THEN** nothing is uploaded and no image is stored

#### Scenario: No photo action when editing an entry or logging calories only
- **WHEN** the user opens the form to edit an existing entry, or switches it to a quick calories-only entry
- **THEN** no photo action is offered, because neither captures a new library food

#### Scenario: Logging is never held up by the upload
- **WHEN** the user saves an entry that carries a photo for a newly captured food
- **THEN** the entry and the captured food are saved immediately and the image upload proceeds without holding up the save

#### Scenario: Upload failure leaves the entry and food intact
- **WHEN** the image upload for a food captured from logging fails
- **THEN** the entry stays logged and the captured food keeps all of its non-image values, simply with no photo

#### Scenario: Nothing to attach when capture is skipped
- **WHEN** the entry is saved but the library food is not captured (auto-capture failed, per the food-library capability)
- **THEN** the entry is still logged and no image is uploaded, because there is no food to attach it to
