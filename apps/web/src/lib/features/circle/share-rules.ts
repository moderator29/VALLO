/**
 * WHO MAY SHARE INTO WHICH CIRCLE (the pure half). The database holds the
 * real rules (`private.circle_place_post`: the community is live and the
 * author is an active member); this mirrors them so the sheet only offers a
 * Circle the post can actually land in, and the action refuses early with a
 * plain sentence. Circle has no ban list or read-only state of its own: a
 * removed member loses the membership row, a paused or removed community is
 * not live, and a request to join is not yet a membership.
 */
export type ShareMembership = { status: string; role: string } | null;
export type ShareCommunity = { status: string };

export type ShareRefusal = "not_member" | "not_live";

export function postingRefusal(membership: ShareMembership, community: ShareCommunity | null): ShareRefusal | null {
  if (!community || community.status !== "live") return "not_live";
  if (!membership || membership.status !== "active") return "not_member";
  return null;
}

export type ShareableCircle = { id: string; slug: string; name: string; category: string; visibility: "public" | "private" };

/** Memberships joined to their community, narrowed to the Circles a post can land in, by name. */
export function shareableCircles(
  rows: readonly { status: string; role: string; community: (ShareCommunity & ShareableCircle) | null }[],
): { circles: ShareableCircle[]; memberOf: number } {
  const active = rows.filter((r) => r.status === "active" && r.community);
  const circles = active
    .filter((r) => postingRefusal(r, r.community) === null)
    .map((r) => ({ id: r.community!.id, slug: r.community!.slug, name: r.community!.name, category: r.community!.category, visibility: r.community!.visibility }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { circles, memberOf: active.length };
}
