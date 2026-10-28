import { describe, expect, it } from "vitest";

import { collapseTag, decide, planCollapse, safeHref, type QueuedNotification } from "./policy";
import { isUrgentKind, wantsPush } from "./preferences";
import { localMinutes, parseClock, quietVerdict, readQuietHours, zoneOffsetMinutes } from "./quiet-hours";
import type { PushPayload } from "./types";

/**
 * The cases that actually break quiet hours in the wild, plus the two rules
 * the product cannot get wrong: money goes through at any hour, and eleven
 * things overnight is one notification in the morning.
 *
 * Every instant below is written as an explicit UTC string with the WAT wall
 * clock named beside it, because "22:00" means nothing without saying where.
 * Africa/Lagos is UTC+1 all year and observes no daylight saving, so 21:00Z
 * is 22:00 in Lagos, every day of the year.
 */

const LAGOS = "Africa/Lagos";

function at(iso: string): Date {
  return new Date(iso);
}

const QUIET_NIGHT = { enabled: true, from: "22:00", to: "07:00", timezone: LAGOS };

describe("the zone, which is the whole point of doing this in WAT", () => {
  it("knows Lagos is one hour east of UTC, in January and in July", () => {
    expect(zoneOffsetMinutes(LAGOS, at("2026-01-15T12:00:00Z"))).toBe(60);
    expect(zoneOffsetMinutes(LAGOS, at("2026-07-15T12:00:00Z"))).toBe(60);
  });

  it("reads the local wall clock, not the UTC one", () => {
    /* 21:00Z is 22:00 in Lagos. Reading this in UTC is the mistake that
       would start every quiet window an hour late for everybody. */
    expect(localMinutes(LAGOS, at("2026-03-01T21:00:00Z"))).toBe(22 * 60);
    expect(localMinutes("UTC", at("2026-03-01T21:00:00Z"))).toBe(21 * 60);
  });

  it("handles midnight without being an hour out", () => {
    /* 23:00Z is 00:00 the next day in Lagos. Some runtimes format that hour
       as 24 and some as 0; both must read as zero minutes past midnight. */
    expect(localMinutes(LAGOS, at("2026-03-01T23:00:00Z"))).toBe(0);
  });

  it("falls back rather than silently computing in UTC for an unknown zone", () => {
    expect(zoneOffsetMinutes("Mars/Olympus", at("2026-03-01T12:00:00Z"))).toBeNull();
    /* And the verdict still resolves, in the platform's own zone. */
    const verdict = quietVerdict({
      quiet: { ...QUIET_NIGHT, timezone: "Mars/Olympus" },
      at: at("2026-03-01T23:30:00Z"),
      urgent: false,
    });
    expect(verdict.held).toBe(true);
  });
});

