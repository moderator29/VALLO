/**
 * PUSH AND IN-APP COPY, WRITTEN FOR THE LOCK SCREEN (29 September 2026).
 *
 * A notification on a phone is three lines: the sender ("Vallo"), a short
 * bold title, and one or two lines of body. The rules, the same ones the
 * email subject and preheader keep (`lib/email/render.ts`):
 *
 *   TITLE: the fact, 40 characters or fewer, sentence case, no full stop.
 *   "Payment received", "Booking confirmed", "Viewing booked".
 *
 *   BODY: one sentence (two short ones at most), 110 characters or fewer,
 *   with the specific facts: who, what, when, how much. No greeting, no
 *   marketing, no "Vallo" (the sender line already says it). A count lives
 *   here, never in the title.
 *
 * Pure: no Supabase client, no environment, so the confirm panel's "What
 * everyone gets" preview and the drain use the same functions.
 */

export const PUSH_TITLE_MAX = 40;
export const PUSH_BODY_MAX = 110;

/** Cut at a word, with an ellipsis, only when the text is over `max`. */
export function clipPush(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const room = Math.max(1, max - 1);
  const cut = clean.slice(0, room);
  const space = cut.lastIndexOf(" ");
  const atWord = space > room * 0.5 ? cut.slice(0, space) : cut;
  return atWord.replace(/[\s,;:.\-]+$/, "") + "…";
}

/**
 * A LONG RUN OF DIGITS NEVER REACHES A LOCK SCREEN.
 *
 * A push body can carry a member's own words (a new message's first line),
 * and a lock screen is read by whoever holds the phone, and every push passes
 * through Apple or Google on the way. A bank account number (ten digits) or a
 * phone number (eleven) typed into a chat would otherwise sit there in full.
 * Any run of ten or more digits, single spaces between them allowed, is
 * shown as its last two digits behind dots. Amounts with separators
 * ("N360,000"), dates, dashed references and six-digit codes pass.
 */
export function maskLongDigitRuns(text: string): string {
  return text.replace(/\d(?: ?\d){9,}/g, (run) => `••••${run.replace(/\D/g, "").slice(-2)}`);
}

/** A title and body with long digit runs masked (`maskLongDigitRuns`). */
export function lockScreenSafe(copy: { title: string; body: string | null | undefined }): {
  title: string;
  body: string | null;
} {
  return {
    title: maskLongDigitRuns(copy.title),
    body: copy.body == null ? null : maskLongDigitRuns(copy.body),
  };
}

/**
 * A title and body held to the lock-screen limits.
 *
 * The drain runs every payload through this, so a title written in the
 * database longer than a phone shows arrives cut at a word rather than cut
 * mid-letter by the operating system. It never rewrites what fits.
 */
export function fitPush(copy: { title: string; body: string | null | undefined }): { title: string; body: string } {
  return {
    title: clipPush(copy.title, PUSH_TITLE_MAX),
    body: clipPush(copy.body ?? "", PUSH_BODY_MAX),
  };
}
