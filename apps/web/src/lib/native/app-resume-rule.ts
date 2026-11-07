/**
 * COMING BACK TO THE APP (Platform Grade 1, P0.5; recommendation IOS7).
 * Pure, so the decision is a unit test.
 *
 * A phone app that was in the background for a while shows today when it
 * comes back: the unread counts, a booking's status, the session. Vallo's
 * screens are server rendered, so "today" is one `router.refresh()`, which
 * re-reads the server components and KEEPS client state (a half-typed
 * message, an open sheet, the scroll).
 *
 *   - only after a real absence (a minute or more): flicking to another app
 *     and straight back costs nothing;
 *   - never while the person is typing (a field has focus), so nothing they
 *     are writing re-renders under their thumbs;
 *   - never offline: there is nothing to refresh from, and the kept page is
 *     the right answer (the connection line says so).
 */
export const RESUME_REFRESH_AFTER_MS = 60_000;

export function shouldRefreshOnResume(facts: { awayMs: number; typing: boolean; online: boolean }): boolean {
  return facts.online && !facts.typing && facts.awayMs >= RESUME_REFRESH_AFTER_MS;
}

/** Is the person writing something right now? */
export function isTyping(active: Element | null): boolean {
  if (!active) return false;
  const tag = active.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (active as HTMLInputElement).type;
    return !["button", "submit", "checkbox", "radio", "range", "file", "reset"].includes(type);
  }
  return (active as HTMLElement).isContentEditable === true;
}
