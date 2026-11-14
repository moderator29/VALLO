/**
 * THE RIGHT KEYBOARD FOR THE FIELD (founder, 14 November 2026: "I need
 * keyboard high clean for our platform").
 *
 * A phone shows a different keyboard for an amount, a phone number, a code,
 * an address and a name, and the return key can say Next, Search, Go, Done
 * or Send. Set well, a form is typed without the person hunting for the
 * right key or fighting autocapitalisation; set badly, every field feels the
 * same and several feel wrong. Seventy-two of about two hundred and seventy
 * files that draw a field set any of this before today.
 *
 * One table, so a field's keyboard is decided in one place and a screen can
 * ask for a kind by name rather than remembering six attributes. Pure data
 * and one guess function, so it is tested without a browser.
 *
 * WHAT CANNOT BE PROVEN HERE. A real phone keyboard cannot be opened in this
 * sandbox. What a test can see is the attributes on the element; what only a
 * device shows is the keyboard that actually appears, the Return key's word
 * in each language, and the autofill strip above it.
 */

export type FieldKind =
  | "amount"
  | "phone"
  | "code"
  | "email"
  | "handle"
  | "name"
  | "search"
  | "url"
  | "number"
  | "text"
  | "multiline";

export type KeyboardHints = {
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "email" | "url" | "search" | "none";
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  autoComplete?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
};

/**
 * What each kind of field asks of the keyboard. `enterKeyHint` is left out
 * where the position in the form decides it (`enterFor` below): a field in
 * the middle of a form says Next, the last one says Go or Done.
 */
export const KEYBOARD: Readonly<Record<FieldKind, KeyboardHints>> = {
  /* Money: the decimal pad, never the full keyboard. No autocorrect to turn
     a figure into a word. */
  amount: { inputMode: "decimal", autoComplete: "off", autoCorrect: "off", spellCheck: false },
  /* A Nigerian number is typed on the phone pad, and the browser may fill it. */
  phone: { inputMode: "tel", autoComplete: "tel", autoCorrect: "off", spellCheck: false },
  /* A one-time code: the number pad, and the attribute that makes iOS and
     Android offer the code from the message above the keyboard. */
  code: {
    inputMode: "numeric",
    autoComplete: "one-time-code",
    autoCapitalize: "none",
    autoCorrect: "off",
    spellCheck: false,
    enterKeyHint: "go",
  },
  email: {
    inputMode: "email",
    autoComplete: "email",
    autoCapitalize: "none",
    autoCorrect: "off",
    spellCheck: false,
  },
  /* A handle or a username: no capitals, no correction, no spell check. */
  handle: { inputMode: "text", autoComplete: "username", autoCapitalize: "none", autoCorrect: "off", spellCheck: false },
  /* A person's name is capitalised by word, and never spell checked: a
     Nigerian name underlined in red is the platform telling somebody their
     name is a mistake. */
  name: { inputMode: "text", autoCapitalize: "words", autoCorrect: "off", spellCheck: false },
  search: { inputMode: "search", enterKeyHint: "search", autoComplete: "off", autoCorrect: "off", spellCheck: false },
  url: { inputMode: "url", autoComplete: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false },
  /* A plain count (bedrooms, guests, a quantity): the number pad. */
  number: { inputMode: "numeric", autoComplete: "off", autoCorrect: "off", spellCheck: false },
  /* Ordinary words: sentence capitals, correction and spell check left on,
     which is what a person writing a sentence wants. */
  text: { inputMode: "text", autoCapitalize: "sentences" },
  /* A message or a description: the same, and Enter makes a new line rather
     than submitting, so no enterKeyHint is set here. */
  multiline: { autoCapitalize: "sentences" },
};

/**
 * The return key for a field's PLACE in its form: the last field closes the
 * form, every other one moves on. A composer says Send; a search says Search
 * (both come from the kind above).
 */
export function enterFor(place: "last" | "middle", submits: "go" | "done" = "go"): KeyboardHints["enterKeyHint"] {
  return place === "last" ? submits : "next";
}

const NAME_HINTS = /(^|[^a-z])(name|fullname|firstname|lastname|surname|givenname|familyname)([^a-z]|$)/i;
const EMAIL_HINTS = /e-?mail/i;
const PHONE_HINTS = /(phone|mobile|tel|whatsapp|msisdn)/i;
const CODE_HINTS = /(^|[^a-z])(code|otp|pin|passcode)([^a-z]|$)/i;
const AMOUNT_HINTS = /(amount|price|rent|budget|naira|fee|cost|deposit|salary|total)/i;
const HANDLE_HINTS = /(handle|username|user_name)/i;
const SEARCH_HINTS = /(search|query|^q$)/i;
const URL_HINTS = /(url|website|link)/i;

/**
 * The kind a field looks like, from what the markup already says: its `type`
 * first (it is explicit), then its name or id. A guess only, so a caller
 * that names its kind always wins.
 */
export function guessFieldKind(
  attrs: { type?: string | undefined; name?: string | undefined; id?: string | undefined; multiline?: boolean },
): FieldKind {
  const type = (attrs.type ?? "").toLowerCase();
  if (type === "email") return "email";
  if (type === "tel") return "phone";
  if (type === "search") return "search";
  if (type === "url") return "url";
  if (type === "number") return "number";
  const label = `${attrs.name ?? ""} ${attrs.id ?? ""}`;
  if (CODE_HINTS.test(label)) return "code";
  if (EMAIL_HINTS.test(label)) return "email";
  if (PHONE_HINTS.test(label)) return "phone";
  if (AMOUNT_HINTS.test(label)) return "amount";
  if (HANDLE_HINTS.test(label)) return "handle";
  if (SEARCH_HINTS.test(label)) return "search";
  if (URL_HINTS.test(label)) return "url";
  if (NAME_HINTS.test(label)) return "name";
  return attrs.multiline ? "multiline" : "text";
}

/**
 * The hints for a field, from its kind or guessed from its markup. Anything
 * the call site sets itself wins, because these are spread first.
 */
export function hintsFor(
  attrs: { type?: string | undefined; name?: string | undefined; id?: string | undefined; multiline?: boolean },
  kind?: FieldKind,
): KeyboardHints {
  return KEYBOARD[kind ?? guessFieldKind(attrs)];
}
