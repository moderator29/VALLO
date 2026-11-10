import { StateMoment } from "@/components/ui/StateMoment";
import { ButtonLink } from "@/components/ui/Button";

/** A listing that cannot take an offer from this member: one sentence and the way back. */
export function CannotOffer({ listingHref, reason }: { listingHref: string; reason: string }) {
  return (
    <div className="nf-visit">
      <StateMoment
        kind="empty"
        inset
        title="You cannot offer on this property"
        body={reason}
        actions={
          <ButtonLink href={listingHref} variant="primary" size="lg" full>
            Return to property
          </ButtonLink>
        }
      />
    </div>
  );
}
