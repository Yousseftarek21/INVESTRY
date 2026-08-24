import { clerkClient } from "@clerk/express";

export interface UserIdentity { name: string; imageUrl: string | null }

export const FALLBACK_NAME = "Investor";

// Batch-fetches display identity for up to 500 Clerk user IDs in ONE call —
// shared by the portfolio leaderboard (competition.ts) and the referral
// leaderboard (referral.ts), so both show a person under exactly the same
// name/photo Settings and Home already show them under.
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

  const { data: clerkUsers } = await clerkClient.users.getUserList({
    userId: uniqueIds,
    limit: uniqueIds.length,
  });

  for (const cu of clerkUsers) {
    const displayName = (cu.unsafeMetadata?.displayName as string | undefined)?.trim();
    const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim();
    const emailLocal = cu.emailAddresses?.[0]?.emailAddress?.split("@")[0];
    const name = displayName || fullName || emailLocal || FALLBACK_NAME;
    // Clerk always returns *some* imageUrl (a generated default when no
    // photo is uploaded) — passed through as-is, same field the mobile
    // client reads via user.imageUrl, rather than gating on hasImage.
    map.set(cu.id, { name, imageUrl: cu.imageUrl || null });
  }

  // ids that didn't resolve (deleted account, etc.) are simply absent from
  // the map — each call site falls back to FALLBACK_NAME at the read site.
  return map;
}
