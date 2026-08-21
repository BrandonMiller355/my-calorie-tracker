## Why

The app is an installed Android PWA, but nothing in it responds to the hardware back button: every dismissible surface — modals, camera overlays, the full-screen image view — is React state that history knows nothing about. Pressing back from any of them pops the app's only history entry and drops the user on the homescreen, losing whatever they were doing. Back should behave the way it does in a native Android app: unwind the thing that's open, then step back toward the log, and only leave the app deliberately.

## What Changes

- Back becomes an interpreted signal rather than a raw history navigation. Its priority chain: close the topmost open layer → return to the Log tab → return to today → arm exit → exit.
- Every dismissible layer (entry form, log-meal sheet, meal builder, food editor, identify/text/bulk/analyze overlays, camera capture, photo confirm, barcode scanner, image lightbox, food-name dropdown) responds to back by dismissing exactly as its existing cancel path does. Layers with internal phases may step back one phase instead of closing.
- The same mechanism unifies Escape-key dismissal, which today only the image lightbox implements.
- Tab switching becomes Android-style: back returns to the Log tab (the start destination) rather than retracing visited tabs. **BREAKING** (behavioral): tab navigation no longer accumulates browser history entries.
- On the Log tab, back returns the selected day to today in a single press — the same effect as the existing "Today" button — rather than one press per day paged.
- With nothing left to unwind, back shows a toast reading "Press back again to exit the application" and arms a short window; a second back within that window leaves the app, and letting the window lapse quietly re-arms the guard.
- A minimal toast primitive is introduced, positioned above the bottom tab bar. The exit hint is its only caller for now.

## Capabilities

### New Capabilities
- `app-navigation`: how the app interprets the hardware back button and Escape — the layer/tab/date unwind chain, the two-press exit guard, and the transient toast that announces it.

### Modified Capabilities
- `daily-summary`: the "Day navigation" requirement gains back as a way to return to today, alongside the existing previous/next controls and date picker.
- `food-search`: the "Select a search result" requirement currently promises that "selecting a result (or navigating back)" restores the in-progress entry form. That guarantee is narrowed to the search screen's own in-app return links; the hardware back button returns to the Log tab without rebuilding the form.

## Impact

- `src/App.tsx`: mount the back-handling provider and the toast host; tab `NavLink`s switch to replace navigation.
- New: a back-dispatch provider plus its registration hook, and a toast component with its own state.
- `src/screens/DayLogScreen.tsx`: entry-form state registers as a layer; the log screen registers the return-to-today step.
- `src/screens/FoodsScreen.tsx`, `src/screens/SearchScreen.tsx`: food editor, meal builder, and barcode scanner register as layers.
- The ~13 components that already take `onClose`/`onCancel` register their existing dismiss path: `EntryForm`, `LogMealSheet`, `MealBuilder`, `IdentifyOverlay`, `PhotoCapture`, `PhotoConfirm`, `TextLogOverlay`, `BulkPhotoOverlay`, `AiAnalyzeOverlay`, `BarcodeScanner`, `FoodThumbnail` (lightbox), `FoodNameCombobox` (dropdown).
- Browser history handling: a sentinel entry is maintained above the app so `popstate` can be intercepted without reaching the history boundary.
- Verification: the actual app-exit step depends on Chrome's behavior at the history boundary and cannot be reproduced in jsdom — it needs a manual check on the user's Android device.
