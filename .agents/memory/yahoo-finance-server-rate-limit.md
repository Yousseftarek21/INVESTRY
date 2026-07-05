---
name: Yahoo Finance server-side rate limiting
description: Yahoo's unofficial quote/spark endpoints can rate-limit the Replit sandbox's shared egress IP even from server code, not just browser CORS.
---

Calling `query1.finance.yahoo.com` from the api-server (not just the mobile client) can return "Too Many Requests" from Yahoo, independent of the well-known browser CORS block.

**Why:** The Replit sandbox's egress IP is shared/reused across many projects, so Yahoo's unofficial endpoints may already be rate-limited for it regardless of which layer (browser vs Node server) makes the call.

**How to apply:** Any new Yahoo Finance integration (spark or quote endpoints) needs a fallback to static/estimated prices at every layer that can call it — server route, client-via-server fetch, and client-direct fetch — the same three-tier pattern already used for EGX stocks and gold/silver prices. Don't assume moving a Yahoo call server-side avoids the CORS-style failure; test it live before assuming it "fixes" web preview.
