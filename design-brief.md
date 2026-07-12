# Cal Tracker — UI design brief

## What the app is

A personal calorie and macro tracker. Mobile-first web app (React + plain CSS), single user, used many times a day. The core loop is: open the app, log a food in a few taps, glance at what's left for the day. Speed and glanceability matter more than anything else.

Supports **light and dark themes** (user-selectable: match device / light / dark). Every screen must work in both.

## Global shell

- Four-tab navigation bar (currently text links at the bottom): **Log** (home), **Search**, **Foods**, **Settings**.
- No header bar today; each screen renders its own content directly.

## Screens

### 1. Login

- App title, email + password fields, sign-in button (busy state: "Signing in…"), inline error message.
- Deliberately no sign-up or password-reset link (single-user deployment).

### 2. Log (home screen — the one that matters most)

Top to bottom:

**Date navigation** — previous/next day arrows, center label ("Today" or a formatted date) that doubles as a native date picker, and a "Today" shortcut button that appears only when viewing another day.

**Daily summary** — four metric cards: Calories (kcal), Fat (g), Carbs (g), Protein (g). Each shows:
- consumed / goal (e.g. "1,430 / 2,000 kcal")
- remaining (e.g. "570 kcal left") or "Over by 120 kcal"
- Semantics: going **over calories is bad** (currently red); going **over a macro like protein is fine/good** (styled positively). These need distinct treatments.
- A small note appears when the user hasn't set their own goals ("Using default goals — set your own in Settings.").

**Weekly deficit** — a single stat: running weekly calorie deficit in kcal (value turns red when negative). If a weekly goal is set, a progress line: "Goal met (3500 kcal) — 210 kcal extra" or "1,240 kcal to go to hit your 3500 kcal goal". A disclaimer line appears when some days this week have no log entries.

**Per-day goal editor** — lets the user override the daily goal for just this date (save / clear override). Secondary; shouldn't compete with the summary.

**Four meal sections** — Breakfast, Lunch, Dinner, Snacks. Each has:
- header with meal name + subtotal kcal on the right
- entry rows: food name (with quantity suffix like "· 2 cup" when it isn't 1 serving), a macro line "F 12 · C 30 · P 8", calories right-aligned, and a delete button (with confirm). Tapping the row opens it for editing.
- empty state: "Nothing logged yet."
- a "+ Log food" button per section — this is the most-used control in the app.

**States**: loading ("Loading…"), full-screen load error with Retry button, and a dismissable-style error banner when a delete fails.

### 3. Log-food form (modal over the Log screen — the most complex surface)

Opened by "+ Log food", by editing an entry, or prefilled from search/AI. Fields:

- **Food name combobox** — as you type, suggests foods from the personal library, grouped ("Recent", "Most used"), each with a secondary description line. Also offers escalation actions: search online (jumps to Search screen and returns with a prefill), identify from photo, AI-estimate from photo, and log-from-text.
- **Meal picker** (Breakfast/Lunch/Dinner/Snacks).
- **Amount + unit** — amount input plus a unit select. Units available depend on the food's serving definition (e.g. a food anchored to "1 can = 120 g" can be logged in g/oz/etc.).
- **Nutrition per serving** (calories, fat, carbs, protein) — collapsed behind an "Edit nutrition" affordance for known foods; expanded for new foods or when a search result is missing values (missing fields are flagged for confirmation).
- **Serving definition** — serving name ("can (drained)"), "equals" amount, and measure unit.
- A description field that seeds the library food.
- Inline validation errors, a macro-vs-calorie sanity-check warning, a save-failure message, and a caveat badge when the amount came from an AI visual estimate.

**AI overlay flows** (full-screen overlays launched from this form or Search):
- **Identify from photo** — camera capture → matches against the library → confirm.
- **AI analyze photo** — estimates a food + nutrition from a photo with a note.
- **Log from text** — free-text like "2 eggs and a slice of toast" → resolves to one or more entries the user reviews before logging.

### 4. Search (online food database)

- Search input (debounced), states: idle, loading, error, results.
- Result rows: name, brand, per-serving nutrition (em-dash for unknown values). Tapping one returns to the Log screen with the entry form prefilled.
- **Barcode scan** button (only when the device supports it) with scanning / looking-up / not-found / error states.
- An AI-analyze option and an "add a food manually" fallback link.

### 5. Foods (personal library)

- List of saved foods: name, optional description (brand/prep notes), serving anchor text ("1 can (drained) = 120 g" or "per bowl"), per-serving nutrition.
- Add/edit food modal with the same field set as the entry form (name, description, serving definition, calories + macros). Duplicate-name validation. Foods can be archived (hidden from suggestions/search).

### 6. Settings

- **Default daily goal** form: calories, fat, carbs, protein; note explaining it applies to days without an override; transient "Saved ✓" confirmation.
- **Weekly deficit goal** form: single optional kcal target.
- **Theme** picker: Match device / Light / Dark.
- Sign out.

## Component inventory (for a design system)

Buttons (primary, secondary, destructive, icon-only delete, inline "today" chip), text/decimal inputs, selects, native date input, combobox with grouped suggestions and action items, metric/stat cards, stat with semantic coloring, list rows with right-aligned numbers, section headers with subtotals, modal dialog over backdrop, full-screen camera/AI overlays, error banner, form-note / helper text, transient saved confirmation, empty states, loading states, tab navigation.

## Design constraints

- Mobile-first, one-handed use; desktop just needs to not look broken.
- Numbers everywhere — typography must make consumed/goal/remaining scannable at a glance.
- Semantic color rules: over-calories = negative, over-protein = positive, negative weekly deficit = negative. Must survive both themes.
- No component library or CSS framework today (hand-written CSS with plain class names), so the new design can define its own tokens/components freely — but deliverables should be implementable as CSS + React without adding heavy dependencies.
