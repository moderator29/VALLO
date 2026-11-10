import { Panel } from "@/components/ui/Panel";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Facts, OfferFigures } from "./OfferParts";
import { formatWhen, proposedDate } from "@/lib/offers/format";
import { NOTHING_CHARGED, NO_MONEY_TAKEN, PAYMENT_LABEL, WHAT_HAPPENS_NEXT_BUYER, holderLine, offerChip } from "@/lib/offers/words";
import { dealRoomHref } from "@/lib/offers/routes";
import type { DealRoom } from "@/lib/offers/types";
import "./offers.css";

/**
 * THE CONFIRMATION (the Deal Room opened with ?sent=1). A real page, not a
 * bounce back to the listing: the reference, the property, the figure, the
 * payment preference, the date, the status, who has it now, what happens next
 * in plain words, and two ways on. It says an offer was SENT, which is all that
 * has happened. Nothing was charged and nothing is agreed.
 */
export function OfferConfirmation({ room }: { room: DealRoom }) {
  const { offer } = room;
  const first = room.versions[0];
  return (
    <div className="grid gap-lg" data-testid="offer-confirmation">
      <header className="grid gap-xs">
        <span aria-hidden="true" className="text-[var(--nf-state-success)]">
          <UiIcon name="circle-check" size={40} />
        </span>
        <h2 className="nf-h2 text-[var(--nf-content-primary)]">Sent to the seller</h2>
        <p className="nf-lede text-[var(--nf-content-secondary)]">The seller has your offer. Nothing is agreed yet.</p>
      </header>
      <Panel variant="card" className="p-card">
        <OfferFigures amountMinor={first?.amountMinor ?? offer.amountMinor} askingMinor={offer.askingMinor} label="Your offer" atAskingPrice={first?.terms.atAskingPrice ?? false} />
        <div className="mt-md">
          <Facts
            items={[
              { label: "Reference", value: offer.reference },
              { label: "Property", value: offer.listingTitle },
              { label: "Payment", value: PAYMENT_LABEL[first?.terms.paymentPreference ?? offer.paymentPreference] },
              { label: "Closing", value: proposedDate(first?.terms.targetClosing ?? offer.targetClosing) },
              { label: "Sent", value: formatWhen(offer.submittedAt) },
              { label: "Status", value: offerChip(offer).word },
              { label: "Who has it now", value: holderLine(offer) },
            ]}
          />
        </div>
      </Panel>
      <section className="grid gap-xs" aria-labelledby="next-h">
        <h2 id="next-h" className="nf-section-label">
          What happens next
        </h2>
        <ul className="grid gap-xs pl-md nf-body text-[var(--nf-content-secondary)]" style={{ listStyle: "disc" }}>
          {WHAT_HAPPENS_NEXT_BUYER.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="nf-body-sm text-[var(--nf-content-muted)]">
          {NOTHING_CHARGED} {NO_MONEY_TAKEN}
        </p>
      </section>
      <div className="grid gap-sm sm:grid-cols-2">
        <ButtonLink href={dealRoomHref(offer.id)} variant="primary" size="lg" full data-testid="view-deal-room">
          View Deal Room
        </ButtonLink>
        <ButtonLink href={`/listing/${offer.listingId}`} variant="secondary" size="lg" full data-testid="return-to-property">
          Return to Property
        </ButtonLink>
      </div>
    </div>
  );
}
