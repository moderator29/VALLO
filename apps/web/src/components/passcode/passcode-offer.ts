/**
 * THE PASSCODE OFFER'S "NOT NOW", REMEMBERED ON THIS DEVICE (6 November 2026).
 *
 * A passcode is optional. The home screen carries a slim alert until the
 * member sets one or closes it. Closing it writes this cookie, which the
 * server reads before drawing, so a closed alert never flashes back on the
 * next load. It lasts 60 days, then the alert is offered once more: gentle,
 * never nagging. Pure, so the timing is a unit test.
 */
export const PASSCODE_OFFER_COOKIE = "vallo_pc_offer";

/** How long a "Not now" holds before the offer returns. */
export const PASSCODE_OFFER_SNOOZE_SECONDS = 60 * 24 * 60 * 60;

export function passcodeOfferCookieString(secure: boolean): string {
  return `${PASSCODE_OFFER_COOKIE}=1; path=/; max-age=${PASSCODE_OFFER_SNOOZE_SECONDS}; samesite=lax${secure ? "; secure" : ""}`;
}

/** Whether the alert should draw: only with no passcode set and no live "Not now". */
export function passcodeOfferShows(facts: { gate: string; snoozed: boolean }): boolean {
  return facts.gate === "unset" && !facts.snoozed;
}
