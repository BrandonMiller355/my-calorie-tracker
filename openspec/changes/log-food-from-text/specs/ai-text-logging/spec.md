## ADDED Requirements

### Requirement: Text-log entry point in the Log Food dialog
The Log Food dialog (entry form in add mode) SHALL offer a "log from text" action in its header alongside the existing identify-from-photo action. The action MUST NOT be rendered when editing an existing entry, and all other entry-form behavior SHALL be unchanged when the action is unused.

#### Scenario: Action shown when adding
- **WHEN** the user opens the Log Food dialog to add an entry
- **THEN** the log-from-text action is visible in the dialog header next to the identify-from-photo action

#### Scenario: Action hidden when editing
- **WHEN** the user opens the dialog to edit an existing entry
- **THEN** no log-from-text action is shown

### Requirement: Free-text description input
Activating the log-from-text action SHALL open an overlay containing a free-text input that is autofocused on open (so the mobile keyboard — and its dictation key — appears immediately), an explicit send action, and a cancel action. Parsing MUST NOT begin before the send action is activated, sending MUST be disabled while the input is blank, and cancelling at any point MUST return to the entry form with its prior state intact.

#### Scenario: Input focused on open
- **WHEN** the user activates the log-from-text action
- **THEN** the overlay opens with the text input focused and nothing has been sent

#### Scenario: Blank input cannot be sent
- **WHEN** the text input is empty or only whitespace
- **THEN** the send action is disabled

#### Scenario: Cancel preserves the form
- **WHEN** the user cancels the overlay before or after sending
- **THEN** no entries are logged and the entry form is exactly as they left it

### Requirement: Server-proxied parsing with a protected API key
The system SHALL parse descriptions through a dedicated `log-from-text` Supabase Edge Function that holds the AI provider's API key (Gemini) as a server-side secret and rejects requests without a valid Supabase session JWT. Each request SHALL carry the description text, the dialog's currently selected meal, and the user's non-archived library foods (id, name, optional description, serving label, and serving-weight information); archived foods MUST NOT be sent or matched. The function MUST be stateless: the text, library payload, and result MUST NOT be persisted server-side, and the client SHALL discard them when the overlay closes.

#### Scenario: Authenticated user sends a description
- **WHEN** a signed-in user sends a description for parsing
- **THEN** the Edge Function calls the Gemini API with the server-held key and returns the parsed items

#### Scenario: Unauthenticated request rejected
- **WHEN** a request without a valid Supabase JWT reaches the Edge Function
- **THEN** the request is rejected without calling the Gemini API

#### Scenario: Archived foods excluded
- **WHEN** the user's library contains archived foods
- **THEN** those foods are not included in the request and can never be matched

#### Scenario: Nothing persisted
- **WHEN** the overlay closes (by logging entries, cancelling, or navigating away)
- **THEN** the text and parsed items are discarded and nothing about them is stored anywhere

### Requirement: Description parsed into matched and estimated items
Parsing SHALL return one item per distinct food in the description. Each item MUST be either a **library match** — a single library-food id, which MUST be one of the ids submitted in the request (ids that are not MUST be discarded by server-side revalidation) — or an **estimate** — a food name with per-portion calories, fat, carbs, and protein and a note stating the model's most uncertain assumption, for foods the description names but the library does not plausibly contain. A description mixing known and unknown foods SHALL yield a mix of both kinds. When no usable items can be parsed, the system SHALL report that the description was not understood rather than returning an empty success.

#### Scenario: Multiple known foods
- **WHEN** the user sends "2 slices of sara lee bread with 1 serving of pbfit" and both foods are in the library
- **THEN** two library-match items are returned, one per food

#### Scenario: Known and unknown foods mixed
- **WHEN** the description names one library food and one food not in the library
- **THEN** the result contains a library match for the first and an estimate (name plus per-portion nutrition) for the second

#### Scenario: Fabricated id discarded
- **WHEN** the model returns a food id that was not in the request's library payload
- **THEN** the server drops that item before responding

#### Scenario: Unintelligible description
- **WHEN** the description yields no usable items
- **THEN** the user sees a message that it couldn't be understood, with the text preserved for editing and resending

### Requirement: Amount resolution for matched items
A library-match item MAY carry an amount expressed either as a count of the food's serving label or as a weight in grams. A serving count SHALL prefill the amount in the food's serving label unit. A gram amount SHALL prefill the amount in grams only when the food's serving anchor offers grams as a logging unit; otherwise the amount SHALL default to 1 of the food's serving label. An item with no stated amount — including habitual phrasing such as "my normal shake" — SHALL default to 1 of the food's serving label. Estimate items SHALL always enter as 1 serving representing the described portion.

#### Scenario: Serving-count amount
- **WHEN** the description says "2 slices" and the matched food's serving label is "slice"
- **THEN** the item is prefilled with amount 2 in that serving label

