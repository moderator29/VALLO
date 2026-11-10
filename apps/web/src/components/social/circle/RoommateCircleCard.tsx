import Link from "next/link";
import { getDictionary } from "@vallo/i18n";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { cardHref, type CircleRoommateCard } from "@/lib/features/circle/roommate-card";

import "./circle-visuals.css";

/**
 * THE ROOMMATES CARD IN A CIRCLE POST (founder, 10 November 2026). A calm
 * card: where it is from, the title or first name, the area, what is on offer
 * or wanted, and the way through to the real page. Nothing else is stored or
 * drawn: no photograph, no handle, no contact. In a feed list the whole post
 * is already a link, so there it is drawn as a plain block (`link={false}`);
 * in the thread it is its own link.
 */
export function RoommateCircleCard({ card, link = true }: { card: CircleRoommateCard; link?: boolean }) {
  const w = getDictionary("en").roommates.circleShare;
  const body = (
    <>
      <span className="nf-crmc__glyph" aria-hidden="true">
        <UiIcon name={card.kind === "room" ? "house-duplex" : "users"} size={20} />
      </span>
      <span className="nf-crmc__words">
        <span className="nf-crmc__kicker">{w.cardKicker}</span>
        <span className="nf-crmc__title">{card.title}</span>
        {card.place ? <span className="nf-crmc__place">{card.place}</span> : null}
        {card.summary ? <span className="nf-crmc__summary">{card.summary}</span> : null}
        {link ? <span className="nf-crmc__cta">{card.kind === "room" ? w.viewRoom : w.viewPerson}</span> : null}
      </span>
      {link ? <UiIcon name="chevron-right" size={18} /> : null}
    </>
  );
  return link ? (
    <Link href={cardHref(card)} className="nf-crmc" data-testid="circle-roommate-card" data-kind={card.kind}>
      {body}
    </Link>
  ) : (
    <div className="nf-crmc nf-crmc--plain" data-testid="circle-roommate-card" data-kind={card.kind}>
      {body}
    </div>
  );
}
