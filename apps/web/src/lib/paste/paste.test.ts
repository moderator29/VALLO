import { describe, expect, it } from "vitest";

import { offPlatformAsk } from "@/lib/messages/off-platform-ask";
import {
  LONG_PASTE,
  chipPreview,
  cleanPastedAmount,
  cleanPastedEmail,
  cleanPastedFigure,
  cleanPastedPhone,
  composeBody,
  isLongPaste,
  linkParts,
  overBy,
  pastedCode,
  readPastedText,
  soleLink,
  sortPastedFiles,
  valloLink,
  type PasteChip,
} from "./paste";

const ID = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

describe("which pasted text is held as a chip", () => {
  it("lets a short paste land in the field as it always did", () => {
    expect(readPastedText("Is it still available?")).toEqual({ kind: "plain" });
    expect(isLongPaste("a".repeat(LONG_PASTE.chars))).toBe(false);
    expect(isLongPaste(Array.from({ length: LONG_PASTE.lines }, () => "line").join("\n"))).toBe(false);
  });

  it("holds a paste over 800 characters or over twelve lines", () => {
    expect(isLongPaste("a".repeat(LONG_PASTE.chars + 1))).toBe(true);
    const thirteen = Array.from({ length: LONG_PASTE.lines + 1 }, (_, i) => `line ${i}`).join("\n");
    expect(readPastedText(thirteen)).toEqual({ kind: "long", text: thirteen });
  });

  it("shows the first two lines that have words in them", () => {
    expect(chipPreview("\n  Dear Nora,\n\nThe flat on Admiralty Way\nis still open.")).toBe("Dear Nora,\nThe flat on Admiralty Way");
  });
});

describe("a pasted link", () => {
  it("is a link only when the whole paste is one address", () => {
    expect(soleLink(" https://example.com/a/b?c=1 ")).toBe("https://example.com/a/b?c=1");
    expect(soleLink("www.example.com/x")).toBe("https://www.example.com/x");
    expect(soleLink("see https://example.com")).toBeNull();
    expect(soleLink("javascript:alert(1)")).toBeNull();
    expect(soleLink("https://nohost")).toBeNull();
  });

  it("shows the host and the path, in the address's own words", () => {
    expect(linkParts("https://www.example.com/rooms/12?ref=a")).toEqual({ host: "example.com", path: "/rooms/12?ref=a" });
    expect(linkParts("https://example.com/")).toEqual({ host: "example.com", path: "" });
  });

  it("knows a Vallo listing, stay, room, post and profile", () => {
    expect(valloLink(`https://www.vallospaces.com/listing/${ID}`)).toEqual({ kind: "listing", id: ID, path: `/listing/${ID}` });
    expect(valloLink(`https://vallospaces.com/stay/${ID}/`)?.kind).toBe("stay");
    expect(valloLink(`https://vallospaces.com/roommates/r/${ID}`)?.kind).toBe("roommate");
    expect(valloLink(`https://vallospaces.com/post/${ID}?reply=1`)?.kind).toBe("post");
    expect(valloLink("https://vallospaces.com/u/Seyifunmi")).toEqual({ kind: "profile", id: "seyifunmi", path: "/u/seyifunmi" });
  });

  it("never takes a lookalike host, plain http or an unknown page for Vallo's own", () => {
    expect(valloLink(`https://vallospaces.com.evil.example/listing/${ID}`)).toBeNull();
    expect(valloLink(`https://evil.example/vallospaces.com/listing/${ID}`)).toBeNull();
    expect(valloLink(`http://vallospaces.com/listing/${ID}`)).toBeNull();
    expect(valloLink("https://vallospaces.com/listing/not-an-id")).toBeNull();
    expect(valloLink("https://vallospaces.com/settings")).toBeNull();
  });

  it("takes the page's own host, so a development server reads its own links", () => {
    expect(valloLink(`http://localhost:3210/listing/${ID}`, ["localhost:3210"])?.kind).toBe("listing");
    expect(valloLink(`http://localhost:9999/listing/${ID}`, ["localhost:3210"])).toBeNull();
  });

  it("reads a pasted address as a link before it reads it as long text", () => {
    const long = `https://example.com/${"a".repeat(900)}`;
    expect(readPastedText(long).kind).toBe("link");
  });
});

describe("pasted files", () => {
  const photo = { type: "image/png", name: "a.png" };
  const pdf = { type: "application/pdf", name: "lease.pdf" };
  const video = { type: "video/mp4", name: "walk.mp4" };

  it("takes photos through the composer's own rule and refuses the rest", () => {
    expect(sortPastedFiles([photo, pdf, photo, video])).toEqual({ taken: [photo, photo], refused: [pdf, video], overflow: 0 });
  });

  it("takes a video only where the composer does", () => {
    const takes = (f: { type: string }) => f.type.startsWith("image/") || f.type.startsWith("video/");
    expect(sortPastedFiles([photo, pdf, video], { takes }).taken).toEqual([photo, video]);
  });

  it("holds no more than there is room for, and counts the rest apart from the refused", () => {
    expect(sortPastedFiles([photo, photo, photo, pdf], { room: 2 })).toEqual({ taken: [photo, photo], refused: [pdf], overflow: 1 });
  });
});

