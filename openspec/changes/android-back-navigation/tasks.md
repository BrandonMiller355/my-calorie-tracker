## 1. Back dispatch provider

- [x] 1.1 Add a `BackNavigation` provider that owns a ref'd LIFO array of back handlers, mounted inside the router and above the app shell
- [x] 1.2 Add a `useBackHandler(active, handler)` hook that appends while active and removes by identity on cleanup, safe under StrictMode double-invocation
- [x] 1.3 Establish the scratch-entry invariant at mount: push a duplicate of the current location through the router so the app sits one entry above a scratch entry
- [x] 1.4 Add the `popstate` listener that resolves the chain synchronously — topmost handler, then Log tab, then exit guard — and re-pushes the intended location through `navigate` (never raw `pushState`)
- [x] 1.5 Implement the exit guard: on the first unhandled press show the hint toast and arm for 2s without re-pushing; on a press while armed let the browser leave; on lapse push the location back and disarm
- [x] 1.6 Clear the arm timer on any resolved back press, on any navigation, and on unmount

## 2. Toast

- [x] 2.1 Add a minimal `ToastHost` component with `role="status"` and `aria-live="polite"` that self-dismisses, positioned above the bottom tab bar
- [x] 2.2 Expose `showToast(message)` from the back-navigation provider and render the host inside that provider (rather than separately in `App`, so it can never be missing), with its lifetime matching the 2s arm window
- [x] 2.3 Add the toast styles to `index.css`, clearing the `.app-nav` bar and the FAB

## 3. App shell wiring

- [x] 3.1 Switch the four tab `NavLink`s in `App.tsx` to replace navigation so tab switching stops accumulating history entries
- [x] 3.2 Resolve the Log-tab step in the provider: when no handler consumed the press and the location is not `/`, navigate to `/`
- [x] 3.3 Verify the search-to-form handoff still works with replace-based tabs (`SearchScreen` result selection and its manual-entry links)

## 4. Register the layers

- [x] 4.1 `EntryForm` — register its `onClose` as a back handler
- [x] 4.2 `LogMealSheet` and `MealBuilder` — register their cancel paths
- [x] 4.3 `FoodsScreen`'s food add/edit form — register its close path
- [x] 4.4 `IdentifyOverlay`, `AiAnalyzeOverlay`, `PhotoCapture`, `PhotoConfirm` — register their cancel paths (covers both the entry-form and foods-screen hosts)
- [x] 4.5 `TextLogOverlay` — register a handler that steps back from the review phase to the input phase and only closes from the first phase. `BulkPhotoOverlay` registers plain cancel instead: re-picking replaces the whole batch, so its only earlier phase would discard identifications already paid for
- [x] 4.6 `BarcodeScanner` — register its cancel path, ensuring the camera stream still stops
- [x] 4.7 `FoodThumbnail`'s enlarged view — register its close, and delete its own Escape effect now that the provider owns Escape
- [x] 4.8 `FoodNameCombobox` — register dropdown dismissal while the list is open, but only when the user opened it deliberately: the entry form auto-focuses the name field, and a self-opened list must not cost a back press

## 5. Date and Escape steps

- [x] 5.1 In `DayLogScreen`, register a back handler active only while `date !== todayKey()` that resets the date to today in one step
- [x] 5.2 Add the provider's `keydown` listener so Escape runs the topmost handler only, with no fall-through to the tab, date, or exit steps

## 6. Tests

- [x] 6.1 Provider unit tests: LIFO dispatch order, handler cleanup, Escape stopping at the handler stack, no fall-through
- [x] 6.2 Exit guard tests with fake timers: first press shows the hint and arms, press while armed does not re-push, lapse disarms and re-arms on the next press
- [x] 6.3 Day log tests: back closes the entry form leaving input discarded and the day unchanged; a second back returns to today from a past day
- [x] 6.4 Nesting test: back from the identify overlay returns to the still-populated entry form, and a further back closes the form
- [x] 6.5 Phase test: back from a review phase returns to the capture phase with input retained
- [x] 6.6 Tab test: back from the Foods tab with a layer open closes the layer and stays on Foods; with no layer open it goes to the Log tab
- [x] 6.7 Toast test: the hint renders with `role="status"` and the expected text, and clears itself

## 7. Manual verification on device

- [ ] 7.1 Install/refresh the PWA on the user's Android phone and confirm back closes layers rather than the app, at each level of the chain
- [ ] 7.2 Confirm the two-press exit actually closes the PWA at the history boundary — this cannot be covered by jsdom tests
- [ ] 7.3 Confirm no flash or state loss when pressing back with a layer open on a non-Log tab; if it appears, fall back to the counted `history.go(-n)` approach recorded in design D4
