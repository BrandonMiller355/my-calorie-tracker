# Cal Tracker redesign — implementation handoff

Design reference: PNGs in `design-refs/` (2a tokens, 2b/2c Log light+dark, 2d/2e log-food sheet, 2f Search, 2g Settings) — treat these as the source of truth for layout and spacing. Tokens: `tokens.css` (import it first in `src/index.css`, or replace index.css and keep these vars at top). No new dependencies; everything is plain CSS + your existing components. Figtree via one Google Fonts `<link>` in `index.html`.

## Theme
`ThemeProvider` already stores `system | light | dark`. Resolve `system` with `matchMedia('(prefers-color-scheme: dark)')` and set `data-theme` on `<html>`. Components never reference raw colors — vars only.

## App shell (`App.tsx`)
- Tab bar (2b): floating pill, `--surface`, `--shadow-float`, `--r-pill`, 6px inner padding, 4 equal columns; margin `8px 12px 12px`. Active tab = pill of `--brand-tint`, icon+label `--brand-strong` (dark: `--brand-strong` text on `--brand-tint`); inactive `#98A092` / dark `#7E857A` (≈ `--ink-faint`). Icons: 17px, 1.9 stroke, round caps — list / magnifier / 2×2 dots / sliders (see SVGs in mock).
- Screen padding: 14px sides.

## DayLogScreen (2b light / 2c dark)
Order: date nav → hero card → 3 macro cards → weekly-deficit line → meal sections → FAB.
- **DateNav**: 32px round `--surface` buttons; center "Today" (`--text-heading` 16/800) over date caption. The hidden native date input stays overlaid on the center label. "Today" shortcut chip only when off-today.
- **Summary** (split): calories = hero card (`--r-hero`, `--shadow-card`): big remaining number (`--text-display`, tabular) + "kcal left", right-aligned "1,918 of 2,100" caption, 7px progress bar, footer row = goal note ("Custom goal today · Edit" → DayGoalEditor, or "Using default goals — set in Settings"). Macros = 3-up grid of `--r-card-s` cards: label, "43.2 / 30 g", 4px bar, delta line.
  - Over calories: remaining line "Over by 147 kcal" + bar in `--bad`. Over macro: bar full + "+13.2 g" in `--good`. Under: bar `--brand`, delta in `--ink-soft`.
- **WeeklyDeficit**: one caption line, dot + "Weekly deficit **1,316 kcal** — 434 to go". Value `--good`; negative → `--bad` with −. Goal met → "Goal met (1,750) — 210 extra". Missing-days disclaimer: second caption line `--ink-faint`.
- **DayGoalEditor**: keep logic; render expanded form inside the hero card footer as a 2×2 grid of inputs + Cancel / Use default / Save for today.
- **MealSection — time-aware collapse (new)**: each section has collapsed/expanded UI; default by current time: Breakfast <10:30 <Lunch <15:00 <Dinner <20:30 <Snacks; the current meal + any later meal expanded, past meals collapsed (tap header toggles; user toggle wins over default for the session). Collapsed row (`--r-card`, 8px 14px): name (`--ink-soft` weight 700) + "n items", right = kcal chip (`--surface-tint`, `--r-pill`) + chevron. Current meal card gets `--shadow-card-active` + border `#DCE6DA` (dark `#3A4438`) + NOW chip (`--brand-tint` bg, micro type). Entry rows: name 13/600 (wrap max 2 lines), caption "2 slice · F 19.2 · C 78.4 · P 34" (qty prefix only when amount ≠ 1 serving), kcal right 13/700; `--divider` between rows; delete = row swipe or ✕ on the right at `--ink-faint` with confirm. "+ Log food" = full-width 32px `--surface-tint` button, `--brand` text.
- **FAB (new)**: fixed above tab bar right (16px, bottom 74px in mock), `--brand` pill 46px, "+ Log", `--shadow-fab`; opens EntryForm with meal defaulted to the current time's meal.
- States: loading = skeleton bars (`--seg-bg`); load error = centered card + Retry (secondary button); delete-failure banner = `--bad-tint` card with `--bad-border`, Retry link.

