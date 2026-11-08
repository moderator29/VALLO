/**
 * Badge tier copy (SW11). Moved from:
 *   - lib/trust/badge-tier.ts (BADGE_TIER_LABEL, BADGE_TIER_MEANING)
 */

/* No `none`: an account with no badge draws no label and no meaning, which
   is an absence in code (`lib/trust/badge-tier.ts`), not an empty line here. */
export const badgeTierLabelEn = {
  gold: "Verified",
  platinum: "Vallo",
};

export const badgeTierMeaningEn = {
  gold: "Identity checked by a person at Vallo.",
  platinum: "A Vallo administrator.",
};
