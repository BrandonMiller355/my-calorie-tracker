## 1. Shared photo and chaining helpers

- [ ] 1.1 Extract the image-file downscale helper (`loadImageFile`/`downscaleToJpeg`) from `PhotoCapture.tsx` into a shared module (e.g. `src/lib/photo.ts`) and re-use it from `PhotoCapture` unchanged
- [ ] 1.2 Create `src/lib/bulkPhotoChain.ts` with a pure chaining-note builder: given prior results (matched food name + grams, or unidentified marker), produce the note stating what the dish already contains, that only the new addition is to be identified, and that the scale is tared between additions; first photo gets no note
- [ ] 1.3 Unit-test the note builder: empty history (no note), single prior food with weight, mixed history including an unidentified addition

## 2. BulkPhotoOverlay component

- [ ] 2.1 Create `src/components/BulkPhotoOverlay.tsx` with phases `selecting` → `identifying` → `review` → saving, holding all batch state in component memory only
- [ ] 2.2 Selecting: hidden `<input type="file" multiple accept="image/*">` opened on mount; decode and downscale each file via the shared helper; skip undecodable files with a non-blocking message; reject selections over the batch cap (constant, e.g. 10) with a message; sort accepted photos by `file.lastModified` ascending
- [ ] 2.3 Identifying: sequential loop over `identifyFood` with `buildRequestFoods` and the chaining note per photo; "Analyzing photo N of M…" progress; abort on unmount; on failure keep completed rows and show an error with a retry action that resumes from the failed photo
- [ ] 2.4 Map each result to a review row: thumbnail, top candidate preselected (inline candidate `<select>` when 2–3 candidates, marked uncertain), amount/unit prefilled per the single-photo rules (grams when the anchor offers grams, else 1 × serving label), estimate-sourced weight labeled, meal defaulting to the dialog's meal, no-candidate rows rendered as "not recognized" and excluded from the loggable count
- [ ] 2.5 Review list UI mirroring `TextLogOverlay`'s review phase: editable amount/unit/meal per row, remove per row, candidate re-pick re-prefills amount/unit, "Add N entries" disabled while a loggable amount is invalid or no loggable rows remain
- [ ] 2.6 Bulk save: log rows one at a time via `addEntry` (name, amount, unit, derived quantity, anchor, nutrition, date, meal, `foodId`, source), dropping each row as it lands; on failure keep remaining rows with an error and let the button retry the remainder; on completion call `onLogged`

## 3. EntryForm integration

- [ ] 3.1 Add the bulk-photos header action to `EntryForm` in add mode only, alongside the identify and text-log actions, opening `BulkPhotoOverlay` with the dialog's foods, date, and selected meal
- [ ] 3.2 Close the dialog when the overlay reports all entries logged; cancelling the overlay returns to the untouched form

## 4. Tests

- [ ] 4.1 `BulkPhotoOverlay.test.tsx`: mock `identifyFood` — sequential calls carry chained notes (photo 2's note names photo 1's top candidate and grams; unrecognized photo yields "unidentified addition" in photo 3's note)
- [ ] 4.2 Review-list tests: rows in lastModified order with prefilled amounts; uncertain row preselects top candidate and re-picking re-prefills; not-recognized row excluded from count; remove updates count
- [ ] 4.3 Failure tests: mid-batch identify failure keeps earlier rows and retry resumes at the failed photo; mid-save failure keeps already-saved entries and retries only the remainder
- [ ] 4.4 `EntryForm.test.tsx`: bulk-photos action visible in add mode, absent in edit mode; overlay cancel leaves the form intact

## 5. Verification

- [ ] 5.1 `npm run typecheck` and `npm test` pass
- [ ] 5.2 Manual pass on a phone-sized viewport: multi-select, progress, review edits, bulk add, and cancel paths