describe("the message's text", () => {
  const chips: PasteChip[] = [
    { id: "a", kind: "text", text: "  First pasted block.  " },
    { id: "b", kind: "link", href: "https://example.com/x", vallo: null },
  ];

  it("is what was typed, then each held paste, in order", () => {
    expect(composeBody(" Hello ", chips)).toBe("Hello\n\nFirst pasted block.\n\nhttps://example.com/x");
    expect(composeBody("", [chips[0]!])).toBe("First pasted block.");
    expect(composeBody("Hello", [])).toBe("Hello");
  });

  it("says how far over the message's own limit it is", () => {
    expect(overBy("a".repeat(2000), 2000)).toBe(0);
    expect(overBy("a".repeat(2312), 2000)).toBe(312);
  });

  it("is read by the scam shield exactly as typed text is", () => {
    const words = "Please pay the caution fee to my GTBank account 0123456789 before the viewing.";
    const typed = composeBody(words, []);
    const pasted = composeBody("", [{ id: "a", kind: "text", text: words }]);
    expect(pasted).toBe(typed);
    expect(offPlatformAsk(pasted)).toEqual(offPlatformAsk(typed));
    /* And the check is a real one: these words are an ask. */
    expect(offPlatformAsk(pasted)).not.toBeNull();
  });
});

describe("what paste cleans", () => {
  it("a phone number loses its spaces, dashes and brackets and keeps a leading plus", () => {
    expect(cleanPastedPhone(" +234 (803) 123-4567 ")).toBe("+2348031234567");
    expect(cleanPastedPhone("0803 123 4567")).toBe("08031234567");
    expect(cleanPastedPhone("call me")).toBe("");
  });

  it("an amount loses its currency sign and commas and lands as a number", () => {
    expect(cleanPastedAmount("₦1,250,000.00")).toBe(1250000);
    expect(cleanPastedAmount("NGN 1 250 000")).toBe(1250000);
    expect(cleanPastedAmount("N450,000")).toBe(450000);
    expect(cleanPastedAmount("1.25m")).toBe(1250000);
    expect(cleanPastedAmount("750k per year")).toBe(750000);
    expect(cleanPastedAmount("call for price")).toBeNull();
  });

  it("an amount lands in a naira field as its plain figure, with kobo only where the field takes it", () => {
    expect(cleanPastedFigure("₦1,250,000.00")).toBe("1250000");
    expect(cleanPastedFigure("₦1,250,000.50", true)).toBe("1250000.50");
    expect(cleanPastedFigure("NGN 4,500.5", true)).toBe("4500.50");
    expect(cleanPastedFigure("1.25m", true)).toBe("1250000");
    expect(cleanPastedFigure("₦2,000.00", true)).toBe("2000");
    /* Plain digits are the field's own paste; words with no number are left alone. */
    expect(cleanPastedFigure("450000")).toBeNull();
    expect(cleanPastedFigure("call for price")).toBeNull();
  });

  it("an email is trimmed and lowered, out of its wrapper", () => {
    expect(cleanPastedEmail("  Seyi.Omojuni@Example.COM ")).toBe("seyi.omojuni@example.com");
    expect(cleanPastedEmail("Seyi <Seyi@Example.com>")).toBe("seyi@example.com");
    expect(cleanPastedEmail("mailto:a@b.co")).toBe("a@b.co");
  });

  it("a one-time code is found in the sentence it arrived in", () => {
    expect(pastedCode("482913", 6)).toBe("482913");
    expect(pastedCode("482 913", 6)).toBe("482913");
    expect(pastedCode("Your Vallo code is 482-913. It expires in 10 minutes.", 6)).toBe("482913");
    expect(pastedCode("Use 4829 to sign in", 4)).toBe("4829");
    expect(pastedCode("Code 482913, valid for 10 minutes", 6)).toBe("482913");
    /* A field whose limit leaves room for a space still finds the six digits. */
    expect(pastedCode("Your gate code is 123456, valid 10 minutes", 7)).toBe("123456");
    expect(pastedCode("Your Vallo code is 482 913. It expires in 10 minutes.", 8)).toBe("482913");
    expect(pastedCode("12", 6)).toBe("12");
    expect(pastedCode("no digits", 6)).toBe("");
  });

  it("never hides a digit too many: the surplus is the form's to say", () => {
    expect(pastedCode("4829137", 6)).toBe("4829137");
  });
});
