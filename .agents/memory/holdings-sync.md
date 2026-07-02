---
name: HoldingsContext sync key and migration
description: The local cache key must stay at its original value; first-load migration logic pushes local→API
---

**Rule:** The AsyncStorage key for holdings MUST remain `@istithmarak_holdings` (the original). Changing it causes all existing device data to vanish.

**Why:** Users had data stored under this key before the backend was added. Any key change silently loses that data since the app falls back to empty and the API is also empty for new users.

**How to apply:**
- Never rename `LOCAL_KEY` in `HoldingsContext.tsx`
- On load: show local data immediately, then fetch API
- One-time migration: if `apiData.length === 0` AND `localData.length > 0` → POST all local items to API. This runs once when a user first goes online with the new backend.
- Sign-out must call `setHoldings([])` to clear state — otherwise stale data shows to the next user who signs in on the same device.
