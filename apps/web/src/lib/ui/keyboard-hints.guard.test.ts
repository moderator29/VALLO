import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filesWithSilentFields } from "./keyboard-hints.scan";
import { enterFor, guessFieldKind, hintsFor, KEYBOARD } from "./keyboard-hints";

/**
 * THE KEYBOARD PASS (founder, 14 November 2026: "I need keyboard high clean
 * for our platform"). Every field on the platform tells the keyboard what it
 * holds: the decimal pad for an amount, the phone pad for a number, the
 * number pad and `one-time-code` for a code, no capitals for an address or a
 * handle, capitals by word for a name, Search on a search field.
 *
 * In the shape of `components/ui/hand-rolled-sheets.test.ts`: THIS LIST MAY
 * ONLY SHRINK. A new field that says nothing to the keyboard fails here, and
 * a field that is fixed comes off the list.
 *
 * Measured on 14 November 2026: 79 fields in 53 files were silent and were
 * given their keyboard in this pass; the shared `TextField` and `TextArea`
 * now derive theirs from what the field holds, so every caller of those
 * inherits it.
 */
const KNOWN_SILENT = [
  /*
   * The shared field itself. Its `<input>` spreads `{...keyboard}`, computed
   * by `hintsFor` from the field's own type, name and id, so the attribute
   * names are never literal in the source for this scan to see. It is the
   * one place that is right to be silent, because it is the place that
   * decides what every other field says.
   */
  "components/ui/Field.tsx",
];

const SRC = join(__dirname, "..", "..");

describe("every field tells the keyboard what it holds", () => {
  it("no field outside the known list is silent, and a fixed one leaves the list", () => {
    expect(filesWithSilentFields(SRC)).toEqual(KNOWN_SILENT);
  });
});

describe("the keyboard table", () => {
  it("gives money the decimal pad and a number the phone pad", () => {
    expect(KEYBOARD.amount.inputMode).toBe("decimal");
    expect(KEYBOARD.phone.inputMode).toBe("tel");
    expect(KEYBOARD.phone.autoComplete).toBe("tel");
  });

  it("gives a code the number pad and the one-time-code attribute", () => {
    expect(KEYBOARD.code.inputMode).toBe("numeric");
    expect(KEYBOARD.code.autoComplete).toBe("one-time-code");
    expect(KEYBOARD.code.enterKeyHint).toBe("go");
  });

  it("never capitalises or corrects an address or a handle", () => {
    for (const kind of ["email", "handle", "url"] as const) {
      expect(KEYBOARD[kind].autoCapitalize).toBe("none");
      expect(KEYBOARD[kind].autoCorrect).toBe("off");
      expect(KEYBOARD[kind].spellCheck).toBe(false);
    }
  });

  it("capitalises a name by word and never spell checks it", () => {
    /* A Nigerian name underlined in red is the platform telling somebody
       their name is a mistake. */
    expect(KEYBOARD.name.autoCapitalize).toBe("words");
    expect(KEYBOARD.name.spellCheck).toBe(false);
  });

  it("puts Search on a search field and leaves a multiline box's Enter alone", () => {
    expect(KEYBOARD.search.enterKeyHint).toBe("search");
    expect(KEYBOARD.multiline.enterKeyHint).toBeUndefined();
  });

  it("says Next in the middle of a form and Go or Done at its end", () => {
    expect(enterFor("middle")).toBe("next");
    expect(enterFor("last")).toBe("go");
    expect(enterFor("last", "done")).toBe("done");
  });
});

describe("guessing a field's kind from its markup", () => {
  it("reads the type first, because it is explicit", () => {
    expect(guessFieldKind({ type: "email" })).toBe("email");
    expect(guessFieldKind({ type: "tel" })).toBe("phone");
    expect(guessFieldKind({ type: "search" })).toBe("search");
  });

  it("reads the name or the id when the type does not say", () => {
    expect(guessFieldKind({ name: "amount" })).toBe("amount");
    expect(guessFieldKind({ id: "sign-in-code" })).toBe("code");
    expect(guessFieldKind({ name: "fullName" })).toBe("name");
    expect(guessFieldKind({ id: "listing-budget" })).toBe("amount");
  });

  it("does not read a word inside another word", () => {
    /* "parentId" holds "rent", and a reply box is not an amount: that exact
       mistake reached 62 files in this pass before it was caught. */
    expect(guessFieldKind({ id: "reply-parentId" })).toBe("text");
    expect(guessFieldKind({ id: "parent-thread" })).toBe("text");
  });

  it("falls back to plain words, and to a multiline box's own rules", () => {
    expect(guessFieldKind({ id: "anything" })).toBe("text");
    expect(guessFieldKind({ id: "anything", multiline: true })).toBe("multiline");
  });

  it("lets a caller name the kind over any guess", () => {
    expect(hintsFor({ id: "whatever" }, "amount").inputMode).toBe("decimal");
  });
});
