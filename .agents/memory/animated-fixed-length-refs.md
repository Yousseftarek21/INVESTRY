---
name: Animated.Value arrays must not be sized to a dynamic list's initial length
description: Pattern that causes "Cannot read property 'stopTracking' of undefined" crashes in React Native Animated code
---

When creating a `useRef` array of `Animated.Value`s sized off a list derived from app state (e.g. `list.map(() => new Animated.Value(0))`), the ref is only sized once at first mount. If the source list's length can grow on a later render (filtered categories appearing/disappearing, items being added), indexing into the ref array is `undefined` for the new entries, and `Animated.timing(undefined, ...)` throws `Cannot read property 'stopTracking' of undefined`.

**Why:** Hit this in INVESTRY's analytics allocation chart — the segment list filters out zero-value asset classes, so its length changes as a user's holdings change (e.g. adding their first Personal Asset holding grows the array from 4 to 5 items), but the `Animated.Value[]` ref was sized once at mount.

**How to apply:** For animated values tied to a dynamically-sized/filtered list, either (a) key the animated values by a stable ID (label) in a `Record<string, Animated.Value>` and lazily create entries on demand, or (b) pre-allocate a fixed max-size array and always pass the full unfiltered list through so the ref length never changes (used elsewhere in this app in `AllocationBar.tsx`'s `OverviewBar`). Also check any `ErrorBoundary`/fallback UI doesn't itself depend on context providers declared *below* the boundary in the tree — otherwise a real crash cascades into a second crash when the fallback renders.
