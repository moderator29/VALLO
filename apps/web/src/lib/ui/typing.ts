"use client";

/**
 * THE TYPING RULES THAT DEPEND ON WHAT YOU ARE TYPING ON (founder, 14
 * November 2026, handoff 6.4 items 5 and 7).
 *
 * ENTER. On a computer, Enter sends a message and Shift with Enter makes a
 * new line: that is what every desk messenger does and what a keyboard with
 * a real Return key invites. On a phone the opposite is true: the Return key
 * is how a person writes a second line, and the send button is right there
 * under their thumb, so Enter must never send. The platform shipped the desk
 * rule on every device, which meant a thumbed Return sent a half-written
 * message.
 *
 * DISMISSING. A keyboard that will not go away is the complaint behind "I
 * need keyboard high clean": dragging the thread down puts it away, as it
 * does in every phone messenger, and so does tapping the thread outside the
 * field.
 *
 * WHAT CANNOT BE PROVEN HERE. A real phone keyboard cannot be opened in this
 * sandbox, so the rules below are pinned by their own tests and by a browser
 * with a coarse pointer emulated. What only a device shows is the keyboard
 * actually going down on the drag and the Return key's word.
 */

/** A phone or a tablet: a finger, not a mouse. */
export function coarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia?.("(pointer: coarse)").matches === true;
  } catch {
    return false;
  }
}

/**
 * Whether this Enter press should SEND. True only on a fine pointer, without
 * Shift, and never while an input method is composing (a Chinese or Japanese
 * keyboard uses Enter to choose a candidate, and sending there would cut the
 * word in half).
 */
export function enterSends(event: {
  key: string;
  shiftKey: boolean;
  nativeEvent?: { isComposing?: boolean };
}, coarse = coarsePointer()): boolean {
  if (event.key !== "Enter" || event.shiftKey) return false;
  if (event.nativeEvent?.isComposing) return false;
  return !coarse;
}

/**
 * Put the keyboard away: the only way a web page can is to take focus off
 * the field. Safe on the server and where nothing is focused.
 */
export function dismissKeyboard(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea, [contenteditable]")) active.blur();
}

/**
 * Drag a scrolling thread DOWNWARD and the keyboard goes away, the way a
 * phone messenger does it. Returns the handlers to spread on the scroller.
 *
 * Only on a coarse pointer, only while something is focused, and only past a
 * deliberate distance, so a small scroll to read the message above does not
 * take the keyboard with it.
 */
export const DRAG_TO_DISMISS_PX = 24;

export function dragDismissHandlers(): {
  onTouchStart: (event: { touches: ArrayLike<{ clientY: number }> }) => void;
  onTouchMove: (event: { touches: ArrayLike<{ clientY: number }> }) => void;
} {
  let from: number | null = null;
  return {
    onTouchStart: (event) => {
      from = event.touches[0]?.clientY ?? null;
    },
    onTouchMove: (event) => {
      const y = event.touches[0]?.clientY;
      if (from === null || y === undefined) return;
      if (y - from > DRAG_TO_DISMISS_PX) {
        dismissKeyboard();
        from = null;
      }
    },
  };
}
