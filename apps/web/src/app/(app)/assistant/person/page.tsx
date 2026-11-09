import type { Metadata } from "next";
import { PageHeader } from "@/components/app/PageHeader";
import { PersonHandoff, type OpenTicket } from "@/components/app/assistant/PersonHandoff";
import { resolveSession } from "@/lib/actions/session";
import { loadMyTickets } from "@/lib/support/my-tickets";

export const metadata: Metadata = { title: "Talk to a person" };
export const dynamic = "force-dynamic";

/**
 * TALK TO A PERSON, AS AN INNER PAGE OF THE ASSISTANT (Platform Grade 1,
 * P1.4; reference R70: the support conversation is reached from inside the
 * assistant, which the inbox pins first).
 *
 * The page's back goes to wherever the member came from (the assistant, in
 * the ordinary case) and falls back to `/assistant` when opened cold. The
 * member's own open support conversations are read here under their own RLS
 * (`loadMyTickets`), so one still open can be continued rather than filed
 * again; the hand-over itself is `PersonHandoff`.
 */
export default async function AssistantPersonPage() {
  const session = await resolveSession();
  const signedIn = session.state === "signed-in";
  const tickets = signedIn ? await loadMyTickets(20) : null;
  const open: OpenTicket[] =
    tickets?.state === "ok"
      ? tickets.tickets
          .filter((t) => t.status !== "resolved" && t.status !== "closed")
          .slice(0, 3)
          .map((t) => ({ id: t.id, reference: t.reference, topic: t.topic, unread: t.unread }))
      : [];

  return (
    <div className="mx-auto max-w-2xl pb-[env(safe-area-inset-bottom)]">
      <PageHeader title="Talk to a person" subtitle="The Vallo support team" fallback="/assistant" />
      <PersonHandoff signedIn={signedIn} openTickets={open} />
    </div>
  );
}
