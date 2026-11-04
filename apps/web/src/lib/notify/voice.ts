/**
 * THE VOICE OF AN IN-APP NOTIFICATION (3 November 2026, the founder: warmer and
 * more polished).
 *
 * The database writes each notification's title as a plain fact ("New
 * follower"). This draws the same fact in Vallo's warmer voice on the screens
 * that show it (the list and the full view). It changes words only, at the
 * point of drawing: the stored row, the push, the family and severity logic
 * and every test that keys on the stored title are untouched, and a title
 * with no entry here is drawn exactly as stored. Nothing here adds a claim:
 * each line says the same thing as the fact it replaces.
 */

const EXACT: Readonly<Record<string, string>> = {
  "New message": "You have a new message",
  "Missed voice call": "You missed a voice call",
  "Missed video call": "You missed a video call",
  "New follower": "You have a new follower",
  "Somebody liked your post": "Someone liked your post",
  "Somebody liked your story": "Someone liked your story",
  "Somebody reposted you": "Someone reposted you",
  "New sign-in to Vallo": "New sign-in to your Vallo account",
  "Phone number confirmed": "Your phone number is confirmed",
  "Withdrawal could not complete": "Your withdrawal did not go through",
  "Your table is confirmed": "Good news, your table is confirmed",
  "Your table is not going ahead": "Sorry, your table is not going ahead",
  "We have your question": "We have your question and we are on it",
  "Your agent application is approved": "Good news, your agent application is approved",
  "Your agent application needs more information": "We need a little more for your agent application",
  "Your owner registration is filed": "Thanks, your owner registration is filed",
  "Your agent registration is filed": "Thanks, your agent registration is filed",
};

const PATTERNS: readonly (readonly [RegExp, (m: RegExpMatchArray) => string])[] = [
  [/^You earned (.+)$/, (m) => `Congratulations, you earned ${m[1]}`],
  [/^Table requested at (.+)$/, (m) => `Your table request is with ${m[1]}`],
];

/**
 * The title as Vallo says it. Unknown titles come back unchanged. `maxLength`
 * is for the lock screen (40 characters): a warm line that would not fit is
 * not cut, the stored fact is used instead.
 */
export function warmTitle(stored: string, maxLength?: number): string {
  let warm = stored;
  const exact = EXACT[stored];
  if (exact !== undefined) warm = exact;
  else {
    for (const [pattern, say] of PATTERNS) {
      const m = pattern.exec(stored);
      if (m) {
        warm = say(m);
        break;
      }
    }
  }
  return maxLength !== undefined && warm.length > maxLength ? stored : warm;
}

/**
 * The body as Vallo says it. A shared listing arrives stored as the line
 * "Shared a listing" and the listing's path (an internal address with an id),
 * which is not something to read on a screen or a lock screen; it is drawn as
 * a sentence. Everything else is the stored text, untouched.
 */
export function warmBody(stored: string | null): string | null {
  if (stored === null) return null;
  if (/^Shared a listing\s*\n\s*\/listing\/[0-9a-f-]{8,}\s*$/i.test(stored)) return "Shared a listing with you.";
  if (/^Shared a (?:place|stay|table)\s*\n\s*\/[\w/-]+\s*$/i.test(stored)) return stored.split("\n")[0]!.trim() + " with you.";
  return stored;
}