## EntryForm → bottom sheet (2d known / 2e new)
Backdrop `--scrim`; sheet `--sheet`, top radius `--r-sheet`, `--shadow-sheet`, drag handle 36×4 `#D8DCD4`, padding 10 16 18. Header: "Log food"/"Edit food" + two ghost chips "✦ Describe" (TextLogOverlay) and "✦ Photo" (IdentifyOverlay) — hidden while editing.
- Inputs: `--control-h`, `--input-bg`, 1px `--input-border`, `--r-input`; focus = 2px `--brand` border on `--surface`. Labels: 11/700 `--ink-soft` above.
- Name = existing combobox; matched food shows description caption under the field + ✕ to clear; dropdown = `--surface` card, `--shadow-float`, group labels micro-caps, options name + "· 140 kcal", action rows ("Search online for…", "Use as new food") in `--brand`.
- Meal = segmented control (4 segments, `--seg-bg` track, active `--seg-active-bg` + `--brand-strong` text). Amount = 110px input + unit select.
- Known food: nutrition collapsed into `--surface-tint` summary card: computed line "622 kcal · F 19.2 · C 78.4 · P 34" (live preview) + "per 1 slice (= 140 g): 311 kcal · **Edit nutrition**". Expanding reveals serving anchor + per-serving fields (note "Updates your food library").
- New food: Description input, "+ Add recipe" link, serving anchor row (Serving name / Equals / Unit), Calories ("— per 1 bowl (= 250 g)"), F/C/P 3-up grid. Search-prefill missing fields: `--warn-tint` bg + `--warn-border` + "— missing, confirm" label; AI-weight caveat as a `--warn` caption. Errors: 11px `--bad` under field; save-failure line above actions.
- Actions: Cancel (110px, `--surface` + `--input-border`) + primary `--brand` flex-1, both `--button-h`.
- AI overlays (identify / analyze / text-log) stay full-screen: `--scrim` over camera, white pill secondary buttons, `--brand` primary — reuse mock button styles; review lists reuse entry-row pattern.

## SearchScreen (2f)
Title → search input (44px, focused = `--brand` 2px border, magnifier + clear) → ghost chips "Scan barcode" (camera-capable only) / "✦ Analyze a photo" → micro-caps results meta ("OPEN FOOD FACTS · 5 RESULTS") → result cards (`--r-card-s`): name + "· Brand", caption "1 serving = 170 g · F 0 · C 5 · P 18", kcal right 13/800. Unknown values = "—" and an `--warn` "· incomplete" tag. Footer link "Add a food manually". Idle/loading/error/not-found reuse caption + banner patterns; barcode states swap in below the chips.

## SettingsScreen (2g)
Stacked `--r-card` cards: Default daily goal (note, 2×2 labeled inputs — keep `GOAL_FIELDS` labels incl. "Calorie burn (kcal)" — Save + transient "Saved ✓" in `--good`), Weekly deficit goal (input + Save), Appearance (3-segment theme picker), Sign out (bordered `--bad-border` card, `--bad` text). Same input/validation/error styles as the sheet.

## Foods screen (not mocked — follow system)
Reuse search result-card anatomy + Edit/Archive as ghost chips; "+ Add food item" = primary button; filter input = search input style; the info note = `--brand-tint` card.

## Global rules
- Every number: `font-variant-numeric: tabular-nums`; kcal right-aligned; commas on 4+ digits (`toLocaleString`).
- Long names wrap to 2 lines (`-webkit-line-clamp: 2`), numbers never shrink (`flex-shrink: 0`).
- Hit targets ≥ 44px (collapsed meal rows: whole row is the toggle).
- Motion: 150–200ms ease-out on collapse/expand and sheet slide-up; respect `prefers-reduced-motion`.
- `<a>`: `--brand`, hover `--brand-strong`.
