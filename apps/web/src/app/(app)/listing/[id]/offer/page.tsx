import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveSession } from "@/lib/actions/session";
import { getOfferGate } from "@/lib/offers/queries";
import { dealRoomHref } from "@/lib/offers/routes";
import { OfferFlow } from "@/components/app/offers/OfferFlow";
import { CannotOffer } from "@/components/app/offers/CannotOffer";

export const metadata: Metadata = { title: "Make an offer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * MAKE AN OFFER (`/listing/[id]/offer`). Signed in only: a signed-out reader is
 * sent to sign in and brought back. The server decides whether the offer can be
 * made at all (the gate); the screen only presents it. A member who already has
 * a live offer goes to its Deal Room instead of being offered a second one.
 * Nothing on this route charges anything.
 */
export default async function MakeOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const here = `/listing/${id}`;
  const session = await resolveSession();
  if (session.state !== "signed-in") redirect(`/sign-in?next=${encodeURIComponent(`${here}/offer`)}`);

  const gate = await getOfferGate(id);
  if (!gate) notFound();
  if (gate.existingOfferId) redirect(dealRoomHref(gate.existingOfferId));

  /* A reason that is not about the member's own requirements ends here with one
     plain sentence. An unmet requirement keeps the form visible instead. */
  if (!gate.canOffer && gate.eligibility.eligible) {
    return <CannotOffer listingHref={here} reason={gate.reason ?? "You cannot make an offer on this property right now."} />;
  }

  return (
    <OfferFlow
      listingId={gate.listingId}
      listingTitle={gate.listingTitle}
      price={gate.price}
      eligibility={gate.eligibility}
      mandate={gate.mandate}
      canOffer={gate.canOffer}
      reason={gate.reason}
    />
  );
}
