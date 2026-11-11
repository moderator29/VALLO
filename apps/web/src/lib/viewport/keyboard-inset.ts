/**
 * THE ON-SCREEN KEYBOARD, ON THE WEB (the founder, 11 November 2026: the
 * "Type a message" bar sits too far down when the keyboard opens on his
 * iPhone, with a visible gap under it).
 *
 * THE CONTRACT ALREADY EXISTS AND ONLY THE SHELL WAS FILLING IT IN.
 * `lib/native/keyboard.ts` writes two things on the root while the keys are
 * up, and `app/css/chrome.css` and `app/css/messages-g1.css` read them:
 *
 *   --nf-keyboard-inset   the height of the keyboard in pixels, 0 when closed
 *   data-keyboard="open"  present only while the keys are up
 *
 * The composer, the pinned action bars and the floating dock all pad
 * themselves by `env(safe-area-inset-bottom)`, which describes the home
 * indicator at the bottom of the DEVICE. With the keyboard up the bottom of
 * the viewport is the top of the keys, where there is no home indicator, so
 * that padding becomes about 34 points of dead air wedged between the
 * composer and the keyboard. The marker above collapses it, and the measured
 * numbers for the chat composer are 34px of bottom padding with the keyboard
 * closed and 8px with it open.
 *
 * None of that reached a browser. Both values were written by the Capacitor
 * keyboard plugin and by nothing else, so in mobile Safari, in the installed
 * progressive web application, and in any shell where the plugin has not
 * started, the marker never appeared and the dead air stayed. This module
 * fills the same contract from `window.visualViewport`, which is the only
 * thing a browser offers: when the keyboard opens the visual viewport shrinks
 * while the layout viewport does not, and the difference is the keyboard.
 *
 * IT STANDS DOWN INSIDE THE SHELL. The Capacitor plugin is configured with
 * `resize: "native"`, so the web view ITSELF shrinks to the space above the
 * keys and the visual viewport is then the same size as the layout viewport.
 * The difference measured here would be zero, and this module would clear a
 * marker the plugin had just set correctly. So where `data-native` is on the
 * root (`lib/platform/detect.ts`), this does nothing at all and the plugin
 * keeps the job.
 *
 * WHY A FLOOR, A FOCUSED FIELD AND NO ZOOM. A visual viewport shrinks for
 * reasons that are not a keyboard: the address bar collapsing on scroll is
 * worth tens of pixels, and a pinch zoom shrinks it by however much somebody
 * has magnified the page. A keyboard on the smallest phone this application
 * supports is far taller than KEYBOARD_FLOOR_PX; it only ever arrives while
 * something editable has focus; and a page being read at 3x is not a page
 * with a keyboard on it, whatever its viewport says. All three tests have to
 * pass before the root is marked, because what the mark does is collapse
 * padding and HIDE THE DOCK, and hiding the dock because somebody zoomed in
 * would be a worse bug than the one being fixed.
 */

/** Below this many pixels the viewport lost something that is not a keyboard. */
export const KEYBOARD_FLOOR_PX = 120;

/** Editable things a keyboard opens for. The same list `keyboard.ts` uses. */
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/**
 * How tall the keyboard is, from a viewport reading, or 0 when nothing says
 * there is one. Pure, so the rule can be read in a test without a browser.
 */
export function keyboardInsetFrom(reading: {
  layoutHeight: number;
  visualHeight: number;
  offsetTop: number;
  editableFocused: boolean;
  /** `visualViewport.scale`; 1 is unzoomed. */
  scale?: number;
}): number {
  if (!reading.editableFocused) return 0;
  if ((reading.scale ?? 1) > 1.05) return 0;
  const inset = Math.round(reading.layoutHeight - reading.visualHeight - reading.offsetTop);
  if (!Number.isFinite(inset) || inset < KEYBOARD_FLOOR_PX) return 0;
  return inset;
}

/**
 * Keep `--nf-keyboard-inset` and `data-keyboard` true on the root for as long
 * as this page lives. Returns the teardown, and a no-op teardown wherever the
 * module stands down.
 */
export function startKeyboardInset(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const root = document.documentElement;
  /* The shell's plugin owns both values there; see the note above. */
  if (root.hasAttribute("data-native")) return () => {};
  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  let marked = false;

  const clear = (): void => {
    if (!marked) return;
    marked = false;
    root.style.setProperty("--nf-keyboard-inset", "0px");
    delete root.dataset.keyboard;
  };

  const read = (): void => {
    const active = document.activeElement;
    const inset = keyboardInsetFrom({
      layoutHeight: window.innerHeight,
      visualHeight: viewport.height,
      offsetTop: viewport.offsetTop,
      editableFocused: active instanceof HTMLElement && active.matches(EDITABLE),
      scale: viewport.scale,
    });
    if (inset <= 0) {
      clear();
      return;
    }
    marked = true;
    root.style.setProperty("--nf-keyboard-inset", `${inset}px`);
    root.dataset.keyboard = "open";
  };

  viewport.addEventListener("resize", read);
  viewport.addEventListener("scroll", read);
  /* A field blurred without the viewport changing (the page navigated away
     from it) still means the keys have gone. */
  window.addEventListener("focusout", read);
  window.addEventListener("focusin", read);
  read();

  return () => {
    viewport.removeEventListener("resize", read);
    viewport.removeEventListener("scroll", read);
    window.removeEventListener("focusout", read);
    window.removeEventListener("focusin", read);
    clear();
  };
}
