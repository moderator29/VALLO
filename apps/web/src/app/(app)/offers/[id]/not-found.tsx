import { StateMoment } from "@/components/ui/StateMoment";
import { ButtonLink } from "@/components/ui/Button";

/** Same words for an offer that does not exist and one this member is not part of. */
export default function DealRoomNotFound() {
  return (
    <StateMoment
      kind="empty"
      inset
      title="We could not find that offer"
      body="It may have been removed, or it is not one of your offers."
      actions={
        <ButtonLink href="/offers" variant="primary" size="lg" full>
          Open my offers
        </ButtonLink>
      }
    />
  );
}
