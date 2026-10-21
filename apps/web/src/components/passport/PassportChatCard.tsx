import Link from "next/link";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { TierBadge } from "@/components/trust/TierBadge";
import { ButtonLink } from "@/components/ui/Button";
import type { PassportView } from "@/lib/passport/view";
import "./vallo-passport.css";

/**
 * THE PASSPORT AS A CARD IN A CHAT: photograph, name, role, join date,
 * verification level and the counts its owner shares. Tapping the card, or its
 * button, opens the full passport.
 *
 * It is drawn from the same view the document uses, so a line the owner
 * switched off is absent here too. Server-safe, and it holds no state: the
 * thread draws it in a bubble the way it draws a listing card.
 */
export type PassportChatCardData = {
  kind: "passport";
  /** The account the passport belongs to; the card opens `/passport/<id>`. */
  id: string;
  view: PassportView;
  /** The words the card needs, already in the reader's language. */
  copy: { title: string; open: string; joined: string };
};

export function passportHref(id: string): string {
  return `/passport/${id}`;
}

export function PassportChatCard({ card }: { card: PassportChatCardData }) {
  const { view, copy } = card;
  const counts = view.stats.filter((s) => s.figure);
  const joined = view.joined ? copy.joined.replace("{date}", view.joined) : null;
  return (
    <article className="nf-vpc" aria-label={`${copy.title}: ${view.name}`} data-testid="chat-card-passport">
      <Link href={passportHref(card.id)} className="nf-vpc__head" aria-label={`${copy.open}: ${view.name}`}>
        <span className="nf-vpc__photo">
          {view.photo ? (
            <RemoteImage src={view.photo} alt={view.photoAlt} width={78} height={104} sizes="52px" />
          ) : (
            <span aria-hidden="true">{view.initial}</span>
          )}
        </span>
        <span className="nf-vpc__who">
          <span className="nf-vpc__kind">{copy.title}</span>
          <span className="nf-vpc__name">{view.name}</span>
          {view.role ? <span className="nf-vpc__meta">{view.role}</span> : null}
          {joined ? <span className="nf-vpc__meta">{joined}</span> : null}
        </span>
      </Link>
      {view.level ? (
        <span className="nf-vpc__level" data-testid="chat-card-passport-level">
          {view.level.tier === "none" ? null : <TierBadge tier={view.level.tier} size={16} decorative />}
          {view.level.label}
        </span>
      ) : null}
      {counts.length > 0 ? (
        <ul className="nf-vpc__counts">
          {counts.map((stat) => (
            <li key={stat.key} className="nf-vpc__count">
              <strong>{stat.value}</strong>
              {stat.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="nf-vpc__action">
        <ButtonLink href={passportHref(card.id)} variant="secondary" size="sm" trailingIcon="arrow-right">
          {copy.open}
        </ButtonLink>
      </div>
    </article>
  );
}
