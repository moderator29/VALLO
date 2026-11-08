import Link from "next/link";

import { CardRail, RoomCardView } from "@/components/roommates";
import { Section } from "@/components/app/Screen";
import { plural, type Dictionary, type Locale } from "@vallo/i18n";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { readMyActiveGroups, readRoomsForProperty } from "@/lib/features/roommates/queries";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { AddToGroupShortlist } from "./AddToGroupShortlist";

/**
 * VALLO ROOMMATES ON A PROPERTY (FE-B, 8 November 2026). A quiet link to
 * find roommates for this home (the post flow opens as "I have a place and
 * need a roommate", linked to this listing), the lister's own "good for
 * sharing" line when they set it (`listings.shared_living_ok` and
 * `max_occupants`, read defensively: before the roommate SQL those columns
 * are absent and the line is simply not drawn), and the live roommate posts
 * linked to this property. Streams on its own; never holds the page.
 */
export async function RoommatesForHome({ listingId, isDemo, copy, locale }: { listingId: string; isDemo: boolean; copy: Dictionary["roommates"]; locale: Locale }) {
  if (isDemo) return null;
  const E = copy.entryX;
  const [rooms, sharing, groups] = await Promise.all([readRoomsForProperty(listingId), readSharing(listingId), readMyActiveGroups()]);
  const line = sharing?.ok ? (sharing.max && sharing.max > 0 ? plural(sharing.max, E.sharingOk, locale) : E.sharingOkPlain) : null;
  return (
    <Section id="roommates" title={rooms.length ? E.listingSharing : E.listingFind} description={rooms.length ? E.listingSharingLine : undefined} divided className="scroll-mt-16">
      <div className="flex flex-wrap items-center gap-xs text-[length:var(--nf-text-body-sm)]" data-testid="listing-roommates">
        {line ? <span className="text-[var(--nf-content-secondary)]">{line}</span> : null}
        <Link href={`${ROOMMATES_ROUTES.create}?kind=roommate_wanted&listing=${encodeURIComponent(listingId)}`} className="nf-link">
          {E.listingFind}
        </Link>
        <AddToGroupShortlist
          listingId={listingId}
          groups={groups}
          words={{ open: copy.actions.addToShortlist, title: copy.hubX.connections.pickGroup, add: E.shortlistAdd, added: E.shortlistAdded }}
        />
      </div>
      {rooms.length ? (
        <div className="mt-sm">
          <CardRail testId="listing-roommates-rail">
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomCardView room={room} t={copy} />
              </li>
            ))}
          </CardRail>
        </div>
      ) : null}
    </Section>
  );
}

async function readSharing(listingId: string): Promise<{ ok: boolean; max: number | null } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const db = await createClient();
    const { data, error } = await (db as unknown as import("@supabase/supabase-js").SupabaseClient)
      .from("listings")
      .select("shared_living_ok,max_occupants")
      .eq("id", listingId)
      .maybeSingle();
    /* An absent column (the SQL not pasted yet) is the expected state: no line. */
    if (error || !data) return null;
    const row = data as unknown as { shared_living_ok: boolean | null; max_occupants: number | null };
    return { ok: row.shared_living_ok === true, max: row.max_occupants ?? null };
  } catch {
    return null;
  }
}
