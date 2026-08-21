## Context

The app runs as an installed Android PWA (`display: standalone`) on `BrowserRouter`. Every dismissible surface is React state, so the browser's history has exactly one entry for the whole app and back pops it — closing the PWA. Today's back button therefore destroys an in-progress entry form, a camera overlay, or a full-screen photo with no way to recover.

Three facts shape the design:

- **The layers are deep and nested.** Up to four at once (entry form → identify → photo confirm), plus two overlays with internal phases (`TextLogOverlay`, `BulkPhotoOverlay` both run capture → review).
- **Exit must remain possible.** Trapping back entirely would leave no way out of the app but the home gesture.
- **The stack must stay bounded.** The exit guard works by letting the browser reach its own history boundary, which only works if the app's history depth is known and small.

## Goals / Non-Goals

**Goals:**
- Back unwinds one thing at a time: open layer → non-Log tab → non-today date → exit.
- Every layer dismisses through its existing cancel path, so back and Cancel are the same action.
- Escape on desktop resolves through the same stack, replacing the one-off handler in `FoodThumbnail`.
- Exiting takes two deliberate presses, announced by a toast.
- The history depth stays fixed for the life of the session.

**Non-Goals:**
- Deep links to layers, or layers surviving a reload — that would mean routing every overlay, a far larger refactor for a benefit this app doesn't need.
- Retracing visited tabs. Back goes to the Log tab, per Android's start-destination convention.
- Rebuilding the entry form when back leaves the search screen. The search screen's own in-app links keep doing that; back does not.
- Confirming discard of a half-filled form. Back means Cancel, which already discards without asking.
- iOS/Safari behavior. There is no hardware back there.
- A general toast system — queueing, actions, variants. One message, one caller.

## Decisions

### D1: Back is a dispatched signal, not a history navigation

A provider owns a LIFO stack of handlers. Layers register with a hook while they're open; the provider resolves a back press against the stack, then falls through to tab, date, and exit steps.

```
BACK PRESSED
   │
   ├─ registered handlers (LIFO) ──▶ run the topmost one, stop
   │      lightbox ▸ photo confirm ▸ identify ▸ entry form ▸ …
   │      (a handler may step its own phase back instead of closing)
   │
   ├─ location is not "/"          ──▶ navigate to the Log tab
   │
   ├─ exit armed (<2s ago)         ──▶ let the browser leave
   │
   └─ otherwise                    ──▶ toast + arm for 2s
```

The date step is not a special case in the chain — `DayLogScreen` registers an ordinary handler whenever `date !== todayKey()` that resets the date. Because that screen is only mounted while the user is on the Log tab, the date handler cannot preempt the tab step. Registration order does the rest: `DayLogScreen` mounts early so its handler sits at the bottom, beneath any layer opened later.

Alternative considered: hard-coding a date branch in the provider, which would have forced the provider to reach into `AppState` and know about the log screen's concerns. Registration keeps that knowledge where it belongs.

### D2: One scratch history entry, re-pushed after every pop

The app keeps itself exactly one entry above a scratch entry:

```
   [ scratch , app ]         ← the user always sits on "app"
        │
   back │ browser pops to "scratch"  (depth 1)
        ▼
   popstate handler resolves the chain, then pushes the app entry back
   [ scratch , app ]         ← depth restored, nothing visibly moved
```

Tab switches use `replace` so they never grow the stack, and every pop is answered by exactly one push. Depth is therefore always 1 or 2 — the property the exit guard depends on.

The push is made through the router's `navigate`, never raw `history.pushState`. React Router listens to `popstate` itself; a raw push would move the URL without telling the router, and the two would drift apart.

### D3: Exiting is delegated to the browser's own boundary

Once armed, the provider simply does not re-push after the pop, leaving the app sitting at depth 1:

```
armed:   [ scratch ]   ← toast showing, guard armed
            │
            ├─ back within 2s ──▶ nothing below ──▶ Chrome closes the PWA  ✅
            └─ 2s lapse       ──▶ push the app entry back, guard disarmed
```

The exit is the browser's own behavior at the boundary rather than something the app fakes. `window.close()` was the alternative and is unreliable for a window the script didn't open.

Arming can only ever happen at `/` with today's date and no layers open — every earlier step in the chain would have consumed the press otherwise — so the scratch entry's URL always matches what's on screen while armed. No drift is possible in that state.

### D4: Ordering that keeps the layer's screen mounted

The subtle part. When back pops the scratch entry, the router reacts too, and if the scratch entry's URL differs from the current one (a layer open on the Foods tab, say), the router would render the Log tab — unmounting `FoodsScreen` and destroying the layer's state before the provider can push it back.

This is safe because the two updates land in the same task:

1. `BrowserRouter` registers its `popstate` listener when it mounts in `main.tsx`, above the provider, so **the router's listener runs first** and sets its location state.
2. The provider's listener runs next, synchronously in the same event, and pushes the intended URL back through `navigate`.
3. React 18 batches both updates into a single commit at the final location — the intermediate location never renders, so nothing unmounts.

The provider's listener must therefore stay synchronous: no `await`, no `setTimeout` before the push.

If a flash or unmount does show up on device, the fallback is to track push depth explicitly and unwind with a counted `history.go(-n)` instead of relying on batching. Recorded here so the fallback isn't re-derived from scratch.

### D5: Layer order comes from registration order

Handlers are held in a ref'd array; the hook appends on open and removes on close, and the provider runs the last one. Layers in this app open one at a time — a nested overlay mounts in a later render than its parent — so append order is open order.

The known edge: if a parent and a child layer were to mount in the same commit, React runs the child's effect first and the parent would land on top. No current flow does this. If one appears, the fix is an explicit nesting depth rather than reordering effects.

### D6: Escape resolves through the same stack

The provider adds one `keydown` listener that runs the topmost handler, and `FoodThumbnail`'s own Escape effect is deleted. Escape stops at the handler stack — it does not fall through to the tab, date, or exit steps, since a keyboard user closing a dialog never means "quit the app".

### D7: A single-message toast

`showToast(message)` on the provider, one `ToastHost` rendered in `App`, `role="status"` with `aria-live="polite"`. It sits above the bottom nav so the tab bar stays visible, and its lifetime matches the 2s arm window exactly — the hint is on screen precisely while a second press would actually exit.

## Risks / Trade-offs

- [React 18's batching doesn't hold and the layer's screen unmounts on back] → D4's counted-`go(-n)` fallback; check on device early, since this is the load-bearing assumption.
- [The real exit can't be tested in jsdom — no history boundary exists there] → cover the arm/disarm/toast logic in tests, and verify the actual exit manually on the user's Android device as an explicit task.
- [StrictMode double-invokes effects in dev, double-registering handlers] → the hook removes by identity on cleanup, and registration is idempotent per handler instance.
- [Back becomes non-standard in a desktop browser tab, where it now closes overlays instead of navigating] → accepted; that is the same behavior the phone gets, and this is a single-user app.
- [Tab switches stop appearing in browser history] → intended, per the Android start-destination convention; the tab bar remains the way to move between tabs.
- [An armed exit that the user abandons leaves the app at depth 1 for up to 2s; a navigation during that window pushes normally] → the arm timer clears on any resolved back press or navigation, restoring the invariant.
