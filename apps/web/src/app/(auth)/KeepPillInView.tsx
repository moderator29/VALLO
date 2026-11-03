"use client";
import "@/app/css/auth.css";

import { useEffect } from "react";

/**
 * THE PILL STAYS ABOVE THE KEYBOARD.
 *
 * The earlier auth pass promised that the primary button of the chooser and
 * of the password step sits in view with the keyboard up. The curved block
 * gives most of that back by shortening while a field has focus (auth.css,
 * "THE KEYBOARD"); this closes the rest. When a field in an auth form takes
 * focus, and again when the visual viewport shrinks under the keyboard, the
 * page scrolls just far enough for the form's pill to clear the keyboard,
 * and never so far that the field being typed in leaves the top.
 *
 * SIGN UP'S PINNED BAR. Its pill rides a bar stuck to the foot of the screen.
 * On a phone the keyboard covers the foot of the layout viewport (iOS, and
 * Android's default "resizes visual"), so the bar would sit behind it. The
 * keyboard's height is published here as `--nf-kb` on the auth screen, and
 * the bar's sticky `bottom` reads it (auth.css), so Next and Create account
 * ride just above the keys, the way a native form does. A sticky offset
 * rather than a transform: where the bar is already above the keyboard in
 * the flow, it stays put and never covers the last field. The focused field
 * is then scrolled clear of the bar.
 *
 * THE SHORT BLOCK IS HELD THROUGH A TAP (29 October 2026, the founder: the
 * first tap on "Send the reset link" only made the page jump). The block used
 * to shorten on CSS `:focus` alone, so the tap that left the field blurred it,
 * the block grew back, the button slid out from under the finger and the tap
 * landed on nothing. Now `data-typing` on the screen carries the short block,
 * set on focus and cleared only a moment after focus has really left every
 * field, so the button stays exactly where it was until the tap is done.
 *
 * NEVER SCROLLED UNDER A CARET (same day: the cursor could not be moved back
 * through typed text). iOS resizes the visual viewport whenever its
 * suggestion bar comes and goes, which happens as the caret moves; each resize
 * used to scroll the page, which cancels the caret drag. The page is settled
 * once per field and again only when the keyboard itself opens or closes.
 *
 * Nothing is drawn; this only listens.
 */
export function KeepPillInView() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let timer = 0;
    let frame = 0;
    let release = 0;
    /* The field the page was last settled for, and the keyboard height then. */
    let settledFor: HTMLElement | null = null;
    let settledKb = 0;
    const screen = document.querySelector<HTMLElement>(".nf-auth");

    /* The keyboard's height over the layout viewport, 0 when it is down. */
    const publishKeyboard = () => {
      frame = 0;
      const vv = window.visualViewport;
      if (!screen || !vv) return;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      /* Pinch zoom also shrinks the visual viewport; only a real keyboard
         (a field in focus and a tall gap) moves the bar. */
      const typing = active !== null && document.activeElement === active && kb > 120;
      if (typing) {
        screen.style.setProperty("--nf-kb", `${kb}px`);
        screen.dataset.keyboard = "up";
      } else {
        screen.style.removeProperty("--nf-kb");
        delete screen.dataset.keyboard;
      }
    };
    const onViewport = () => {
      if (!frame) frame = window.requestAnimationFrame(publishKeyboard);
    };

    const keyboardHeight = () => {
      const vv = window.visualViewport;
      return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    };
    const settle = () => {
      const field = active;
      if (!field || document.activeElement !== field) return;
      publishKeyboard();
      const kb = keyboardHeight();
      /* Settled for this field already and the keyboard only nudged (the
         suggestion bar): leave the page alone, a caret may be moving. */
      if (settledFor === field && Math.abs(kb - settledKb) < 120) return;
      settledFor = field;
      settledKb = kb;
      const pill = field.closest("form")?.querySelector<HTMLElement>(".nf-auth__actions");
      if (!pill) return;
      const vv = window.visualViewport;
      const top = vv ? vv.offsetTop : 0;
      const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const box = field.getBoundingClientRect();
      const room = box.top - top - 8;
      let over: number;
      if (pill.classList.contains("nf-auth__actions--sticky")) {
        /* The bar is pinned: the field has to clear the bar, not the keys. */
        const bar = pill.getBoundingClientRect();
        over = box.bottom + 12 - Math.min(bar.top, bottom);
      } else {
        over = pill.getBoundingClientRect().bottom + 12 - bottom;
      }
      const by = Math.min(over, room);
      if (by <= 0) return;
      const calm = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
      window.scrollBy({ top: by, behavior: calm ? "auto" : "smooth" });
    };
    const later = () => {
      window.clearTimeout(timer);
      /* The keyboard and the shortening block both animate first. */
      timer = window.setTimeout(settle, 360);
    };
    const FIELD = "input:not([type=checkbox]):not([type=hidden]),select,textarea";
    const take = (el: Element | null) => {
      if (!(el instanceof HTMLElement) || !el.matches(FIELD) || !el.closest(".nf-auth__body")) return;
      active = el;
      window.clearTimeout(release);
      if (screen) screen.dataset.typing = "";
      later();
    };
    const onFocus = (event: FocusEvent) => take(event.target as Element | null);
    const onBlur = () => {
      /* Focus moving field to field keeps the bar up; leaving drops it. */
      window.setTimeout(() => {
        if (active && document.activeElement !== active) {
          active = null;
          settledFor = null;
          publishKeyboard();
        }
      }, 0);
      /* The short block is let go only once the tap that left the field has
         landed, so nothing moves under the finger. */
      window.clearTimeout(release);
      release = window.setTimeout(() => {
        const now = document.activeElement;
        if (now instanceof HTMLElement && now.matches(FIELD) && now.closest(".nf-auth__body")) return;
        if (screen) delete screen.dataset.typing;
      }, 600);
    };
    /* The password step focuses its field on arrival, before this listens. */
    take(document.activeElement);

    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    window.visualViewport?.addEventListener("resize", later);
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(release);
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      window.visualViewport?.removeEventListener("resize", later);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      screen?.style.removeProperty("--nf-kb");
      if (screen) {
        delete screen.dataset.keyboard;
        delete screen.dataset.typing;
      }
    };
  }, []);

  return null;
}
