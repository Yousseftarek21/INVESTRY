---
name: EAS Build Pipeline for INVESTRY
description: How to get EAS iOS builds working from the Replit monorepo — root causes found and fixed across a full debug session.
---

# EAS Build Pipeline — Lessons Learned

## Root causes (in order discovered)

1. **`catalog:` and `workspace:*` in package.json** — EAS uploads only `artifacts/mobile`, no pnpm workspace context. Replace all `catalog:` entries with real npm versions, remove `workspace:*` deps.

2. **No lockfile → EAS defaults to `yarn install --frozen-lockfile`** — fails immediately with exit code 1 if no `yarn.lock` present. Must generate a `yarn.lock` and include it in `artifacts/mobile/`.

3. **yarn.lock generated inside Replit bakes in Replit's internal proxy** — every resolved package URL becomes `http://package-firewall.replit.local/npm/...`, which EAS can't reach. Fix: `sed -i 's|http://package-firewall.replit.local/npm/|https://registry.yarnpkg.com/|g' artifacts/mobile/yarn.lock` after generating.

4. **Node engine incompatibility** — `@solana/wallet-standard-features@1.4.0` (transitive via `@clerk/expo`) requires Node >=22 but EAS Build runs Node 20. Fix: `echo "ignore-engines true" > artifacts/mobile/.yarnrc`.

5. **`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` missing from EAS build** — EAS had no environment variables set for production. Key must be set via `eas env:create`. Get value from `curl localhost:80/api/config`.

6. **`EXPO_PUBLIC_CLERK_PROXY_URL` must NOT be set for production** — dev proxy is `http://localhost/api/__clerk` which is unreachable on real devices. Leave unset; app connects directly to Clerk API.

## How to regenerate yarn.lock when package.json changes

```bash
# 1. Copy mobile dir to temp (avoids pnpm workspace interference)
cp -r artifacts/mobile /tmp/mobile_build

# 2. Remove packageManager field (blocks yarn)
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('/tmp/mobile_build/package.json','utf8'));delete p.packageManager;fs.writeFileSync('/tmp/mobile_build/package.json',JSON.stringify(p,null,2));"

# 3. Generate yarn.lock
cd /tmp/mobile_build && yarn install --ignore-scripts --non-interactive

# 4. Fix Replit proxy URLs
sed -i 's|http://package-firewall.replit.local/npm/|https://registry.yarnpkg.com/|g' /tmp/mobile_build/yarn.lock

# 5. Copy back
cp /tmp/mobile_build/yarn.lock artifacts/mobile/yarn.lock
```

## Build submission command

```bash
cd artifacts/mobile && EXPO_TOKEN=$EXPO_TOKEN EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 \
  eas build --platform ios --profile production --non-interactive --auto-submit
```

**Why:** `EAS_NO_VCS=1` skips git requirement; `EAS_SKIP_AUTO_FINGERPRINT=1` avoids fingerprint mismatch; `--auto-submit` schedules TestFlight upload on success.

## Build number

Bump `artifacts/mobile/app.json` → `expo.ios.buildNumber` before each build. TestFlight rejects duplicate build numbers.

## EAS env vars for production

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` = value from `curl localhost:80/api/config | jq .clerkPublishableKey`
- Do NOT set `EXPO_PUBLIC_CLERK_PROXY_URL` for production

Set via: `eas env:create --name KEY --value val --environment production --visibility plaintext --non-interactive`
