"use client";

import "./badges.css";
import { useState } from "react";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { Sheet } from "@/components/ui/Sheet";
import { badgeObject } from "./badge-art";
import { BadgeMoment, type BadgeMomentCopy } from "./BadgeMoment";
import { pickBadges, type ProfileBadge } from "./badge-model";

export type BadgeRowCopy = BadgeMomentCopy & {
  title: string;
  /** The line under a hand-given badge, and in its sheet. */
  givenBy: string;
  /** "{date}" is replaced with the granted date. */
  earnedOn: string;
  means: string;
};

/**
 * THE BADGE ROW: at most six, each one a claim with a reason.
 *
 * Reference 7111 (eighty rainbow badges) is the pattern this refuses. The row
 * shows the six the model picks (`pickBadges`), each a clay mark and a name on
 * a Plate; tapping one says what it means, in the database's own words, and
 * when it was granted. For the OWNER, an earned badge opens the earned moment
 * instead, so the thing they worked for is the thing they can show; for
 * anybody else, and for a badge somebody at Vallo gave by hand, it is a sheet
 * and never a celebration.
 *
 * A hand-given badge says so on its own tile ("Given by the Vallo team") so
 * that earned and given are told apart by a word, not by a colour.
 *
 * It draws nothing when there is nothing true to draw: no empty shelf, no
 * "no badges yet", no greyed-out badges to unlock, because a locked badge is an
 * advertisement for a game this product is not.
 */
export function BadgeRow({
  badges,
  isOwner,
  copy,
  shareUrl,
}: {
  badges: readonly ProfileBadge[];
  isOwner: boolean;
  copy: BadgeRowCopy;
  shareUrl?: string;
}) {
  const [open, setOpen] = useState<ProfileBadge | null>(null);
  const shown = pickBadges(badges);
  if (shown.length === 0) return null;

  return (
    <section className="nf-merits" id="badges" aria-label={copy.title} data-testid="profile-badges">
      <h2 className="nf-merits__title">{copy.title}</h2>
      <ul className="nf-merits__list">
        {shown.map((badge) => (
          <li key={badge.code}>
            <button
              type="button"
              className="nf-merit-tile"
              onClick={() => setOpen(badge)}
              aria-haspopup="dialog"
              data-testid={`badge-${badge.code}`}
            >
              <span className="nf-merit-tile__mark" aria-hidden="true">
                <BrandIcon name={badgeObject(badge.objectName)} size={36} />
              </span>
              <span className="nf-merit-tile__name">{badge.name}</span>
              {badge.earned ? null : <span className="nf-merit-tile__kind">{copy.givenBy}</span>}
            </button>
          </li>
        ))}
      </ul>

      {open && isOwner && open.earned ? (
        <BadgeMoment badge={open} copy={copy} shareUrl={shareUrl} onClose={() => setOpen(null)} />
      ) : null}

      {open && !(isOwner && open.earned) ? (
        <Sheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={open.name}
          hideTitle
          testId="badge-sheet"
        >
          <div className="nf-merit-sheet">
            <span className="nf-merit-sheet__mark" aria-hidden="true">
              <BrandIcon name={badgeObject(open.objectName)} size={72} />
            </span>
            <h2 className="nf-merit-sheet__name">{open.name}</h2>
            <p className="nf-merit-sheet__means">
              <span className="sr-only">{copy.means}: </span>
              {open.description}
            </p>
            <p className="nf-merit-sheet__date">
              {open.earned ? copy.earnedOn.replace("{date}", open.grantedLabel) : copy.givenBy}
            </p>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
