/**
 * THE RIGHT KEYBOARD FOR THE FIELD (founder, 14 November 2026: "keyboard high
 * clean for our platform").
 *
 * A phone decides which keys to show, whether to capitalise, whether to
 * "correct" what is typed and what its return key says from seven attributes:
 * `type`, `inputMode`, `enterKeyHint`, `autoComplete`, `autoCapitalize`,
 * `autoCorrect` and `spellCheck`. A field that names none of them gets the
 * letter keyboard with sentence capitals and correction on, which is right
 * for a message and wrong for an email ("Ada@"), a handle, a code, an amount
 * and a phone number.
 *
 * This is the rule, in one place and with no DOM in it, read from what a
 * field already says about itself (its type, its autocomplete token, its
 * keyboard). The shared fields apply it as DEFAULTS: anything a call site
 * passes wins. `field-keyboard.test.ts` holds each line of the table.
 */
export type KeyboardAttrs = {
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search";
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
};

type Asked = { type?: string | undefined; autoComplete?: string | undefined; inputMode?: string | undefined; name?: string | undefined };

/** Typed exactly as it is: never capitalised, corrected or spell-checked. */
const LITERAL = { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const;

const NAME_TOKENS = new Set(["name", "given-name", "family-name", "additional-name", "nickname", "cc-name", "organization"]);
const PLACE_TOKENS = new Set(["street-address", "address-line1", "address-line2", "address-line3", "address-level1", "address-level2", "address-level3", "country-name"]);

export function keyboardFor(field: Asked): KeyboardAttrs {
  const type = (field.type ?? "text").toLowerCase();
  /* The last token is the field's meaning: "shipping tel-national" is a phone. */
  const token = (field.autoComplete ?? "").trim().toLowerCase().split(/\s+/).pop() ?? "";
  const mode = (field.inputMode ?? "").toLowerCase();
  const name = (field.name ?? "").toLowerCase();

  if (token === "one-time-code") return { inputMode: "numeric", ...LITERAL };
  if (type === "email" || token === "email" || mode === "email") return { inputMode: "email", ...LITERAL };
  if (type === "tel" || token.startsWith("tel") || mode === "tel") return { inputMode: "tel", ...LITERAL };
  if (type === "url" || token === "url" || mode === "url") return { inputMode: "url", ...LITERAL };
  if (type === "password" || token === "current-password" || token === "new-password") return { ...LITERAL };
  if (token === "username" || name === "handle" || name === "username") return { ...LITERAL };
  if (type === "search" || mode === "search") return { inputMode: "search", enterKeyHint: "search", autoCapitalize: "none" };
  if (type === "number" || mode === "numeric" || mode === "decimal") {
    return { inputMode: mode === "decimal" ? "decimal" : "numeric", autoCorrect: "off", spellCheck: false };
  }
  /* A name starts each word with a capital and is not a word to be corrected. */
  if (NAME_TOKENS.has(token)) return { autoCapitalize: "words", autoCorrect: "off", spellCheck: false };
  if (PLACE_TOKENS.has(token)) return { autoCapitalize: "words" };
  return {};
}

/** A box for prose: sentences start with a capital, and return makes a new line. */
export const PROSE_KEYBOARD = { autoCapitalize: "sentences", enterKeyHint: "enter" } as const satisfies KeyboardAttrs;

/* -------------------------------------------------- Enter, in a composer */

/**
 * ENTER IN A MESSAGE BOX. On a computer Enter sends and Shift and Enter makes
 * a new line. On a phone the keyboard's return key makes a new line and the
 * button sends, which is what every chat app's keyboard does: a thumb that
 * meant a new line must never send half a message.
 *
 * `touchKeyboard` is "the thing typing is an on-screen keyboard": a coarse
 * pointer with no hover. A tablet or laptop with a real keyboard and a
 * trackpad reports a fine pointer and sends on Enter.
 */
export function enterSends(event: { key: string; shiftKey: boolean; isComposing: boolean }, touchKeyboard: boolean): boolean {
  if (event.key !== "Enter" || event.isComposing) return false;
  if (touchKeyboard) return false;
  return !event.shiftKey;
}

export const TOUCH_KEYBOARD_QUERY = "(hover: none) and (pointer: coarse)";

/** What the phone's return key should say in a message box. */
export function composerEnterKeyHint(touchKeyboard: boolean): "enter" | "send" {
  return touchKeyboard ? "enter" : "send";
}
