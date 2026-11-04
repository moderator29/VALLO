import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/listings/types";
import { newShelf, newestFirst } from "./new-listings";

const at = (id: string, publishedAt?: string) => ({ id, publishedAt }) as Listing;

describe("new listings", () => {
  it("puts the most recently published first", () => {
    const rows = [at("old", "2026-08-01T10:00:00Z"), at("new", "2026-10-12T08:00:00Z"), at("mid", "2026-09-15T08:00:00Z")];
    expect(newestFirst(rows, 6).map((l) => l.id)).toEqual(["new", "mid", "old"]);
  });

  it("puts a row with no date, or one that does not parse, last", () => {
    const rows = [at("none"), at("bad", "yesterday"), at("dated", "2026-01-01T00:00:00Z")];
    expect(newestFirst(rows, 6).map((l) => l.id)).toEqual(["dated", "none", "bad"]);
  });

  it("keeps the order rows came in when their dates are equal", () => {
    const same = "2026-10-01T00:00:00Z";
    expect(newestFirst([at("a", same), at("b", same), at("c", same)], 6).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("stops at the limit and does not change what it was given", () => {
    const rows = [at("a", "2026-10-01T00:00:00Z"), at("b", "2026-10-02T00:00:00Z"), at("c", "2026-10-03T00:00:00Z")];
    expect(newestFirst(rows, 2).map((l) => l.id)).toEqual(["c", "b"]);
    expect(rows.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});

describe("the new shelf puts real listings first", () => {
  const NOW = Date.parse("2026-11-04T12:00:00Z");
  const row = (id: string, publishedAt: string, isDemo: boolean) => ({ id, publishedAt, isDemo }) as Listing;

  it("ranks a real listing from this week above a newer-looking example", () => {
    const rows = [row("example", "2026-11-03T00:00:00Z", true), row("real", "2026-11-04T09:00:00Z", false)];
    expect(newShelf(rows, 6, NOW).map((l) => l.id)).toEqual(["real", "example"]);
  });

  it("fills with examples only when there are too few real ones, so it is never empty", () => {
    const rows = [row("example", "2026-10-30T00:00:00Z", true)];
    expect(newShelf(rows, 6, NOW).map((l) => l.id)).toEqual(["example"]);
  });

  it("leaves out a real listing that went live over thirty days ago from the front", () => {
    const rows = [row("old-real", "2026-08-01T00:00:00Z", false), row("fresh-example", "2026-11-01T00:00:00Z", true)];
    expect(newShelf(rows, 1, NOW).map((l) => l.id)).toEqual(["fresh-example"]);
  });
});
