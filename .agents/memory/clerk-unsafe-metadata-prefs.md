---
name: Clerk unsafeMetadata for lightweight user prefs
description: When to store a small client-editable user field in Clerk's unsafeMetadata instead of adding a database column or table.
---

For a per-user preference that is purely cosmetic/personalization (e.g. a display name used only for a greeting), storing it in Clerk's `user.unsafeMetadata` is a valid lightweight alternative to a new DB column/table.

**Why:** `useUser()` already gives reactive access to `unsafeMetadata` client-side, so updates via `user.update({ unsafeMetadata: {...} })` propagate immediately everywhere the hook is used — no extra API route, no DB migration, no server round-trip needed for "load on sign-in" or "update live without restart" requirements.

**How to apply:** Only use this for non-sensitive, non-authoritative data the client is allowed to set (Clerk's own docs note `unsafeMetadata` is client-writable and not for anything security/entitlement-relevant — those must stay server-side, e.g. in Postgres, per this project's existing holdings/subscription patterns). Good fits: display names, UI preferences. Bad fits: plan/entitlement flags, ownership data.
