/**
 * A5. Invite codes, client safe: the shape the database allots
 * (`public.referral_codes`, six characters with no 0/O or 1/I) and the cookie
 * the invite door leaves for sign-up to read.
 */
export const INVITE_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const INVITE_COOKIE = "vallo_invite";
/** Thirty days: long enough to come back and sign up, short enough to mean this invite. */
export const INVITE_COOKIE_SECONDS = 30 * 24 * 60 * 60;

export function normaliseInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return INVITE_CODE_RE.test(code) ? code : null;
}

export function invitePath(code: string): string {
  return `/join/${code}`;
}

/** What `public.referral_claim_code` answers (D85). */
export const CLAIM_OUTCOMES = [
  "attributed",
  "already_attributed",
  "too_late",
  "own_code",
  "unknown_code",
  "invalid",
  "signed_out",
] as const;
export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];

export function claimOutcome(raw: unknown): ClaimOutcome | null {
  return typeof raw === "string" && (CLAIM_OUTCOMES as readonly string[]).includes(raw) ? (raw as ClaimOutcome) : null;
}

/**
 * Whether the kept code has done its work and the cookie can go. Every answer
 * but "signed out" is final for this account: claimed, already claimed, too
 * old an account, its own code, or a code that does not exist. Signed out
 * keeps it for the session that is about to exist.
 */
export function claimIsFinal(outcome: ClaimOutcome): boolean {
  return outcome !== "signed_out";
}

/**
 * WHAT A PERSON MAY PASTE INTO "Referral code or invite link": the six
 * character code on its own, or the whole link (`/join/ABC234`, with or
 * without the site's address), or an address carrying `?ref=ABC234`.
 * Returns the normalised code, or null when nothing in it is a code.
 */
export function parseInviteInput(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const direct = normaliseInviteCode(text);
  if (direct) return direct;
  const join = /\/join\/([A-Za-z0-9]{6})(?:[/?#]|$)/.exec(text);
  if (join?.[1]) return normaliseInviteCode(join[1]);
  const ref = /[?&](?:ref|code|invite)=([A-Za-z0-9]{6})(?:[&#]|$)/i.exec(text);
  if (ref?.[1]) return normaliseInviteCode(ref[1]);
  return null;
}
