import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDictionary } from "@vallo/i18n";

import { resolveSession } from "@/lib/actions/session";
import { readRoomListing, readRoommateProfile } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";
import type { SavedCollection } from "@/lib/saved/collections";

import { RoomCardView, RoommateCardView } from "./Cards";
import { lagosDay } from "./format";
import { CardGrid, SectionHead } from "./Home";
import "./roommates-kit.css";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 24;

/**
 * THE ROOMMATES SHELF ON /saved (server only; not in the kit's index, which
 * client islands import). The account's saved roommate posts and profiles,
 * from `saved_places` (kinds `roommate_listing` and `roommate_profile`), each
 * read through the same database function its page uses, so a post that was
 * paused, removed or blocked simply does not come back. Nothing is drawn when
 * there is nothing saved, or while the roommate SQL is not applied.
 *
 * `listFor` is the page's own "Add to a list" control for a kind and an id
 * (the universal collections), so these join the same lists as every other
 * saved thing; `onlyKeys` is the open list's members, when one is open.
 */
export async function SavedRoommates({
  listFor,
  onlyKeys,
}: {
  listFor?: (kind: "roommate_listing" | "roommate_profile", id: string) => ReactNode;
  onlyKeys?: SavedCollection["keys"] | null;
}) {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const db = session.supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from("saved_places")
    .select("entity_kind, entity_id, created_at")
    .eq("user_id", session.user.id)
    .in("entity_kind", ["roommate_listing", "roommate_profile"])
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error || !data?.length) return null;
  const keep = onlyKeys ? new Set(onlyKeys) : null;
  const rows = (data as { entity_kind: string; entity_id: string }[]).filter(
    (r) => UUID_RE.test(r.entity_id) && (!keep || keep.has(`${r.entity_kind}:${r.entity_id}`)),
  );
  const [rooms, people] = await Promise.all([
    Promise.all(rows.filter((r) => r.entity_kind === "roommate_listing").map((r) => readRoomListing(r.entity_id))),
    Promise.all(rows.filter((r) => r.entity_kind === "roommate_profile").map((r) => readRoommateProfile(r.entity_id))),
  ]);
  const roomCards = rooms.flatMap((r) => (r.state === "ok" ? [r.listing] : []));
  const personCards = people.flatMap((p) => (p.state === "ok" ? [p.profile] : []));
  if (!roomCards.length && !personCards.length) return null;

  const copy = getDictionary("en").roommates;
  const today = lagosDay(requestNow());
  return (
    <section className="nf-rm-section mt-section" aria-labelledby="saved-roommates" data-testid="saved-roommates">
      <SectionHead id="saved-roommates" title={copy.title} more="/roommates" moreLabel={copy.ui.seeAll} />
      {roomCards.length ? (
        <CardGrid kind="rooms" testId="saved-roommate-rooms">
          {roomCards.map((r) => (
            <li key={r.id}>
              <RoomCardView room={r} t={copy} today={today} action={listFor?.("roommate_listing", r.id)} />
            </li>
          ))}
        </CardGrid>
      ) : null}
      {personCards.length ? (
        <CardGrid testId="saved-roommate-people">
          {personCards.map((p) => (
            <li key={p.userId}>
              <RoommateCardView card={p} t={copy} action={listFor?.("roommate_profile", p.userId)} />
            </li>
          ))}
        </CardGrid>
      ) : null}
    </section>
  );
}
