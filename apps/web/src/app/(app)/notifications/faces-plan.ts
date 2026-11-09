import { faceLookup, type FaceLookup } from "@/components/app/notify/banner-model";

/**
 * THE ACTIVITY CENTRE'S FACES, AS PURE STEPS (so they can be tested without a
 * database). `planFaces` reads each visible row's link with the banner's own
 * `faceLookup`, so a row and its banner show the same person, and batches
 * what must be fetched: conversations to resolve, handles to look up, and the
 * user ids a link names outright (`?from=<uuid>`, 8 November 2026).
 * `assignFaces` maps the answers back onto the rows.
 */
export type FaceRow = { id: string; href: string | null };
export type FacePlan = {
  lookups: { id: string; look: Exclude<FaceLookup, null> }[];
  threadIds: string[];
  handles: string[];
  userIds: string[];
};

export function planFaces(rows: readonly FaceRow[], limit: number): FacePlan {
  const lookups = rows
    .slice(0, limit)
    .map((n) => ({ id: n.id, look: faceLookup(n.href) }))
    .filter((x): x is { id: string; look: Exclude<FaceLookup, null> } => x.look !== null);
  const threadIds = new Set<string>();
  const handles = new Set<string>();
  const userIds = new Set<string>();
  for (const { look } of lookups) {
    if (look.by === "thread") threadIds.add(look.id);
    else if (look.by === "user") userIds.add(look.id);
    else handles.add(look.handle);
  }
  return { lookups, threadIds: [...threadIds], handles: [...handles], userIds: [...userIds] };
}

/** Row id to avatar, from the conversation owners, the avatars by user id and by handle. */
export function assignFaces(
  plan: FacePlan,
  threadPerson: ReadonlyMap<string, string>,
  avatarByUser: ReadonlyMap<string, string>,
  avatarByHandle: ReadonlyMap<string, string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const { id, look } of plan.lookups) {
    const url =
      look.by === "thread"
        ? avatarByUser.get(threadPerson.get(look.id) ?? "")
        : look.by === "user"
          ? avatarByUser.get(look.id)
          : avatarByHandle.get(look.handle);
    if (url) out.set(id, url);
  }
  return out;
}
