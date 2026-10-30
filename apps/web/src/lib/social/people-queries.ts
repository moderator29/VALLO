import "server-only";

/**
 * Finding a person.
 *
 * **`/u/[handle]` answered for every handle and nothing answered for none of
 * them.** A handle was reachable only if you already knew it, which made the
 * follow graph a feature you could only use on people you had already met, and
 * it is the same criticism `SOCIAL_DESIGN.md` levelled at the follow graph it
 * originally cut. Every profile link on the platform assumed you already knew
 * the name.
 *
 * **Two ways in: a name or a handle.** Occupation and place used to be two
 * more, searched for everybody; they are a member's own facts and are shown
 * only where that member published them (V-64), and searched by nobody.
 *
 * **`citext` is not installed**, and this is exactly where that bites. Every
 * comparison here is `ilike`, on the profile columns and on both reference
 * tables, rather than an equality that would quietly find only the people who
 * typed their name the way you did.
 *
 * **There is no block check here and there must not be.**
 * `social_profiles_select` carries `not private.blocked_with(user_id)`, so
 * anybody a block touches in either direction is already absent from every
 * answer below. A second check would be a second place for it to be wrong.
 *
 * Nothing here throws. A directory that 500s because one reference lookup was
 * slow is worse than one that is briefly short.
 */

import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { resolveSession } from "../actions/session";
import { passportNumber } from "../passport/identity";
import { readPersonBadges, type BadgeTier } from "../trust/badge-tier";

export type PersonRow = {
  userId: string;
  handle: string;
  displayLabel: string;
  avatarUrl: string;
  /** A role marker, never an earned badge. It draws no mark. */
  isAgent: boolean;
  /** The side of that account (`social_profiles.supply_role`): a landlord or an agent, or null. */
  supplyRole: "owner" | "agent" | null;
  /** The published badge. The only thing a mark may be drawn from. */
  badgeTier: BadgeTier;
  bio: string;
  /** What they do, when they have said. Never a dash when they have not. */
  occupation: string | null;
  /** Where they are, as far as it is known. "Ikeja, Lagos", or "Lagos". */
  place: string | null;
  viewerFollows: boolean;
  isViewer: boolean;
};

export type PeopleDirectory =
  | { state: "unconfigured" }
  | {
      state: "ready";
      signedIn: boolean;
      /** What was searched for, echoed back so the page can say so. */
      query: string;
      /** Which routes actually matched, so the page can say why these people. */
      matchedOn: "name"[];
      people: PersonRow[];
    };

const LIMIT = 30;
/** How many members a passport-number search compares against. */
const CODE_SCAN = 5000;
/** "V" and eight characters from the passport alphabet (see `passportNumber`). */
const PASSPORT_CODE = /^V[0-9A-HJ-NP-Z]{8}$/;

/**
 * PostgREST's `or` filter is a comma separated expression, so a comma or a
 * bracket in the search text would change its meaning rather than be matched,
 * and `%` and `_` are the same problem one level down inside `ilike`.
 */
