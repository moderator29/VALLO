import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { FollowButton } from "@/components/social/profile/FollowButton";
import { TierBadge } from "@/components/trust/TierBadge";
import { initial } from "@/lib/text/initial";
import type { BadgeTier } from "@/lib/trust/badge-tier";
import "./people-v2.css";

/** What the card's action is: a Follow for a person, a link for a hotel, "You" for the reader. */
export type CardAction =
  | { kind: "follow"; handle: string; following: boolean }
  | { kind: "view"; label: string; ariaLabel: string; href: string }
  | { kind: "you"; label: string };

export type PersonCardData = {
  key: string;
  href: string;
  name: string;
  /** Shown under the name when there is no role word. */
  handle: string | null;
  avatarUrl: string | null;
  tier: BadgeTier;
  /** The role word already translated: Landlord, Agent, Hotel. */
  roleWord: string | null;
  /** Lines of real facts, already formatted (a follower count, a deal count). */
  facts: string[];
  action: CardAction;
};

function Face({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <span className="nf-ppl-card__face" aria-hidden="true">
      {avatarUrl ? (
        <RemoteImage src={avatarUrl} alt="" width={128} height={128} sizes="64px" loading="lazy" />
      ) : (
        <span className="nf-ppl-card__monogram">{initial(name)}</span>
      )}
    </span>
  );
}

function Action({ action, signedIn }: { action: CardAction; signedIn: boolean }) {
  if (action.kind === "follow") {
    return <FollowButton handle={action.handle} initialFollowing={action.following} signedIn={signedIn} compact />;
  }
  if (action.kind === "view") {
    return (
      <ButtonLink href={action.href} size="sm" variant="secondary" aria-label={action.ariaLabel}>
        {action.label}
      </ButtonLink>
    );
  }
  return <span className="nf-ppl-card__you">{action.label}</span>;
}

/**
 * One profile card in a sideways row: a round face, the name with the
 * published badge, the role word, the real facts under it and an action. The
 * whole card opens the profile (a link laid under the card); the action keeps
 * its own tap above it.
 */
export function PersonCard({
  card,
  signedIn,
  openLabel,
}: {
  card: PersonCardData;
  signedIn: boolean;
  /** "Open {name}", already filled. */
  openLabel: string;
}) {
  return (
    <li className="nf-ppl-card" data-testid="person-card">
      <Link href={card.href} className="nf-ppl-card__open" aria-label={openLabel} />
      <Face name={card.name} avatarUrl={card.avatarUrl} />
      <span className="nf-ppl-card__name">
        <span>{card.name}</span>
        {card.tier !== "none" ? <TierBadge tier={card.tier} size={14} /> : null}
      </span>
      {card.roleWord ? (
        <span className="nf-ppl-card__role">{card.roleWord}</span>
      ) : card.handle ? (
        <span className="nf-ppl-card__handle">@{card.handle}</span>
      ) : null}
      <span className="nf-ppl-card__facts">
        {card.facts.map((line) => (
          <span key={line} className="nf-numeric">
            {line}
          </span>
        ))}
      </span>
      <span className="nf-ppl-card__act">
        <Action action={card.action} signedIn={signedIn} />
      </span>
    </li>
  );
}

/** The same person as a row of a vertical list: the people to follow, and a search's results. */
export function PersonRowItem({
  card,
  signedIn,
  openLabel,
}: {
  card: PersonCardData;
  signedIn: boolean;
  openLabel: string;
}) {
  return (
    <li className="nf-ppl__rowitem" data-testid="person-row">
      <Link href={card.href} className="nf-ppl-card__open" aria-label={openLabel} />
      <Face name={card.name} avatarUrl={card.avatarUrl} />
      <span className="nf-ppl__who">
        <span className="nf-ppl-card__name">
          <span>{card.name}</span>
          {card.tier !== "none" ? <TierBadge tier={card.tier} size={14} /> : null}
        </span>
        <span className="nf-ppl-card__handle">
          {[card.roleWord, card.handle ? `@${card.handle}` : null, ...card.facts].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="nf-ppl-card__act">
        <Action action={card.action} signedIn={signedIn} />
      </span>
    </li>
  );
}
