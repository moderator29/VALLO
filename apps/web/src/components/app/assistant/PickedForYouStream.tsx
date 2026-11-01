import { resolveSession } from "@/lib/actions/session";
import { readAssistantState } from "@/lib/assistant/access";
import { cardFor } from "@/lib/assistant/cards";
import { computePicks } from "@/lib/assistant/tools/saved";
import { listingItemOf } from "@/lib/assistant/tools/listing-detail";
import { PickedRail } from "./PickedRail";

/**
 * Server side of the home rail. Shown ONLY to a member whose assistant is on
 * with discovery and saved_prefs granted; for everybody else it renders nothing
 * and reads nothing about them. Streamed behind a Suspense boundary so the home
 * never waits on it.
 */
export async function PickedForYouStream() {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const state = await readAssistantState(session.supabase);
  if (!state.enabled || !state.permissions.includes("discovery") || !state.permissions.includes("saved_prefs")) return null;
  const result = await computePicks(session.supabase, session.user.id, 5);
  if (result.state !== "ok") return null;
  const viewings = state.permissions.includes("bookings_viewings");
  return <PickedRail cards={result.picks.map((x) => cardFor(listingItemOf(x.listing), { reason: x.reason, viewings }))} />;
}
