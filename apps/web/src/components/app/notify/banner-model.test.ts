import { describe, expect, it } from "vitest";
import { BANNER_QUEUE_MAX, bannerGlyph, bannerHeader, enqueue, faceLookup, shouldShowBanner, type BannerItem } from "./banner-model";

const item = (over: Partial<BannerItem> = {}): BannerItem => ({
  id: "n1",
  kind: "message",
  title: "Ada sent you a message",
  body: "Is it still free?",
  href: "/messages/abc",
  ...over,
});

describe("the in-app notification banner", () => {
  it("never shows on the notifications screen or for the thing already open", () => {
    expect(shouldShowBanner(item(), "/notifications")).toBe(false);
    expect(shouldShowBanner(item(), "/notifications/n1")).toBe(false);
    expect(shouldShowBanner(item(), "/messages/abc")).toBe(false);
    expect(shouldShowBanner(item({ href: "/messages/abc?x=1" }), "/messages/abc")).toBe(false);
    expect(shouldShowBanner(item(), "/home")).toBe(true);
  });

  it("queues the latest few, once each", () => {
    let q: BannerItem[] = [];
    for (let i = 0; i < 6; i += 1) q = enqueue(q, item({ id: `n${i}` }));
    expect(q).toHaveLength(BANNER_QUEUE_MAX);
    expect(q.at(-1)?.id).toBe("n5");
    expect(enqueue(q, item({ id: "n5" }))).toHaveLength(BANNER_QUEUE_MAX);
  });

  it("draws a glyph for what it is about", () => {
    expect(bannerGlyph({ kind: "message", title: "x", href: "/messages/a" })).toBe("chat");
    expect(bannerGlyph({ kind: "message", title: "Missed voice call from Ada", href: "/messages/a" })).toBe("ai-human-help");
  });
});

describe("the banner's header line and face", () => {
  it("says the lock screen's family word", () => {
    expect(bannerHeader(item())).toBe("Messages");
    expect(bannerHeader(item({ title: "Missed voice call from Ada" }))).toBe("Calls");
    expect(bannerHeader(item({ kind: "booking", title: "New booking request", href: "/bookings/b1" }))).toBe("Bookings");
    expect(bannerHeader(item({ kind: "social", title: "Chioma started following you", href: "/u/chioma" }))).toBe("Activity");
  });
  it("finds a face only where the link names a person", () => {
    expect(faceLookup("/messages/00000000-0000-4000-8000-000000000001")).toEqual({ by: "thread", id: "00000000-0000-4000-8000-000000000001" });
    expect(faceLookup("/u/chioma?tab=posts")).toEqual({ by: "handle", handle: "chioma" });
    expect(faceLookup("/bookings/b1")).toBeNull();
    expect(faceLookup(null)).toBeNull();
  });
});
