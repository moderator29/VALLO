import { describe, expect, it } from "vitest";
import {
  cleanAmount,
  cleanCode,
  cleanEmail,
  cleanPhone,
  firstLines,
  isLongText,
  isValloHost,
  lonelyLink,
  LONG_TEXT_CHARS,
  mediaFrom,
  overBy,
  readPaste,
  valloLinkOf,
} from "./parse";

/** A clipboard item, as the browser hands one over. */
function item(kind: "file" | "string", file: File | null): DataTransferItem {
  return { kind, getAsFile: () => file } as unknown as DataTransferItem;
}
function transfer(items: DataTransferItem[], text = ""): DataTransfer {
  return { items, getData: () => text } as unknown as DataTransfer;
}
const png = (name = "shot.png") => new File([new Uint8Array([1])], name, { type: "image/png" });
const pdf = () => new File([new Uint8Array([1])], "deed.pdf", { type: "application/pdf" });

describe("what a paste is", () => {
  it("takes every image and video, and counts what it refused", () => {
    const out = mediaFrom([item("file", png()), item("file", pdf()), item("string", null)]);
    expect(out.files).toHaveLength(1);
    expect(out.refused).toBe(1);
  });

  it("several pasted at once become several", () => {
    const paste = readPaste(transfer([item("file", png("a.png")), item("file", png("b.png"))]));
    expect(paste.kind).toBe("files");
    if (paste.kind === "files") expect(paste.files).toHaveLength(2);
  });

  it("holds a wall of words as a chip, and lets a short paste through", () => {
    expect(isLongText("a".repeat(LONG_TEXT_CHARS + 1))).toBe(true);
    expect(isLongText(Array(13).fill("line").join("\n"))).toBe(true);
    expect(isLongText("Hello, is the flat still free?")).toBe(false);
    const long = readPaste(transfer([], "x".repeat(900)));
    expect(long.kind).toBe("long-text");
    const short = readPaste(transfer([], "see you at three"));
    expect(short.kind).toBe("text");
  });

  it("reads one address on its own as a link, never a sentence with one in it", () => {
    expect(lonelyLink("  https://example.com/a/b  ")).toBe("https://example.com/a/b");
    expect(lonelyLink("www.example.com")).toBe("https://www.example.com");
    expect(lonelyLink("look at https://example.com")).toBeNull();
    expect(lonelyLink("just words")).toBeNull();
  });

  it("gives a link chip its host and path", () => {
    const paste = readPaste(transfer([], "https://www.example.com/homes/42?ref=x"));
    expect(paste.kind).toBe("link");
    if (paste.kind === "link") {
      expect(paste.host).toBe("example.com");
      expect(paste.path).toBe("/homes/42");
      expect(paste.vallo).toBeNull();
    }
  });
});

describe("a Vallo address", () => {
  it("knows its own host, including the deployment being read", () => {
    expect(isValloHost("vallospaces.com")).toBe(true);
    expect(isValloHost("www.vallospaces.com")).toBe(true);
    expect(isValloHost("evil.com")).toBe(false);
    expect(isValloHost("localhost:3000", "http://localhost:3000")).toBe(true);
  });

  it("names the thing a Vallo link points at", () => {
    expect(valloLinkOf("https://vallospaces.com/listing/abc-123")).toEqual({ thing: "listing", id: "abc-123" });
    expect(valloLinkOf("https://vallospaces.com/stay/s1")).toEqual({ thing: "stay", id: "s1" });
    expect(valloLinkOf("https://vallospaces.com/u/ada_o")).toEqual({ thing: "profile", id: "ada_o" });
    expect(valloLinkOf("https://vallospaces.com/post/p9")).toEqual({ thing: "post", id: "p9" });
  });

  it("draws no card for a half address or somebody else's host", () => {
    expect(valloLinkOf("https://vallospaces.com/listing/")).toBeNull();
    expect(valloLinkOf("https://vallospaces.com/settings/privacy")).toBeNull();
    /* The host is what decides, never the path: a stranger's address that
       copies Vallo's shape is still a stranger's address. */
    expect(valloLinkOf("https://evil.com/listing/abc-123")).toBeNull();
  });
});

describe("cleaning a paste", () => {
  it("strips a phone number to its digits, keeping a leading plus", () => {
    expect(cleanPhone(" +234 (0) 801-234-5678 ")).toBe("+23408012345678");
    expect(cleanPhone("0801 234 5678")).toBe("08012345678");
  });

  it("strips an amount to a number, both decimal customs", () => {
    expect(cleanAmount("NGN 1,250,000.50")).toBe("1250000.50");
    expect(cleanAmount("₦ 1 250 000")).toBe("1250000");
    expect(cleanAmount("1250,50")).toBe("1250.50");
    expect(cleanAmount("1,250")).toBe("1250");
    expect(cleanAmount("about three million")).toBeNull();
  });

  it("trims and lowers an email, and reads the digits of a code", () => {
    expect(cleanEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(cleanCode("Your code is 492018", 6)).toBe("492018");
    expect(cleanCode("492-018", 6)).toBe("492018");
    expect(cleanCode("4920189999", 6)).toBe("492018");
  });
});

describe("the chip's face", () => {
  it("shows the first two lines and says how far over the limit it is", () => {
    expect(firstLines("one\ntwo\nthree")).toBe("one\ntwo");
    expect(overBy("x".repeat(2100), 2000)).toBe(100);
    expect(overBy("short", 2000)).toBe(0);
  });
});
