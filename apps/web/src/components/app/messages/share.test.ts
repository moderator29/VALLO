import { describe, expect, it } from "vitest";
import { cardRefFor, parseShare, shareBody, shareHref, sharePreview } from "./share";

const ID = "0f5a7c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b";

describe("a share body", () => {
  it("round-trips a listing", () => {
    const body = shareBody({ kind: "listing", id: ID });
    expect(body).toBe(`Shared a listing\n/listing/${ID}`);
    expect(parseShare(body)).toEqual({ kind: "listing", id: ID });
  });

  it("round-trips a booking onto the trips route", () => {
    const body = shareBody({ kind: "booking", id: ID });
    expect(shareHref({ kind: "booking", id: ID })).toBe(`/bookings/${ID}`);
    expect(parseShare(body)).toEqual({ kind: "booking", id: ID });
  });

  it("round-trips a stay onto its own route, not the listing one", () => {
    const body = shareBody({ kind: "stay", id: ID });
    expect(body).toBe(`Shared a stay\n/stay/${ID}`);
    expect(shareHref({ kind: "stay", id: ID })).toBe(`/stay/${ID}`);
    expect(parseShare(body)).toEqual({ kind: "stay", id: ID });
  });

  it("round-trips a Vallo Roommates post onto its own route", () => {
    const body = shareBody({ kind: "roommate", id: ID });
    expect(body).toBe(`Shared a room\n/roommates/r/${ID}`);
    expect(shareHref({ kind: "roommate", id: ID })).toBe(`/roommates/r/${ID}`);
    expect(parseShare(body)).toEqual({ kind: "roommate", id: ID });
    expect(parseShare(`/roommates/r/${ID}`)).toEqual({ kind: "roommate", id: ID });
    expect(sharePreview(body)).toBe("Shared a room");
    expect(parseShare(`/roommates/p/${ID}`)).toBeNull();
  });

  it("keeps stay and listing apart, because their ids come from different tables", () => {
    expect(parseShare(`/stay/${ID}`)).toEqual({ kind: "stay", id: ID });
    expect(parseShare(`/listing/${ID}`)).toEqual({ kind: "listing", id: ID });
    /* `/stays` is the browse index, not a share. */
    expect(parseShare(`/stays/${ID}`)).toBeNull();
  });

  it("accepts the bare path and ignores case", () => {
    expect(parseShare(`/LISTING/${ID.toUpperCase()}`)).toEqual({ kind: "listing", id: ID });
  });

  it("leaves prose that mentions a path as prose", () => {
    expect(parseShare(`Have a look at /listing/${ID} when you can`)).toBeNull();
    expect(parseShare("Hello")).toBeNull();
    expect(parseShare("/listing/not-a-uuid")).toBeNull();
  });

  it("previews a share as words, never as a path", () => {
    expect(sharePreview(shareBody({ kind: "booking", id: ID }))).toBe("Shared a booking");
    expect(sharePreview("Are you free on Saturday?")).toBeNull();
  });

  it("round-trips a member's Vallo passport onto its own route", () => {
    const body = shareBody({ kind: "passport", id: ID });
    expect(body).toBe(`Shared a passport\n/passport/${ID}`);
    expect(shareHref({ kind: "passport", id: ID })).toBe(`/passport/${ID}`);
    expect(parseShare(body)).toEqual({ kind: "passport", id: ID });
    expect(parseShare(`/PASSPORT/${ID.toUpperCase()}`)).toEqual({ kind: "passport", id: ID });
    expect(sharePreview(body)).toBe("Shared a passport");
  });

  it("does not read a passport address with a handle in it as a share (cards carry account ids)", () => {
    expect(parseShare("/passport/ada")).toBeNull();
    expect(parseShare(`Look at /passport/${ID} please`)).toBeNull();
  });
});

describe("which messages draw as a card (cardRefFor), for the page and for a live arrival", () => {
  const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("draws a listing, a stay and a booking whoever sent them", () => {
    for (const kind of ["listing", "stay", "booking"] as const) {
      const body = shareBody({ kind, id: ID });
      expect(cardRefFor({ body, senderId: OTHER })).toEqual({ kind, id: ID });
      expect(cardRefFor({ body })).toEqual({ kind, id: ID });
    }
  });

  it("draws a passport only for the member it belongs to", () => {
    const body = shareBody({ kind: "passport", id: ID });
    expect(cardRefFor({ body, senderId: ID })).toEqual({ kind: "passport", id: ID });
    expect(cardRefFor({ body, senderId: OTHER })).toBeNull();
    expect(cardRefFor({ body, senderId: null })).toBeNull();
    expect(cardRefFor({ body })).toBeNull();
  });

  it("draws nothing for ordinary words", () => {
    expect(cardRefFor({ body: "See you at 4", senderId: ID })).toBeNull();
  });
});
