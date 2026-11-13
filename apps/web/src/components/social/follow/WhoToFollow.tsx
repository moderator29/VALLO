import Link from "next/link";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { FollowButton } from "@/components/social/profile/FollowButton";
import { TierBadge } from "@/components/trust/TierBadge";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { initial } from "@/lib/text/initial";
import type { FollowKind, FollowSuggestion } from "@/lib/social/follow-suggestions";

/** The word a member reads for each kind, singular, on a row. */
export const FOLLOW_KIND_WORD: Record<FollowKind, string> = {
  agent: "Agent",
  agency: "Agency",
  landlord: "Landlord",
  hotel: "Hotel",
  restaurant: "Restaurant",
};

/**
 * ONE ACCOUNT TO FOLLOW: face, name with the verified mark, the kind of
 * account and where its work is, and a compact Follow capsule. The same row
 * in the feed's block and on the social search page. The whole row opens the
 * profile; Follow keeps its own tap.
 */
export function FollowRow({ person, signedIn }: { person: FollowSuggestion; signedIn: boolean }) {
  return (
    <li className="nf-follow-row">
      <Link href={`/u/${person.handle}`} className="nf-follow-row__open" aria-label={`Open ${person.displayLabel}`} />
      <span className="nf-follow-row__face" aria-hidden="true">
        {person.avatarUrl ? (
          <RemoteImage src={person.avatarUrl} alt="" width={88} height={88} sizes="44px" loading="lazy" />
        ) : (
          initial(person.displayLabel)
        )}
      </span>
      <span className="nf-follow-row__text">
        <span className="nf-follow-row__name">
          <span className="truncate">{person.displayLabel}</span>
          {person.tier !== "none" ? <TierBadge tier={person.tier} size={12} /> : null}
        </span>
        <span className="nf-follow-row__meta">
          {FOLLOW_KIND_WORD[person.kind]}
          {person.city ? <> &middot; {person.city}</> : null}
        </span>
      </span>
      <span className="nf-follow-row__act">
        <FollowButton handle={person.handle} initialFollowing={false} signedIn={signedIn} compact />
      </span>
    </li>
  );
}

/**
 * WHO TO FOLLOW, VALLO'S WAY (the founder, 7 October: "mostly top agents,
 * landlords, hotels and restaurants in the member's vicinity").
 *
 * Not X's card: a calm block in the feed's own material, a title that says
 * where ("Around Lagos" only when the member's place says Lagos; "On Vallo"
 * otherwise, never a guessed city), three rows, and "Show more" into the
 * social search with the same scope. Absent when there is nobody to suggest.
 */
export function WhoToFollow({
  people,
  city,
  signedIn,
  more,
}: {
  people: FollowSuggestion[];
  city: string | null;
  signedIn: boolean;
  more: boolean;
}) {
  if (people.length === 0) return null;
  const href = city ? `/around/people?city=${encodeURIComponent(city)}` : "/around/people?scope=global";
  return (
    <section className="nf-follow" aria-labelledby="nf-follow-title">
      <header className="nf-follow__head">
        <h2 id="nf-follow-title" className="nf-follow__title">
          {city ? `Worth following around ${city}` : "Worth following on Vallo"}
        </h2>
        <p className="nf-follow__note">Agents, landlords, hotels and restaurants with published work.</p>
      </header>
      <ul className="nf-follow__list">
        {people.map((person) => (
          <FollowRow key={person.userId} person={person} signedIn={signedIn} />
        ))}
      </ul>
      {more ? (
        <Link href={href} className="nf-follow__more">
          Show more
          <UiIcon name="chevron-right" size={12} />
        </Link>
      ) : null}
    </section>
  );
}

/**
 * THE DESKTOP'S RIGHT RAIL: the same people the feed's block offers, in one
 * quiet box beside the 600px column, with "See all" into the people page.
 * Absent when there is nobody to suggest.
 */
export function PeopleRail({
  people,
  signedIn,
  title,
  seeAll,
}: {
  people: FollowSuggestion[];
  signedIn: boolean;
  title: string;
  seeAll: string;
}) {
  if (people.length === 0) return null;
  return (
    <div className="nf-fv2-rail__box" data-testid="people-rail">
      <div className="nf-fv2-rail__head">
        <h2 className="nf-fv2-rail__title">{title}</h2>
        <Link href="/around/people" className="nf-fv2-rail__all nf-section-action">
          {seeAll}
        </Link>
      </div>
      <ul className="nf-fv2-rail__list">
        {people.map((person) => (
          <FollowRow key={person.userId} person={person} signedIn={signedIn} />
        ))}
      </ul>
    </div>
  );
}
