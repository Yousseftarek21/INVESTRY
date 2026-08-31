import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

export interface UserIdentity { name: string; imageUrl: string | null }

export const FALLBACK_NAME = "Investor";

// In-memory, per-process — fine for a single Render instance (no shared
// cache infra in this app), and identities barely ever change (a display
// name/photo edit), so a stale-for-a-few-minutes entry is a non-issue.
// Added directly in response to a real incident: Clerk's own backend API
// (not just its frontend custom domain) ran slow tonight — up to 21s on
// GET /feedback, 6s on the leaderboard — and both of those are exactly the
// routes that call this on every single request via a `.map(m => m.userId)`
// over a list that's mostly the *same* senders poll after poll. Caching
// means only genuinely new senders ever wait on a fresh Clerk call; anyone
// already seen resolves instantly regardless of how slow Clerk is being.
const CACHE_TTL_MS = 10 * 60 * 1000;
const identityCache = new Map<string, { identity: UserIdentity; expiresAt: number }>();

// Bounds how long a single Clerk lookup can hold up the whole request — a
// cache MISS still has to ask Clerk the first time, and Clerk being slow
// shouldn't mean the caller hangs for 20+ seconds (measured tonight) when
// falling back to FALLBACK_NAME and retrying on the next call is a far
// better outcome than a stuck request. Deliberately shorter than the
// mobile client's own 15s Clerk-init safety net (app/_layout.tsx) — this
// is a background name lookup, not the auth flow the whole app is gated
// behind, so it can afford to give up sooner.
const CLERK_LOOKUP_TIMEOUT_MS = 6000;

// Batch-fetches display identity for up to 500 Clerk user IDs in ONE call —
// shared by the portfolio leaderboard (competition.ts), the referral
// leaderboard (referral.ts), and the feedback chat (routes/feedback.ts), so
// all three show a person under exactly the same name/photo Settings and
// Home already show them under.
//
// Name precedence mirrors the mobile app's own convention exactly (see
// settings.tsx / CompetitionInviteBanner.tsx): unsafeMetadata.displayName
// (user-editable in Settings) → firstName+lastName → email local-part → a
// neutral fallback.
//
// PITFALL: getUserList() defaults to a page size of 10 — passing only
// `{ userId: ids }` without an explicit `limit` silently returns just the
// first 10 matches, with every id past #10 falling through to
// FALLBACK_NAME and no error thrown. `limit: uniqueIds.length` avoids this.
export async function fetchIdentities(userIds: string[]): Promise<Map<string, UserIdentity>> {
  const map = new Map<string, UserIdentity>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return map;
  if (uniqueIds.length > 500) {
    throw new Error(`fetchIdentities: ${uniqueIds.length} ids exceeds Clerk's 500-id batch limit — caller must chunk`);
  }

  const now = Date.now();
  const idsToFetch: string[] = [];
  for (const id of uniqueIds) {
    const cached = identityCache.get(id);
    if (cached && cached.expiresAt > now) {
      map.set(id, cached.identity);
    } else {
      idsToFetch.push(id);
    }
  }
  if (idsToFetch.length === 0) return map;

  try {
    // Clerk's SDK method takes no second (signal/options) argument, so
    // there's no way to actually cancel the underlying HTTP call — this
    // races it against a timeout instead. A "loses the race" Clerk call
    // isn't cancelled, it just keeps running in the background and its
    // result is discarded when it eventually lands; the point is bounding
    // how long *this* request waits, not stopping Clerk's own work.
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("clerk-lookup-timeout")), CLERK_LOOKUP_TIMEOUT_MS);
    });
    const { data: clerkUsers } = await Promise.race([
      clerkClient.users.getUserList({ userId: idsToFetch, limit: idsToFetch.length }),
      timeout,
    ]);

    for (const cu of clerkUsers) {
      const displayName = (cu.unsafeMetadata?.displayName as string | undefined)?.trim();
      const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim();
      const emailLocal = cu.emailAddresses?.[0]?.emailAddress?.split("@")[0];
      const name = displayName || fullName || emailLocal || FALLBACK_NAME;
      // Clerk always returns *some* imageUrl (a generated default when no
      // photo is uploaded) — passed through as-is, same field the mobile
      // client reads via user.imageUrl, rather than gating on hasImage.
      const identity: UserIdentity = { name, imageUrl: cu.imageUrl || null };
      map.set(cu.id, identity);
      identityCache.set(cu.id, { identity, expiresAt: now + CACHE_TTL_MS });
    }
    // ids that didn't resolve (deleted account, etc.) are simply absent
    // from the map — each call site falls back to FALLBACK_NAME at the
    // read site. Not cached: a genuinely deleted account should keep
    // getting a fresh check, not a 10-minute-stuck "not found".
  } catch (err) {
    // A timed-out or failed Clerk call degrades to FALLBACK_NAME for
    // whatever wasn't already cached, rather than failing (or hanging) the
    // whole request — the caller's UI shows "Investor" for anyone genuinely
    // new this round instead of never loading at all.
    logger.warn({ err, count: idsToFetch.length }, "fetchIdentities: Clerk lookup failed or timed out, falling back");
  }

  return map;
}
