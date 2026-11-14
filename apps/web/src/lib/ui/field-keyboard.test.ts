import { describe, expect, it } from "vitest";

import { PROSE_KEYBOARD, composerEnterKeyHint, enterSends, keyboardFor } from "./field-keyboard";

const LITERAL = { autoCapitalize: "none", autoCorrect: "off", spellCheck: false };

describe("the keyboard a field asks for", () => {
  it("a code gets the number pad and is typed exactly as it is", () => {
    expect(keyboardFor({ type: "text", autoComplete: "one-time-code" })).toEqual({ inputMode: "numeric", ...LITERAL });
  });

  it("an email gets the @ keyboard, no capitals and no correction", () => {
    expect(keyboardFor({ type: "email" })).toEqual({ inputMode: "email", ...LITERAL });
    expect(keyboardFor({ type: "text", autoComplete: "email" })).toEqual({ inputMode: "email", ...LITERAL });
  });

  it("a phone number gets the phone pad, by type or by its autocomplete token", () => {
    expect(keyboardFor({ type: "tel" })).toEqual({ inputMode: "tel", ...LITERAL });
    expect(keyboardFor({ autoComplete: "shipping tel-national" })).toEqual({ inputMode: "tel", ...LITERAL });
  });

  it("a web address gets the address keyboard", () => {
    expect(keyboardFor({ type: "url" })).toEqual({ inputMode: "url", ...LITERAL });
  });

  it("a password and a handle are never capitalised or corrected", () => {
    expect(keyboardFor({ type: "password", autoComplete: "new-password" })).toEqual(LITERAL);
    expect(keyboardFor({ autoComplete: "username" })).toEqual(LITERAL);
    expect(keyboardFor({ name: "handle" })).toEqual(LITERAL);
  });

  it("a search field gets a Search key", () => {
    expect(keyboardFor({ type: "search" })).toEqual({ inputMode: "search", enterKeyHint: "search", autoCapitalize: "none" });
  });

  it("an amount gets the number pad, with a point where it takes one", () => {
    expect(keyboardFor({ inputMode: "numeric" })).toEqual({ inputMode: "numeric", autoCorrect: "off", spellCheck: false });
    expect(keyboardFor({ inputMode: "decimal" })).toEqual({ inputMode: "decimal", autoCorrect: "off", spellCheck: false });
    expect(keyboardFor({ type: "number" }).inputMode).toBe("numeric");
  });

  it("a name is capitalised by word and not corrected; an address by word", () => {
    expect(keyboardFor({ autoComplete: "given-name" })).toEqual({ autoCapitalize: "words", autoCorrect: "off", spellCheck: false });
    expect(keyboardFor({ autoComplete: "name" }).autoCapitalize).toBe("words");
    expect(keyboardFor({ autoComplete: "street-address" })).toEqual({ autoCapitalize: "words" });
  });

  it("says nothing for an ordinary line of text, which the phone's own default suits", () => {
    expect(keyboardFor({ type: "text" })).toEqual({});
    expect(keyboardFor({})).toEqual({});
    expect(keyboardFor({ autoComplete: "off" })).toEqual({});
  });

  it("a box for prose starts sentences with a capital and its return key makes a new line", () => {
    expect(PROSE_KEYBOARD).toEqual({ autoCapitalize: "sentences", enterKeyHint: "enter" });
  });
});

describe("Enter in a message box", () => {
  const enter = { key: "Enter", shiftKey: false, isComposing: false };

  it("sends on a computer, and Shift and Enter makes a new line", () => {
    expect(enterSends(enter, false)).toBe(true);
    expect(enterSends({ ...enter, shiftKey: true }, false)).toBe(false);
  });

  it("makes a new line on a phone: the button sends", () => {
    expect(enterSends(enter, true)).toBe(false);
    expect(enterSends({ ...enter, shiftKey: true }, true)).toBe(false);
  });

  it("never sends while a word is still being composed, or for any other key", () => {
    expect(enterSends({ ...enter, isComposing: true }, false)).toBe(false);
    expect(enterSends({ key: "a", shiftKey: false, isComposing: false }, false)).toBe(false);
  });

  it("tells the phone's return key what it will do", () => {
    expect(composerEnterKeyHint(true)).toBe("enter");
    expect(composerEnterKeyHint(false)).toBe("send");
  });
});
