import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Suspense } from "react";

import type { Dictionary } from "@vallo/i18n";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * "YOU MATCHED ON VALLO ROOMMATES" (8 November 2026). A quiet line at the top
 * of a direct chat between two people with an accepted roommate connection,
 * with View profile, and View listing and Schedule viewing when the interest
 * was about a post. Read defensively from `roommate_interests` under its own
 * policy (only the two parties see the row): before the roommate SQL is
 * pasted the table is absent and nothing is drawn. Streams on its own.
 */
export function RoommateMatch(props: { conversationId: string; meId: string | null; otherId: string | null; copy: Dictionary["roommates"]["entryX"] }) {
  if (!props.meId || !props.otherId) return null;
  return (
    <Suspense fallback={null}>
      <MatchLine {...props} meId={props.meId} otherId={props.otherId} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function MatchLine({ conversationId, meId, otherId, copy }: { conversationId: string; meId: string; otherId: string; copy: Dictionary["roommates"]["entryX"] }) {
  if (!isSupabaseConfigured() || ![conversationId, meId, otherId].every((x) => UUID.test(x))) return null;
  let listingId: string | null = null;
  try {
    const db = (await createClient()) as unknown as SupabaseClient;
    const { data, error } = await db
      .from("roommate_interests")
      .select("listing_id")
      .eq("status", "accepted")
      .or(`conversation_id.eq.${conversationId},and(from_id.eq.${meId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${meId})`)
      .order("decided_at", { ascending: false })
      .limit(1);
    /* An absent table (the SQL not pasted yet) or no connection: no line. */
    if (error || !data?.length) return null;
    listingId = (data[0] as { listing_id: string | null }).listing_id;
  } catch {
    return null;
  }
  return (
    <aside className="nf-panel nf-panel--card mx-md mt-sm flex flex-wrap items-center gap-xs p-sm text-[length:var(--nf-text-caption)]" aria-label={copy.chatLabel} data-testid="thread-roommate-match">
      <span className="font-semibold text-[var(--nf-content-primary)]">{copy.chatMatched}</span>
      <Link href={ROOMMATES_ROUTES.person(otherId)} className="nf-link">
        {copy.chatViewProfile}
      </Link>
      {listingId ? (
        <>
          <Link href={ROOMMATES_ROUTES.listing(listingId)} className="nf-btn nf-btn--sm nf-btn--glass">
            {copy.chatViewListing}
          </Link>
          <Link href={`${ROOMMATES_ROUTES.listing(listingId)}?viewing=1`} className="nf-btn nf-btn--sm nf-btn--glass">
            {copy.chatScheduleViewing}
          </Link>
        </>
      ) : null}
    </aside>
  );
}
