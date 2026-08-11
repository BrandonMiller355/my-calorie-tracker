## MODIFIED Requirements

### Requirement: Server-proxied identification with a protected API key
The system SHALL identify photos through a dedicated `identify-food` Supabase Edge Function that holds the AI provider's API key (Gemini) as a server-side secret and rejects requests without a valid Supabase session JWT. Each request SHALL carry the photo, the optional context note, and the user's non-archived library foods (id, name, optional description, and serving-weight information); archived foods MUST NOT be sent or matched. The function MUST be stateless: the photo, note, library payload, and result MUST NOT be persisted server-side, and the client SHALL discard the note, the library payload, and the candidates when the identify flow closes. The photo is likewise discarded, except that it MAY be uploaded to the user's own food-image storage as a library food's image in exactly two cases: when the flow resolves to a matched library food with no existing image, per the food-library-photos auto-attach behavior; or when the flow's no-match handoff leads to a new food being captured from logging, per the food-library-photos capability's attach-while-logging behavior. No note, candidate, or library payload is ever persisted.

#### Scenario: Authenticated user requests identification
- **WHEN** a signed-in user sends a photo for identification
- **THEN** the Edge Function calls the Gemini API with the server-held key and returns the identification result

#### Scenario: Unauthenticated request rejected
- **WHEN** a request without a valid Supabase JWT reaches the Edge Function
- **THEN** the request is rejected without calling the Gemini API

#### Scenario: Archived foods excluded
- **WHEN** the user's library contains archived foods
- **THEN** those foods are not included in the request and can never be returned as candidates

#### Scenario: Nothing persisted server-side
- **WHEN** the identify flow closes (by filling the form, cancelling, or navigating away)
- **THEN** the Edge Function has stored nothing, and the client discards the note, library payload, and candidates

#### Scenario: Only a matched food's own image may persist client-side
- **WHEN** the flow resolves to a matched library food that has no image
- **THEN** the only thing that may be stored is that photo, uploaded to the user's own food-image storage as that food's image; the note, candidates, and library payload are still discarded

#### Scenario: A no-match photo may persist only through a captured food
- **WHEN** the flow returns no candidates, the user takes the estimate handoff, and saving the entry captures a new library food
- **THEN** the only thing that may be stored is that photo, as the captured food's image; the note, candidates, and library payload are still discarded

### Requirement: Auto-attach the identify photo on a confirmed match
When the identify flow resolves to a library food — whether by a confident single match or by the user picking a candidate from the chooser — and that food has no photo yet, the system SHALL attach the identify photo to that food as its image. Auto-attach SHALL use the photo already captured for identification (no re-capture) and MUST NOT overwrite an image the food already has. Auto-attach SHALL be non-blocking per the food-library-photos capability: it MUST NOT delay or block prefilling the form or logging the entry, and a failed attach MUST NOT affect the match, the prefilled form, or the logged entry.

A cancelled flow SHALL attach nothing. A no-match result SHALL likewise attach nothing on its own; its photo instead travels with the estimate handoff and is attached only if the user goes on to save an entry that captures a new library food, per the food-library-photos capability — never to any food that already exists.

#### Scenario: Confident match on an image-less food attaches the photo
- **WHEN** identification returns exactly one candidate and that library food has no photo
- **THEN** the identify photo is attached to that food as its image, without blocking the form prefill

#### Scenario: Chosen candidate on an image-less food attaches the photo
- **WHEN** the user picks a candidate from the chooser and that food has no photo
- **THEN** the identify photo is attached to that food as its image

#### Scenario: Match on a food that already has a photo leaves it unchanged
- **WHEN** the flow resolves to a food that already has a photo
- **THEN** its existing photo is preserved and the identify photo is not stored

#### Scenario: No match attaches nothing by itself
- **WHEN** identification returns no candidates, or the user cancels before a match resolves
- **THEN** no image is attached to any food at that point

#### Scenario: A no-match photo reaches only a newly captured food
- **WHEN** identification returns no candidates, the user accepts an estimate from the handoff, and saves the entry under a name the library does not know
- **THEN** the identify photo becomes the newly captured food's image, and no existing library food is touched
