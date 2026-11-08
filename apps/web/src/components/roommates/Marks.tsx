import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { BadgeKind, Lifestyle, ListingKind, MatchView, PersonRef } from "@/lib/features/roommates/model";
import { initial } from "@/lib/text/initial";

import { BADGE_ICON, fill, lifestyleFacts, type RoommatesCopy } from "./format";
import "./roommates-kit.css";

/**
 * VALLO ROOMMATES, THE SMALL MARKS. Server safe (no state, no effects), so a
 * server page draws them with no client cost and a client island can draw
 * them too. Every word arrives in `t`, the `roommates` slice of the
 * dictionary.
 *
 *   PersonFace     a member's real photograph, or their initial on the brand
 *                  ink; never an invented face
 *   FaceStack      up to four real faces, overlapping
 *   MatchRing      the compatibility figure as a ring; null draws no number
 *   MatchBadge     the same figure as a compact chip for a card
 *   MatchReasons   the top reasons, in words
 *   BadgesRow      each check by name ("School email confirmed")
 *   LifestyleChips the "general info" chips, each with its glyph
 *   KindTag        Room available / Roommate wanted / Find together
 */

const FACE_PX = { sm: 32, md: 44, lg: 56, xl: 96 } as const;
export type FaceSize = keyof typeof FACE_PX;

export function PersonFace({ person, size = "md", ring = false }: { person: Pick<PersonRef, "name" | "avatarUrl"> | null; size?: FaceSize; ring?: boolean }) {
  const px = FACE_PX[size];
  return (
    <span className="nf-rm-face" data-size={size} data-ring={ring || undefined} aria-hidden="true">
      {person?.avatarUrl ? (
        <RemoteImage src={person.avatarUrl} alt="" width={px * 2} height={px * 2} sizes={`${px}px`} loading="lazy" />
      ) : (
        <span className="nf-rm-face__monogram">{initial(person?.name ?? "", "V")}</span>
      )}
    </span>
  );
}

export function FaceStack({ people, max = 4, size = "sm" }: { people: readonly Pick<PersonRef, "userId" | "name" | "avatarUrl">[]; max?: number; size?: FaceSize }) {
  const shown = people.slice(0, max);
  if (!shown.length) return null;
  return (
    <span className="nf-rm-stack" aria-hidden="true">
      {shown.map((p) => (
        <PersonFace key={p.userId} person={p} size={size} ring />
      ))}
    </span>
  );
}

/** The ring. `score` 0 to 100 or null; null is drawn as an open ring with no figure. */
export function MatchRing({ score, size = "md", label }: { score: number | null; size?: "sm" | "md" | "lg"; label: string }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const value = score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  return (
    <span className="nf-rm-ring" data-size={size} data-empty={score === null || undefined} role="img" aria-label={label}>
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle className="nf-rm-ring__track" cx="22" cy="22" r={r} />
        {score !== null ? (
          <circle className="nf-rm-ring__arc" cx="22" cy="22" r={r} strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} />
        ) : null}
      </svg>
      <span className="nf-rm-ring__n" aria-hidden="true">
        {score === null ? <UiIcon name="sliders" size={16} /> : <>{value}<small>%</small></>}
      </span>
    </span>
  );
}

export function MatchBadge({ match, t }: { match: MatchView | null; t: RoommatesCopy }) {
  if (!match) return null;
  if (match.score === null) {
    return (
      <span className="nf-rm-matchbadge" data-thin="">
        <UiIcon name="sliders" size={14} />
        {t.ui.card.thinShort}
      </span>
    );
  }
  return (
    <span className="nf-rm-matchbadge">
      <UiIcon name="circle-check" size={14} filled />
      {fill(t.ui.card.matchFor, { n: Math.round(match.score) })}
    </span>
  );
}

export function MatchReasons({ match, t, max = 3 }: { match: MatchView | null; t: RoommatesCopy; max?: number }) {
  if (!match || !match.reasons.length) return null;
  return (
    <ul className="nf-rm-reasons" aria-label={t.match.label}>
      {match.reasons.slice(0, max).map((r) => (
        <li key={r}>
          <UiIcon name="check" size={14} />
          {t.reasons[r]}
        </li>
      ))}
    </ul>
  );
}

export function BadgesRow({ badges, t, max, size = "md" }: { badges: readonly BadgeKind[]; t: RoommatesCopy; max?: number; size?: "sm" | "md" }) {
  if (!badges.length) return null;
  const shown = typeof max === "number" ? badges.slice(0, max) : badges;
  const more = badges.length - shown.length;
  return (
    <ul className="nf-rm-badges" data-size={size} aria-label={t.verification.title}>
      {shown.map((b) => (
        <li key={b} className="nf-rm-badge">
          <UiIcon name={BADGE_ICON[b]} size={14} />
          {t.verification.kinds[b]}
        </li>
      ))}
      {more > 0 ? <li className="nf-rm-badge nf-rm-badge--more">{`+${more}`}</li> : null}
    </ul>
  );
}

export function LifestyleChips({ lifestyle, t, max, labelled = false }: { lifestyle: Lifestyle; t: RoommatesCopy; max?: number; labelled?: boolean }) {
  const facts = lifestyleFacts(lifestyle, t);
  if (!facts.length) return null;
  const shown = typeof max === "number" ? facts.slice(0, max) : facts;
  return (
    <ul className="nf-rm-life" data-labelled={labelled || undefined}>
      {shown.map((f) => (
        <li key={f.key} className="nf-rm-life__chip">
          <span className="nf-rm-life__glyph" aria-hidden="true">
            <UiIcon name={f.icon} size={16} />
          </span>
          <span className="nf-rm-life__text">
            {labelled ? <span className="nf-rm-life__label">{f.label}</span> : <span className="sr-only">{`${f.label}: `}</span>}
            <span className="nf-rm-life__value">{f.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const KIND_ICON = { room_offer: "key", roommate_wanted: "users", together: "circle-people" } as const;

export function KindTag({ kind, t, onMedia = false }: { kind: ListingKind; t: RoommatesCopy; onMedia?: boolean }) {
  return (
    <span className="nf-rm-kind" data-kind={kind} data-on-media={onMedia || undefined}>
      <UiIcon name={KIND_ICON[kind]} size={14} />
      {t.listingKinds[kind]}
    </span>
  );
}

export function VerifiedChip({ t, onMedia = false }: { t: RoommatesCopy; onMedia?: boolean }) {
  return (
    <span className="nf-rm-verified" data-on-media={onMedia || undefined}>
      <UiIcon name="verified" size={14} filled />
      {t.ui.card.verified}
    </span>
  );
}
