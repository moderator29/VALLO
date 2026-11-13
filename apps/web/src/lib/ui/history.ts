/**
 * Where "back" actually goes.
 *
 * THE BUG THIS EXISTS TO FIX, AND WHY IT WAS INVISIBLE.
 *
 * Every back control on the platform asked the same question:
 *
 *     const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
 *     if (idx > 0) router.back(); else router.push(fallback);
 *
 * `idx` was Next's own index into the entries its router had pushed. Next 16
 * does not write it any more: `history.state` on this app now reads
 * `{ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {...} }` and nothing else.
 * So `idx` was `undefined` on every screen, `?? 0` made it 0, `0 > 0` was
 * false, and EVERY back control on the platform silently stopped going back.
 *
 * What a person saw: filter a search down to two bedrooms in Lagos, verified
 * only, cheapest first. Open a place. Tap Back. Land on `/home` with the whole
 * hunt thrown away. Nothing errored, nothing looked broken, and the address
 * bar had been carrying the filters correctly the entire time. The browser's
 * own back button worked perfectly, which is exactly why this survived: anyone
 * testing with a keyboard rather than a thumb never saw it.
 *
 * It is also the second time this control has been wrong in the opposite
 * direction. It used to be `history.length > 1`, which counts entries
 * belonging to whatever site the visitor came from, so opening a page in a
 * fresh tab called `router.back()` with nothing of ours behind it and landed
 * on `about:blank`. Both failures come from asking a proxy question. This
 * module asks the real one and never reads a framework internal.
 *
 * THREE ANSWERS, BEST FIRST.
 *
 * 1. The Navigation API. `navigation.canGoBack` is precisely this question,
 *    and its entry list only contains contiguous SAME-ORIGIN entries, so a
 *    true answer means there is a screen of ours behind this one. Verified in
 *    the harness browser: false on a cold deep link into `/wallet`, true after
 *    one in-app navigation, and still true after a back. Chromium has it,
 *    which is most Nigerian mobile traffic.
 *
 * 2. Our own stamp, for Safari and Firefox, which have no Navigation API.
 *    `noteEntry()` merges an `nfSeq` counter into whatever `history.state`
 *    already holds, so the first screen of a session carries 1 and anything
 *    reached from inside the app carries 2 or more. The merge is deliberate:
 *    replacing the state object outright would throw away Next's router tree.
 *    Verified against this app, Next kept navigating and the tree survived a
 *    back traversal with the stamp intact.
 *
 * 3. A same-origin referrer with an entry behind it. Weaker than either of the
 *    above and only reached when storage is unavailable, but it still refuses
 *    the fresh-tab case that produced `about:blank`.
 *
 * Every answer fails CLOSED. When this module cannot tell, it says no, and the
 * caller pushes its fallback. A fallback is a mild annoyance; `about:blank` is
 * a dead end.
 */

/** The key merged into `history.state`. Namespaced so nothing collides. */
const SEQ_KEY = "nfSeq";

/** The running counter, per tab, in session storage. */
const COUNTER_KEY = "nf_history_seq";

type StampedState = Record<string, unknown> & { [SEQ_KEY]?: number };

function readState(): StampedState | null {
  try {
    const state = window.history.state as StampedState | null;
    return state && typeof state === "object" ? state : null;
  } catch {
    return null;
  }
}

/**
 * Number this history entry, once.
 *
 * Idempotent: an entry that already carries a stamp keeps it, which is what
 * makes a back traversal land on the number it was given the first time
 * through rather than being renumbered to the front of the queue.
 *
 * Called from `ScrollToTop`, which is mounted in the root layout and therefore
 * runs on EVERY screen. Stamping only where a back control happens to render
 * would not work: a person filters `/search`, which has no back control and so
 * would never be stamped, opens a listing, and the listing would believe it
 * was the first screen of the session.
 */
export function noteEntry(): void {
  if (typeof window === "undefined") return;
  const state = readState();
  if (state && typeof state[SEQ_KEY] === "number") return;
  try {
    const seq = Number(window.sessionStorage.getItem(COUNTER_KEY) ?? "0") + 1;
    window.sessionStorage.setItem(COUNTER_KEY, String(seq));
    window.history.replaceState({ ...(state ?? {}), [SEQ_KEY]: seq }, "");
  } catch {
    /* Private browsing can refuse session storage, and a sandboxed frame can
       refuse replaceState. Answer 3 covers both. */
  }
}

/**
 * Whether this history entry already carries a stamp, WITHOUT stamping it. A
 * fresh push has none until `noteEntry` runs after it paints; an entry gone
 * back or forward to has one. So it tells a traversal from a push even before
 * `popstate` has been heard, which in WebKit can come after the router has
 * already drawn the page.
 */
export function entryStamped(): boolean {
  if (typeof window === "undefined") return false;
  return typeof readState()?.[SEQ_KEY] === "number";
}

/**
 * This history entry's stamp (`noteEntry` writes it if it is missing), so a
 * caller can tell a return to an entry from a new arrival at the same address.
 * Null where the browser refuses the stamp.
 */
export function entrySeq(): number | null {
  if (typeof window === "undefined") return null;
  noteEntry();
  const seq = readState()?.[SEQ_KEY];
  return typeof seq === "number" ? seq : null;
}

/** Is there a screen of OURS behind this one? */
export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;

  const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
  if (typeof nav?.canGoBack === "boolean") return nav.canGoBack;

  const seq = readState()?.[SEQ_KEY];
  if (typeof seq === "number") return seq > 1;

  try {
    if (window.history.length <= 1) return false;
    const referrer = document.referrer;
    if (!referrer) return false;
    return new URL(referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}
