import { getDictionary } from "@vallo/i18n";
import { assistantCopyOf } from "@/components/app/assistant/assistant-copy";
import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { readAssistantViewer } from "@/lib/assistant/viewer";
import { AssistantChat } from "@/components/app/assistant/AssistantChat";
import { aiConsentForViewer } from "@/lib/ai/consent-server";
import { resolveSession } from "@/lib/actions/session";
import { readAssistantState } from "@/lib/assistant/access";
import { computePicks } from "@/lib/assistant/tools/saved";
import { cardFor } from "@/lib/assistant/cards";
import { listingItemOf } from "@/lib/assistant/tools/listing-detail";
import type { AssistantCard } from "@/lib/assistant/types";

export const metadata: Metadata = { title: "Vallo AI" };

/**
 * AI Assistant destination.
 *
 * A thin server shell: the route is immersive, so `AssistantChat` carries the
 * whole surface, its own bar included, and the thread, the side navigation
 * and the composer all hydrate together.
 *
 * The one fact read here is who is asking, for the mark beside their own
 * bubbles (`readAssistantViewer`, shared with the workspace assistants).
 */
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  /* The locale is read here rather than inside the client component: a rating
     or a price in the assistant's result cards must group its digits the same
     way as the same figure on the search page. */
  const [locale, viewer] = await Promise.all([getLocale(), readAssistantViewer()]);
  /* What the member has allowed, from the database. The rail and the banner exist only for a member
     whose assistant is on; "Picked for you" needs discovery and saved_prefs. */
  let privateAccess = false;
  let picks: AssistantCard[] = [];
  const session = await resolveSession();
  if (session.state === "signed-in") {
    const state = await readAssistantState(session.supabase);
    privateAccess = state.enabled && state.permissions.some((p) => p !== "discovery");
    if (state.enabled && state.permissions.includes("discovery") && state.permissions.includes("saved_prefs")) {
      const result = await computePicks(session.supabase, session.user.id, 5);
      if (result.state === "ok") {
        const viewings = state.permissions.includes("bookings_viewings");
        picks = result.picks.map((x) => cardFor(listingItemOf(x.listing), { reason: x.reason, viewings }));
      }
    }
  }
  return (
    <AssistantChat
      locale={locale}
      viewer={viewer}
      privateAccess={privateAccess}
      picks={picks}
      aiConsented={await aiConsentForViewer()}
      t={assistantCopyOf(getDictionary(locale))}
    />
  );
}
