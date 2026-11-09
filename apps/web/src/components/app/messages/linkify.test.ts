import { describe, expect, it } from "vitest";
import { linkify } from "./linkify";

describe("links in a message", () => {
  it("draws words as words", () => {
    expect(linkify("Is the flat still available?")).toEqual([{ kind: "text", text: "Is the flat still available?" }]);
  });

  it("finds http, https and www addresses, leaving the full stop with the sentence", () => {
    expect(linkify("See https://vallo.ng/listing/abc. Thanks")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", href: "https://vallo.ng/listing/abc", label: "https://vallo.ng/listing/abc" },
      { kind: "text", text: ". Thanks" },
    ]);
    expect(linkify("www.example.com, then call")[0]).toEqual({ kind: "link", href: "https://www.example.com", label: "www.example.com" });
  });

  it("never links another scheme, and shortens a long address on screen only", () => {
    expect(linkify("javascript:alert(1)")).toEqual([{ kind: "text", text: "javascript:alert(1)" }]);
    const long = `https://example.com/${"a".repeat(80)}`;
    const [part] = linkify(long);
    expect(part).toMatchObject({ kind: "link", href: long });
    expect((part as { label: string }).label.length).toBeLessThanOrEqual(49);
  });
});
