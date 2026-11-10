import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageFrame } from "@/components/app/PageFrame";
import { DealRoomView } from "@/components/app/deal-room/DealRoomView";
import { parseTab } from "@/components/app/deal-room/model";
import { OfferConfirmation } from "@/components/app/offers/OfferConfirmation";
import { resolveSession } from "@/lib/actions/session";
import { requestNow } from "@/lib/format/when";
import { getDealRoom } from "@/lib/offers/queries";
import { readDealThread } from "@/lib/offers/thread";
import { dealRoomHref } from "@/lib/offers/routes";

export const metadata: Metadata = { title: "Deal Room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE DEAL ROOM (`/offers/[id]`) for either side. A stranger gets the same
 * not-found as an offer that does not exist: the read returns null for anyone
 * who is not a party, so the page never confirms an offer exists. `?sent=1`
 * after sending shows the confirmation first, for the buyer only.
 */
export default async function DealRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; sent?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await resolveSession();
  if (session.state !== "signed-in") redirect(`/sign-in?next=${encodeURIComponent(dealRoomHref(id))}`);
  const room = await getDealRoom(id);
  if (!room) notFound();

  const thread = await readDealThread(session.supabase, room.conversationId, session.user.id);
  const sent = (Array.isArray(query.sent) ? query.sent[0] : query.sent) === "1" && room.viewerSide === "buyer";
  if (sent) {
    return (
      <main className="nf-page nf-md">
        <PageFrame title="Offer sent" back={false} width="narrow">
          <OfferConfirmation room={room} />
        </PageFrame>
      </main>
    );
  }
  return (
    <main className="nf-page nf-md">
      <PageFrame title="Deal Room" fallback="/offers" width="wide">
        <DealRoomView room={room} nowMs={requestNow()} initialTab={parseTab(query.tab)} thread={thread} />
      </PageFrame>
    </main>
  );
}