function safePattern(raw: string): string {
  return raw
    .replace(/[%_,()\\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findPeople(rawQuery: string): Promise<PeopleDirectory> {
  if (!isSupabaseConfigured()) return { state: "unconfigured" };

  const session = await resolveSession();
  const supabase = session.state === "signed-in" ? session.supabase : await createClient();
  const viewerId = session.state === "signed-in" ? session.user.id : null;
  /* A leading @ is how people write a username ("@ada"): it is the same search. */
  const query = rawQuery.trim().replace(/^@+/, "").slice(0, 40);
  const pattern = safePattern(query);

  const nobody = (): PeopleDirectory => ({
    state: "ready",
    signedIn: Boolean(viewerId),
    query,
    matchedOn: [],
    people: [],
  });

  try {
    /*
     * NAMES AND HANDLES ONLY (V-64 review fix). This used to read the
     * occupation, local government and state codes for every member from
     * `social_profiles`, print them on each row and match people BY them,
     * while the member's own settings said those facts were theirs alone
     * unless switched on. The codes are no longer selected or matched here;
     * each row's occupation and place come from `profile_public_facts_many`,
     * which returns a name only for a field its member published.
     */
    const columns = "user_id, handle, display_label, avatar_path, is_agent, supply_role, bio, bio_status";

    const asCode = query.toUpperCase();
    const isCode = PASSPORT_CODE.test(asCode);
    let read = supabase.from("social_profiles").select(columns).limit(isCode ? CODE_SCAN : LIMIT);

    if (isCode) {
      /* A Vallo passport number is derived from the member id, not stored, so
         it cannot be an `ilike`. The directory is already limited to what
         `social_profiles_select` lets this caller see (blocks removed), and the
         number is compared exactly, so a code finds only its own member. */
      read = read.order("handle_claimed_at", { ascending: false });
    } else if (pattern) {
      /* The typed text appears only as an `ilike` value that `safePattern`
         has already stripped of the characters PostgREST reads as structure. */
      read = read.or(`handle.ilike.%${pattern}%,display_label.ilike.%${pattern}%`).order("handle");
    } else {
      /* Newest first when nothing is typed, rather than most followed. A
         leaderboard of the best connected accounts entrenches itself, and the
         people worth meeting in a neighbourhood product are the ones who have
         just arrived in it. */
      read = read.order("handle_claimed_at", { ascending: false });
    }

    const { data, error } = await read;
    if (error || !data) return nobody();

    const rows = data as {
      user_id: string;
      handle: string;
      display_label: string | null;
      avatar_path: string | null;
      is_agent: boolean;
      supply_role: string | null;
      bio: string | null;
      bio_status: string | null;
    }[];
    if (isCode) {
      const hit = rows.filter((row) => passportNumber(row.user_id) === asCode);
      if (hit.length === 0) return nobody();
      rows.splice(0, rows.length, ...hit);
    }
    if (rows.length === 0) return nobody();
    /* The person whose @username is exactly what was typed comes first, then
       handles that start with it, then names that do: a search for "@ada"
       puts Ada at the top instead of somebody whose handle merely contains it. */
    if (pattern) {
      const q = pattern.toLowerCase();
      const rank = (row: { handle: string; display_label: string | null }) =>
        row.handle === q ? 0 : row.handle.startsWith(q) ? 1 : (row.display_label ?? "").toLowerCase().startsWith(q) ? 2 : 3;
      rows.sort((x, y) => rank(x) - rank(y) || x.handle.localeCompare(y.handle));
    }

    const ids = rows.map((row) => row.user_id);
    const [published, badges] = await Promise.all([
      readPublishedMany(supabase, ids),
      /* The published badge for everybody on this page, in one read. */
      readPersonBadges(supabase, ids),
    ]);

    /* One read for the whole page rather than one per row. `follows_select` is
       public, so this is the truth rather than a guess each button has to
       hold. */
    const following = new Set<string>();
    if (viewerId) {
      const { data: mine } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewerId)
        .in("followee_id", ids);
      for (const row of (mine ?? []) as { followee_id: string }[]) following.add(row.followee_id);
    }

    return {
      state: "ready",
      signedIn: Boolean(viewerId),
      query,
      matchedOn: pattern ? ["name"] : [],
      people: rows.map((row) => {
        const facts = published.get(row.user_id);
        return {
          userId: row.user_id,
          handle: row.handle,
          displayLabel: row.display_label || `@${row.handle}`,
          avatarUrl: row.avatar_path ?? "",
          isAgent: row.is_agent,
          supplyRole: row.supply_role === "owner" ? "owner" : row.supply_role === "agent" ? "agent" : null,
          badgeTier: badges.get(row.user_id) ?? "none",
          /* A bio the scanner is holding is shown to nobody but its author, and
             a directory is nobody's own page. */
          bio: row.bio_status === "HELD" ? "" : (row.bio ?? ""),
          occupation: facts?.occupation ?? null,
          place: facts?.place ?? null,
          viewerFollows: following.has(row.user_id),
          isViewer: row.user_id === viewerId,
        };
      }),
    };
  } catch {
    return nobody();
  }
}

/**
 * What each member on the page PUBLISHED, and nothing else: a name only for a
 * field its member switched on. A read that fails (a database without the
 * function) shows nobody's occupation or place, never everybody's.
 */
async function readPublishedMany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, { occupation: string | null; place: string | null }>> {
  const out = new Map<string, { occupation: string | null; place: string | null }>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await (
      supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: unknown; error: unknown }> }
    ).rpc("profile_public_facts_many", { p_users: ids });
    if (error || !Array.isArray(data)) return out;
    for (const row of data as { user_id: string; occupation: string | null; lga: string | null; state: string | null }[]) {
      /* Never a fragment and never a dangling comma. */
      const place = [row.lga, row.state].filter(Boolean).join(", ") || null;
      out.set(row.user_id, { occupation: row.occupation ?? null, place });
    }
  } catch {
    /* Nobody's facts is the honest answer to a read that failed. */
  }
  return out;
}
