import { describe, expect, it } from "vitest";
import { bundle, readSeverity, severityOf } from "./severity";
import { sectionRows, threadOf } from "./sections";

describe("the B11 severity table", () => {
  it("names what only you can move, with its verb", () => {
    expect(severityOf({ kind: "message", title: "New message", href: "/messages/a" })).toEqual({ severity: "action", verb: "reply" });
    expect(severityOf({ kind: "booking", title: "New booking request", href: "/host" }).verb).toBe("review");
    expect(severityOf({ kind: "wallet", title: "Withdrawal could not complete", href: "/wallet" }).verb).toBe("check");
    expect(severityOf({ kind: "system", title: "New sign-in to Vallo", href: "/settings/devices/alert?d=1" }).verb).toBe("check");
    expect(severityOf({ kind: "agent", title: "Your agent application needs more information", href: null }).verb).toBe("addDetails");
  });

  it("keeps the feed and acknowledgements quiet", () => {
    expect(severityOf({ kind: "social", title: "Somebody liked your post", href: "/post/1" }).severity).toBe("fyi");
    expect(severityOf({ kind: "social", title: "Your story is live", href: null }).severity).toBe("fyi");
    expect(severityOf({ kind: "support", title: "We have your question", href: null }).severity).toBe("fyi");
  });

  it("calls everything else an update", () => {
    expect(severityOf({ kind: "booking", title: "Booking confirmed", href: "/bookings" }).severity).toBe("update");
    expect(severityOf({ kind: "listing", title: "Price down on a place you saved", href: "/listing/1?change=price-down" }).severity).toBe("update");
  });

  it("prefers a stored severity once the column exists", () => {
    expect(readSeverity({ kind: "booking", title: "Booking confirmed", href: null, severity: "action" }).severity).toBe("action");
    expect(readSeverity({ kind: "booking", title: "Booking confirmed", href: null, severity: "nonsense" }).severity).toBe("update");
  });
});

describe("bundles", () => {
  it("folds rows about one thread or post, and nothing else", () => {
    const rows = [
      { id: "1", kind: "message", href: "/messages/a" },
      { id: "2", kind: "booking", href: "/bookings" },
      { id: "3", kind: "message", href: "/messages/a" },
      { id: "4", kind: "booking", href: "/bookings" },
    ];
    const out = bundle(rows);
    expect(out.map((b) => b.rows.map((r) => r.id))).toEqual([["1", "3"], ["2"], ["4"]]);
  });
});

describe("Needs you", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const at = "2026-09-30T10:00:00Z";
  it("keeps a message open while its thread is unread, read or not", () => {
    const rows = [
      { id: "m", kind: "message", title: "New message", href: "/messages/t1", read: true, createdAt: at },
      { id: "n", kind: "message", title: "New message", href: "/messages/t2", read: false, createdAt: at },
    ];
    const s = sectionRows(rows, new Set(["t1"]), now);
    expect(s.needsYou.map((x) => x.row.id)).toEqual(["m"]);
    expect(s.fresh.map((x) => x.row.id)).toEqual(["n"]);
  });

  it("lets an old action fall to history", () => {
    const rows = [{ id: "o", kind: "wallet", title: "Withdrawal could not complete", href: "/wallet", read: false, createdAt: "2026-09-01T10:00:00Z" }];
    const s = sectionRows(rows, new Set(), now);
    expect(s.needsYou).toHaveLength(0);
    expect(s.fresh).toHaveLength(1);
  });

  it("reads the thread out of a message address", () => {
    expect(threadOf("/agent/messages/abc?x=1")).toBe("abc");
    expect(threadOf("/messages/new")).toBeNull();
  });
});

describe("Roommates, Trust and Safety and Circle rows (8 November 2026)", () => {
  const from = "?from=6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
  it("puts a roommate request, a viewing request, a group invite and a join request in Needs you, with their verb", () => {
    expect(severityOf({ kind: "social", title: "Ada is interested in sharing a home", href: `/roommates/me?tab=requests${from}` })).toEqual({ severity: "action", verb: "viewRequest" });
    expect(severityOf({ kind: "social", title: "Ada asked to view your room", href: `/roommates/me?tab=viewings${from}` })).toEqual({ severity: "action", verb: "review" });
    expect(severityOf({ kind: "social", title: "Ada invited you to Yaba three", href: `/roommates/me?tab=groups${from}` })).toEqual({ severity: "action", verb: "openGroup" });
    expect(severityOf({ kind: "social", title: "Ada asked to join Yaba three", href: `/roommates/groups/g1${from}` })).toEqual({ severity: "action", verb: "review" });
  });
  it("reads a connection, a group post and a viewing change as updates, not the feed's fyi", () => {
    expect(severityOf({ kind: "social", title: "Ada accepted. You are connected", href: `/roommates/p/u1${from}` }).severity).toBe("update");
    expect(severityOf({ kind: "social", title: "Ada posted in Yaba three", href: `/roommates/groups/g1${from}` }).severity).toBe("update");
  });
  it("asks for a Trust and Safety message to be read, and offers See outcome on reports, appeals and restrictions", () => {
    expect(severityOf({ kind: "support", title: "A message from Vallo Trust and Safety", href: "/settings/standing?case=12" })).toEqual({ severity: "action", verb: "open" });
    expect(severityOf({ kind: "support", title: "We looked into your report", href: "/settings/standing" })).toEqual({ severity: "update", verb: "seeOutcome" });
    expect(severityOf({ kind: "system", title: "Your appeal was accepted", href: "/settings/standing" })).toEqual({ severity: "update", verb: "seeOutcome" });
    expect(severityOf({ kind: "system", title: "A restriction on your account was lifted", href: "/settings/standing" })).toEqual({ severity: "update", verb: "seeOutcome" });
  });
  it("reads Circle rows by the titles the SQL writes", () => {
    expect(severityOf({ kind: "social", title: "New reply", href: "/circle/p/p1#a-r1" })).toEqual({ severity: "action", verb: "reply" });
    expect(severityOf({ kind: "social", title: "New answer", href: "/circle/p/p1#a-r1" })).toEqual({ severity: "action", verb: "reply" });
    expect(severityOf({ kind: "social", title: "You were mentioned", href: "/circle/p/p1" })).toEqual({ severity: "action", verb: "reply" });
    expect(severityOf({ kind: "social", title: "Join request: Lekki renters", href: "/circle/c/lekki-renters/manage" })).toEqual({ severity: "action", verb: "review" });
    expect(severityOf({ kind: "social", title: "Welcome to Lekki renters", href: "/circle/c/lekki-renters" }).severity).toBe("update");
    expect(severityOf({ kind: "social", title: "Answer accepted", href: "/circle/p/p1#a-r1" }).severity).toBe("update");
    expect(severityOf({ kind: "social", title: "Your post was removed", href: "/post/p1" }).severity).toBe("update");
    expect(severityOf({ kind: "social", title: "Your post is being checked", href: "/post/p1" }).severity).toBe("fyi");
  });
});