describe("a window that wraps past midnight, which is the classic defect", () => {
  it("holds at 23:30 Lagos and says when it opens", () => {
    /* 22:30Z is 23:30 in Lagos: inside 22:00 to 07:00. */
    const verdict = quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-01T22:30:00Z"), urgent: false });
    expect(verdict.held).toBe(true);
    if (!verdict.held) throw new Error("unreachable");
    /* It must open at 07:00 Lagos on 2 March, which is 06:00Z. */
    expect(verdict.until.toISOString()).toBe("2026-03-02T06:00:00.000Z");
  });

  it("holds at 03:00 Lagos, on the far side of midnight, and opens the same morning", () => {
    /* 02:00Z on 2 March is 03:00 Lagos on 2 March. */
    const verdict = quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-02T02:00:00Z"), urgent: false });
    expect(verdict.held).toBe(true);
    if (!verdict.held) throw new Error("unreachable");
    expect(verdict.until.toISOString()).toBe("2026-03-02T06:00:00.000Z");
  });

  it("sends at midday", () => {
    expect(quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-01T11:00:00Z"), urgent: false }).held).toBe(false);
  });

  it("is inclusive at the start and exclusive at the end", () => {
    /* Exactly 22:00 Lagos is inside. */
    expect(quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-01T21:00:00Z"), urgent: false }).held).toBe(true);
    /* Exactly 07:00 Lagos is outside: the window has opened. */
    expect(quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-01T06:00:00Z"), urgent: false }).held).toBe(false);
    /* One minute before seven is still inside. */
    expect(quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-01T05:59:00Z"), urgent: false }).held).toBe(true);
  });

  it("handles a window that does NOT wrap, the other direction of the same bug", () => {
    const daytimeNap = { enabled: true, from: "13:00", to: "15:00", timezone: LAGOS };
    /* 13:00Z is 14:00 Lagos: inside. */
    expect(quietVerdict({ quiet: daytimeNap, at: at("2026-03-01T13:00:00Z"), urgent: false }).held).toBe(true);
    /* 23:00Z is midnight Lagos: outside a window that does not wrap. */
    expect(quietVerdict({ quiet: daytimeNap, at: at("2026-03-01T23:00:00Z"), urgent: false }).held).toBe(false);
  });
});

describe("what quiet hours may never do", () => {
  it("never holds an urgent notification, at three in the morning", () => {
    expect(quietVerdict({ quiet: QUIET_NIGHT, at: at("2026-03-02T02:00:00Z"), urgent: true }).held).toBe(false);
  });

  it("treats wallet as urgent, following the database's own decision", () => {
    expect(isUrgentKind("wallet")).toBe(true);
    expect(isUrgentKind("message")).toBe(false);
    expect(isUrgentKind("social")).toBe(false);
  });

  it("delivers when the window is disabled, malformed, or zero width", () => {
    const night = at("2026-03-02T02:00:00Z");
    expect(quietVerdict({ quiet: { ...QUIET_NIGHT, enabled: false }, at: night, urgent: false }).held).toBe(false);
    expect(quietVerdict({ quiet: { ...QUIET_NIGHT, from: "not a time" }, at: night, urgent: false }).held).toBe(false);
    expect(quietVerdict({ quiet: { ...QUIET_NIGHT, from: "25:00" }, at: night, urgent: false }).held).toBe(false);
    expect(quietVerdict({ quiet: { ...QUIET_NIGHT, from: "22:00", to: "22:00" }, at: night, urgent: false }).held).toBe(false);
  });

  it("parses only real clock strings", () => {
    expect(parseClock("07:00")).toBe(420);
    expect(parseClock("7:00")).toBe(420);
    expect(parseClock("23:59")).toBe(1439);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("07:60")).toBeNull();
    expect(parseClock(700)).toBeNull();
    expect(parseClock(null)).toBeNull();
  });
});

describe("reading a settings document several versions of the app have written", () => {
  it("defaults to off, in Lagos, when nothing is stored", () => {
    const quiet = readQuietHours({});
    expect(quiet.enabled).toBe(false);
    expect(quiet.timezone).toBe(LAGOS);
    expect(readQuietHours(null).timezone).toBe(LAGOS);
    expect(readQuietHours("nonsense").enabled).toBe(false);
  });

  it("keeps a stored zone and repairs a malformed time", () => {
    const quiet = readQuietHours({
      notifications: { quiet_hours: { enabled: true, from: "oops", to: "06:30", timezone: "Europe/London" } },
    });
    expect(quiet.enabled).toBe(true);
    expect(quiet.timezone).toBe("Europe/London");
    expect(quiet.from).toBe("22:00");
    expect(quiet.to).toBe("06:30");
  });

  it("an explicit channel answer beats the old boolean", () => {
    const settings = {
      notifications: { messages: false, channels: { messages: { app: true, email: false, push: true } } },
    };
    expect(wantsPush(settings, "message")).toBe(true);
  });

  it("the old boolean governs when no channel answer exists", () => {
    expect(wantsPush({ notifications: { bookings: false } }, "booking")).toBe(false);
    expect(wantsPush({ notifications: { bookings: true } }, "booking")).toBe(true);
  });

  it("a missing or malformed value means deliver, which is the house rule", () => {
    expect(wantsPush({}, "booking")).toBe(true);
    expect(wantsPush({ notifications: { bookings: "yes" } }, "booking")).toBe(true);
    expect(wantsPush({ notifications: { channels: { messages: { push: "yes" } } } }, "message")).toBe(true);
    expect(wantsPush(null, "message")).toBe(true);
  });

  it("support and system are never silenced, because no switch claims to", () => {
    const off = { notifications: { channels: { messages: { push: false }, bookings: { push: false } } } };
    expect(wantsPush(off, "support")).toBe(true);
    expect(wantsPush(off, "system")).toBe(true);
  });

  it("marketing is the one topic that is off until somebody says yes", () => {
    expect(wantsPush({}, "social")).toBe(true);
    /* social is not marketing; marketing has no kind of its own today, so
       the rule is asserted through the topic reader it governs. */
    expect(wantsPush({ notifications: { channels: { social: { push: false } } } }, "social")).toBe(false);
  });
});

describe("the order the decision is taken in", () => {
  function note(overrides: Partial<QueuedNotification> = {}): QueuedNotification {
    return {
      queueId: "q1",
      userId: "u1",
      kind: "message",
      title: "Somebody replied",
      body: "About the flat in Wuse",
      href: "/messages/1",
      createdAt: at("2026-03-01T20:00:00Z"),
      expiresAt: at("2026-03-02T08:00:00Z"),
      ...overrides,
    };
  }

  it("expiry is decided before preference, so a stale push is never argued about", () => {
    const decision = decide({
      notification: note({ expiresAt: at("2026-03-01T10:00:00Z") }),
      settings: { notifications: { messages: false } },
      now: at("2026-03-01T12:00:00Z"),
    });
    expect(decision).toEqual({ action: "suppress", outcome: "suppressed_expired" });
  });

  it("preference is decided before quiet hours", () => {
    const decision = decide({
      notification: note(),
      settings: { notifications: { messages: false, quiet_hours: QUIET_NIGHT } },
      now: at("2026-03-01T23:00:00Z"),
    });
    expect(decision).toEqual({ action: "suppress", outcome: "suppressed_preference" });
  });

  it("holds through the night and sends in the morning", () => {
    const held = decide({
      notification: note(),
      settings: { notifications: { quiet_hours: QUIET_NIGHT } },
      now: at("2026-03-01T23:00:00Z"),
    });
    expect(held.action).toBe("hold");

    const sent = decide({
      notification: note(),
      settings: { notifications: { quiet_hours: QUIET_NIGHT } },
      now: at("2026-03-02T07:00:00Z"),
    });
    expect(sent.action).toBe("send");
  });

  it("does not hold past the row's own expiry, which would be a slow suppression", () => {
    const decision = decide({
      notification: note({ expiresAt: at("2026-03-02T03:00:00Z") }),
      settings: { notifications: { quiet_hours: QUIET_NIGHT } },
      now: at("2026-03-01T23:00:00Z"),
    });
    expect(decision).toEqual({ action: "suppress", outcome: "suppressed_expired" });
  });

  it("money goes out at three in the morning", () => {
    const decision = decide({
      notification: note({ kind: "wallet", title: "A transfer was reversed" }),
      settings: { notifications: { quiet_hours: QUIET_NIGHT } },
      now: at("2026-03-02T02:00:00Z"),
    });
    expect(decision.action).toBe("send");
  });
});

describe("where a tap lands", () => {
  it("refuses anything that is not a path on our own origin", () => {
    expect(safeHref("/messages/1")).toBe("/messages/1");
    expect(safeHref("https://evil.example/steal")).toBe("/notifications");
    expect(safeHref("//evil.example/steal")).toBe("/notifications");
    expect(safeHref(null)).toBe("/notifications");
    expect(safeHref("javascript:alert(1)")).toBe("/notifications");
  });

  it("collapses per kind rather than per notification", () => {
    expect(collapseTag("message")).toBe(collapseTag("message"));
    expect(collapseTag("message")).not.toBe(collapseTag("booking"));
  });
});

describe("collapsing a night's backlog", () => {
  function candidate(id: string, minutes: number, urgent = false): { queueId: string; payload: PushPayload; createdAt: Date } {
    return {
      queueId: id,
      payload: { title: `t${id}`, body: "b", href: "/x", tag: "vallo-message", urgent },
      createdAt: new Date(Date.UTC(2026, 2, 1, 22, minutes)),
    };
  }

  it("sends a small number individually", () => {
    const plan = planCollapse([candidate("a", 1), candidate("b", 2), candidate("c", 3)]);
    expect(plan.send).toHaveLength(3);
    expect(plan.collapsed).toHaveLength(0);
  });

  it("folds eleven into one, carried by the newest", () => {
    const many = Array.from({ length: 11 }, (_, index) => candidate(`n${index}`, index));
    const plan = planCollapse(many);
    expect(plan.send).toHaveLength(1);
    expect(plan.collapsed).toHaveLength(10);
    /* The newest carries it, so a tap lands on something recent. */
    const summary = plan.send[0];
    if (!summary) throw new Error("expected one summary");
    expect(summary.queueId).toBe("n10");
    expect(summary.payload.body).toBe("11 things happened while you were away");
    expect(summary.payload.href).toBe("/notifications");
    expect(plan.collapsed.every((row) => row.into === "n10")).toBe(true);
  });

  it("never folds an urgent notification into a summary", () => {
    const many = Array.from({ length: 8 }, (_, index) => candidate(`n${index}`, index));
    const plan = planCollapse([...many, candidate("money", 30, true)]);
    const sentIds = plan.send.map((row) => row.queueId);
    expect(sentIds).toContain("money");
    expect(plan.collapsed.map((row) => row.queueId)).not.toContain("money");
    /* One summary for the eight, plus the one that would not be folded. */
    expect(plan.send).toHaveLength(2);
  });
});

describe("an incoming call's ring push (27 October 2026)", () => {
  const now = new Date("2026-10-28T10:00:00Z");
  const queued = (href: string, expiresAt: string): QueuedNotification => ({
    queueId: "n1",
    userId: "u1",
    kind: "message",
    title: "Ada",
    body: "Voice call",
    href,
    createdAt: now,
    expiresAt: new Date(expiresAt),
  });

  it("is held no longer than the ring, on the calls channel", () => {
    const ring = decide({
      settings: {},
      now,
      notification: queued(
        "/messages/11111111-1111-1111-1111-111111111111?call=22222222-2222-2222-2222-222222222222",
        "2026-10-28T10:00:45Z",
      ),
    });
    expect(ring).toMatchObject({ action: "send", payload: { call: true, ttlSeconds: 45 } });
  });

  it("an ordinary message keeps the long default and the ordinary channel", () => {
    const plain = decide({
      settings: {},
      now,
      notification: queued("/messages/11111111-1111-1111-1111-111111111111", "2026-10-29T10:00:00Z"),
    });
    expect(plain).toMatchObject({ action: "send" });
    if (plain.action !== "send") throw new Error("expected send");
    expect(plain.payload.call).toBeUndefined();
    expect(plain.payload.ttlSeconds).toBeUndefined();
  });
});