#### Scenario: Gram amount with weight-anchored food
- **WHEN** the description says "150 g of rice" and the matched food's anchor has a weight equivalence
- **THEN** the item is prefilled with amount 150 in grams

#### Scenario: Gram amount without weight equivalence
- **WHEN** the description states a weight but the matched food's anchor has no weight equivalence
- **THEN** the item is prefilled with amount 1 of the food's serving label

#### Scenario: No amount stated
- **WHEN** the description references a food without a quantity (e.g. "my normal whey protein shake")
- **THEN** the item is prefilled with amount 1 of the food's serving label

### Requirement: Meal resolution
Each item's meal SHALL be the meal stated in the description when one is stated (e.g. "for breakfast"), and otherwise the meal currently selected in the Log Food dialog. The resolved meal MUST remain editable before anything is logged.

#### Scenario: Meal stated in the text
- **WHEN** the description says "for breakfast" while the dialog's meal is snacks
- **THEN** the item resolves to breakfast

#### Scenario: Meal not stated
- **WHEN** the description does not mention a meal
- **THEN** the item resolves to the meal currently selected in the dialog

### Requirement: Single parsed item fills the form in place
When parsing yields exactly one item, the system SHALL close the overlay and fill the open entry form with it instead of showing a review list. A library match SHALL fill the form exactly as if the user had selected that food from the name combobox, with the resolved amount, unit, and meal applied; an estimate SHALL fill the form exactly as an accepted AI photo estimate does (a new one-serving food). All prefilled values MUST remain editable before saving, and the filled form SHALL behave identically to those existing flows, including the "Edit nutrition" library-update semantics.

#### Scenario: Single library match
- **WHEN** parsing "I had my normal whey protein shake" yields one match
- **THEN** the form is filled with that food's name and nutrition, amount 1 of its serving label, and the dialog's meal, ready to edit or save

#### Scenario: Single estimate
- **WHEN** parsing yields one estimate item
- **THEN** the form is filled as a new one-serving food with the estimated nutrition, exactly like an accepted AI photo estimate

### Requirement: Multi-item review before logging
When parsing yields two or more items, the overlay SHALL present them as a review list before anything is logged. Each item SHALL show the resolved food name (with the matched food's description where present), an editable amount with a unit selector limited to that item's valid logging units, an editable meal selector, and the computed calories the item will contribute, updating live with the amount. Each item SHALL offer a remove action. No entry may be persisted until the user activates the confirm action, and dismissing the review MUST log nothing and return to the entry form unchanged.

#### Scenario: Review lists all parsed items
- **WHEN** parsing "2 slices of sara lee bread with 1 serving of pbfit" yields two items
- **THEN** the review lists both with their resolved names, amounts, meals, and computed calories, and nothing has been logged

#### Scenario: Adjusting an item updates its calories
- **WHEN** the user changes an item's amount from 2 to 3 slices
- **THEN** that item's displayed calories update live and nothing is logged yet

#### Scenario: Removing an item
- **WHEN** the user removes one of three items
- **THEN** the review shows the remaining two and only those will be logged

#### Scenario: Dismissing the review
- **WHEN** the user cancels from the review list
- **THEN** no entries are logged and the entry form is as they left it

### Requirement: Bulk add of reviewed items
The review's confirm action SHALL create one food entry per remaining item on the dialog's date: library matches with the matched food's current nutrition and serving-anchor snapshot, a link to that library food, and a servings multiplier derived from the reviewed amount and unit per the serving-units capability; estimates as one-serving entries with the estimated nutrition, subject to the same auto-capture behavior as any manually typed new food (per the food-library capability). Logging a matched item MUST NOT modify the matched library food. When adding an item fails, entries already added SHALL remain, the failed and remaining items SHALL stay in the review with a save-failure message, and the confirm action SHALL retry only those.

#### Scenario: All items logged
- **WHEN** the user confirms a review of two items for lunch
- **THEN** two entries appear under lunch for the dialog's date, the day's totals update, and the dialog closes

#### Scenario: Matched entry links to the library food
- **WHEN** a reviewed library-match item is logged
- **THEN** the created entry references that library food and snapshots its serving anchor and nutrition, and the library food itself is unchanged

#### Scenario: Partial failure keeps remaining items
- **WHEN** the second of three items fails to save
- **THEN** the first entry remains logged, the review keeps the failed and third items with a save-failure message, and confirming again retries only those two

### Requirement: Parsing failure handling
When a parsing request fails (network error, provider error, or malformed response), the system SHALL show a non-blocking error message and preserve the entered text so the user can retry or edit it, and cancelling MUST return to the entry form with its prior state intact.

#### Scenario: Request fails
- **WHEN** the parsing request fails
- **THEN** an error message is shown, the entered text is still present, and the user can edit it or resend
