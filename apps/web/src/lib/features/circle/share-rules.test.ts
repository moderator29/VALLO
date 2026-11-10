import { describe, expect, it } from "vitest";

import { postingRefusal, shareableCircles } from "./share-rules";

const community = (id: string, name: string, status = "live") => ({ id, slug: name.toLowerCase(), name, category: "roommates", visibility: "public" as const, status });

describe("which Circles a Roommates page can be shared into", () => {
  it("an active member of a live community may post; anything else is refused with a reason", () => {
    expect(postingRefusal({ status: "active", role: "member" }, { status: "live" })).toBeNull();
    expect(postingRefusal({ status: "requested", role: "member" }, { status: "live" })).toBe("not_member");
    expect(postingRefusal(null, { status: "live" })).toBe("not_member");
    expect(postingRefusal({ status: "active", role: "member" }, { status: "paused" })).toBe("not_live");
    expect(postingRefusal({ status: "active", role: "owner" }, { status: "removed" })).toBe("not_live");
    expect(postingRefusal({ status: "active", role: "member" }, null)).toBe("not_live");
  });

  it("lists only postable Circles, by name, and says how many the person is in", () => {
    const out = shareableCircles([
      { status: "active", role: "member", community: community("1", "Zeta") },
      { status: "active", role: "member", community: community("2", "Alpha") },
      { status: "active", role: "member", community: community("3", "Paused one", "paused") },
      { status: "requested", role: "member", community: community("4", "Waiting") },
      { status: "active", role: "member", community: null },
    ]);
    expect(out.circles.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
    expect(out.memberOf).toBe(3);
    expect(out.circles[0]).not.toHaveProperty("status");
  });

  it("a person in none, and a person in only closed ones, are told apart", () => {
    expect(shareableCircles([])).toEqual({ circles: [], memberOf: 0 });
    expect(shareableCircles([{ status: "active", role: "member", community: community("3", "Paused", "paused") }])).toEqual({ circles: [], memberOf: 1 });
  });
});
