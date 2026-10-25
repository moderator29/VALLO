import type { Dictionary } from "@vallo/i18n/core";
import type { BadgeRowCopy } from "./BadgeRow";

/**
 * The badge row's words, from the dictionary the server page already holds, so
 * the two pages that draw the row (`/u/[handle]` and `/profile`) say the same
 * things and a client component never has to ship a dictionary.
 */
export function badgeCopyOf(t: Dictionary): BadgeRowCopy {
  const p = t.experienceSocial.profile;
  return {
    title: p.badgesTitle,
    givenBy: p.badgeGivenBy,
    earnedOn: p.badgeEarnedOn,
    means: p.badgeMeans,
    overline: p.momentOverline,
    share: p.momentShare,
    back: p.momentBack,
    shareText: p.momentShareText,
    copied: p.momentCopied,
    /* The platform's one sentence for a share that went nowhere. */
    copyFailed: t.details.share.failed,
    replayHint: p.momentReplayHint,
    viewProfile: p.momentViewProfile,
  };
}
