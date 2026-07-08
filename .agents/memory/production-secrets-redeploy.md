---
name: Production secrets need a redeploy
description: Rotating/updating a Replit secret value does not hot-reload into an already-running production deployment.
---

Secrets in Replit are global (same key/value visible to dev and production), but a **running** deployed process only reads `process.env` at startup — it does not pick up a changed secret value while it keeps running. Restarting the dev workflow picks up the new value immediately (new process), but production won't until it is redeployed/restarted.

**Why:** A user rotated `COMMODITY_API_KEY`. Dev worked immediately after a workflow restart, but production kept returning `unexpected response data=null` from the same provider and silently fell back to a hardcoded constant price — looking like a "stuck" value — because the old key was still what the running production process had in memory.

**How to apply:** When a user says a secret was rotated/updated but production still behaves like the old value is in effect (stale prices, auth failures, "stuck" data that matches a hardcoded fallback), don't just re-verify the secret value — check whether production was redeployed since the rotation. If not, that's very likely the actual fix needed (the user must redeploy/republish; the code and secret are already correct).

Related debugging tip: when a third-party fetch silently returns `null`/"unexpected response" in logs, check that failure logging captures HTTP status/body (not just the parsed JSON), otherwise auth-vs-outage vs malformed-response failures are indistinguishable from logs alone. Always redact query-string API keys/tokens before logging a URL.
