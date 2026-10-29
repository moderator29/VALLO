import { describe, expect, it } from "vitest";
import {
  CALL_TIMEOUTS,
  LIVE_STATES,
  TERMINAL_STATES,
  TRANSITIONS,
  callPhase,
  canTransition,
  durationWords,
  endReasonWords,
  hangUpIntent,
  isTerminal,
  mayJoin,
  newerSnapshot,
  overdueTransition,
  snapshotFromRow,
} from "./lifecycle";
import { vc1Migration } from "./testing/vc1-migration";
import { CALL_STATES, type CallSnapshot, type CallState } from "./types";

function sqlTransitions(): Array<[string, string]> {
  const sql = vc1Migration();
  const block = sql.slice(sql.indexOf("-- TRANSITIONS BEGIN"), sql.indexOf("-- TRANSITIONS END"));
  return [...block.matchAll(/\('([A-Z_]+)', '([A-Z_]+)'\)/g)].map((m) => [m[1]!, m[2]!]);
}

const BASE: CallSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "VIDEO",
  purpose: "CONVERSATION",
  state: "RINGING",
  version: 1,
  conversationId: "22222222-2222-4222-8222-222222222222",
  reviewId: null,
  role: "CALLER",
  myState: "ACCEPTED",
  isInitiator: true,
  otherName: "Bayo",
  otherState: "RINGING",
  scheduledFor: null,
  createdAt: "2026-10-08T10:00:00.000Z",
  ringingAt: "2026-10-08T10:00:00.000Z",
  ringExpiresAt: "2026-10-08T10:00:45.000Z",
  acceptedAt: null,
  connectedAt: null,
  interruptedAt: null,
  endedAt: null,
  endReason: null,
  durationSeconds: null,
  serverNow: "2026-10-08T10:00:01.000Z",
};

describe("the lifecycle table", () => {
  it("is exactly the database's table of legal moves, both ways", () => {
    const fromSql = sqlTransitions().map(([a, b]) => `${a}>${b}`).sort();
    const fromTs = Object.entries(TRANSITIONS)
      .flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`))
      .sort();
    expect(fromSql.length).toBeGreaterThan(20);
    expect(fromTs).toEqual(fromSql);
  });

  it("covers every state, and terminal states lead nowhere", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...CALL_STATES].sort());
    for (const state of TERMINAL_STATES) expect(TRANSITIONS[state]).toEqual([]);
    for (const state of CALL_STATES) {
      if (!TERMINAL_STATES.has(state)) expect(TRANSITIONS[state].length).toBeGreaterThan(0);
    }
  });

  it("agrees with the database on which states are terminal", () => {
    const sql = vc1Migration();
    const m = /call_state_is_terminal\(p_state text\)[\s\S]*?select p_state in \(([^)]*)\)/.exec(sql);
    const terminal = [...(m?.[1] ?? "").matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]).sort();
    expect(terminal).toEqual([...TERMINAL_STATES].sort());
  });

  it("never goes backwards into ringing, never skips from ringing to active, never revives an ended call", () => {
    expect(canTransition("ACTIVE", "RINGING")).toBe(false);
    expect(canTransition("RINGING", "ACTIVE")).toBe(false);
    expect(canTransition("ENDED", "ACTIVE")).toBe(false);
    expect(canTransition("MISSED", "ACCEPTED")).toBe(false);
    expect(canTransition("DECLINED", "RINGING")).toBe(false);
  });

  it("treats a dropped connection as interrupted, not ended, and lets it come back", () => {
    expect(canTransition("ACTIVE", "INTERRUPTED")).toBe(true);
    expect(canTransition("INTERRUPTED", "ACTIVE")).toBe(true);
    expect(canTransition("INTERRUPTED", "ENDED")).toBe(true);
    expect(isTerminal("INTERRUPTED")).toBe(false);
    expect(LIVE_STATES.has("INTERRUPTED")).toBe(true);
  });
});

describe("timeouts", () => {
  it("are the database's numbers", () => {
    const sql = vc1Migration();
    const block = sql.slice(sql.indexOf("-- TIMEOUTS BEGIN"), sql.indexOf("-- TIMEOUTS END"));
    const fromSql = Object.fromEntries([...block.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(fromSql).toEqual(CALL_TIMEOUTS);
    expect(CALL_TIMEOUTS.ring).toBe(45);
  });

  it("a ring runs out at 45 seconds and not a moment before", () => {
    expect(overdueTransition(BASE, new Date("2026-10-08T10:00:44.999Z"))).toBeNull();
    expect(overdueTransition(BASE, new Date("2026-10-08T10:00:45.000Z"))).toEqual({ to: "MISSED", reason: "no_answer" });
  });

  it("an answered call that never connects fails after the connect window", () => {
    const accepted = { ...BASE, state: "ACCEPTED" as CallState, acceptedAt: "2026-10-08T10:00:10.000Z" };
    expect(overdueTransition(accepted, new Date("2026-10-08T10:01:09.000Z"))).toBeNull();
    expect(overdueTransition(accepted, new Date("2026-10-08T10:01:10.000Z"))).toEqual({ to: "FAILED", reason: "connect_timeout" });
  });

  it("a drop ends the call only after the reconnect grace", () => {
    const dropped = { ...BASE, state: "INTERRUPTED" as CallState, interruptedAt: "2026-10-08T10:05:00.000Z" };
    expect(overdueTransition(dropped, new Date("2026-10-08T10:05:29.000Z"))).toBeNull();
    expect(overdueTransition(dropped, new Date("2026-10-08T10:05:30.000Z"))).toEqual({ to: "ENDED", reason: "connection_lost" });
  });

  it("a live call has no deadline the screen enforces", () => {
    expect(overdueTransition({ ...BASE, state: "ACTIVE" }, new Date("2027-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("what the screen does", () => {
  it("the red button cancels for the caller, declines for the callee, ends a live call", () => {
    expect(hangUpIntent("RINGING", "CALLER")).toBe("cancel");
    expect(hangUpIntent("RINGING", "REVIEWER")).toBe("cancel");
    expect(hangUpIntent("RINGING", "CALLEE")).toBe("decline");
    expect(hangUpIntent("RINGING", "SUBJECT")).toBe("decline");
    expect(hangUpIntent("ACTIVE", "CALLEE")).toBe("end");
    expect(hangUpIntent("INTERRUPTED", "CALLER")).toBe("end");
    expect(hangUpIntent("ENDED", "CALLER")).toBe("none");
    expect(hangUpIntent("ACTIVE", null)).toBe("none");
  });

  it("only the caller joins while it rings; the callee joins after answering", () => {
    expect(mayJoin("RINGING", "CALLER", "ACCEPTED")).toBe(true);
    expect(mayJoin("RINGING", "CALLEE", "RINGING")).toBe(false);
    expect(mayJoin("ACCEPTED", "CALLEE", "ACCEPTED")).toBe(true);
    expect(mayJoin("ACTIVE", "CALLEE", "DECLINED")).toBe(false);
    expect(mayJoin("ENDED", "CALLER", "LEFT")).toBe(false);
    expect(mayJoin("ACTIVE", null, null)).toBe(false);
  });

  it("maps every state to one phase", () => {
    expect(callPhase("RINGING", "CALLEE")).toBe("incoming");
    expect(callPhase("RINGING", "CALLER")).toBe("outgoing");
    expect(callPhase("ACCEPTED", "CALLER")).toBe("connecting");
    expect(callPhase("CONNECTING", "CALLEE")).toBe("connecting");
    expect(callPhase("ACTIVE", "CALLEE")).toBe("in_call");
    expect(callPhase("INTERRUPTED", "CALLEE")).toBe("reconnecting");
    for (const state of TERMINAL_STATES) expect(callPhase(state, "CALLER")).toBe("ended");
  });

  it("words every ending from each side, with no em dash", () => {
    for (const state of TERMINAL_STATES) {
      for (const isInitiator of [true, false]) {
        const words = endReasonWords({ state, endReason: null, isInitiator, kind: "AUDIO" });
        expect(words.length).toBeGreaterThan(0);
        expect(words).not.toContain("\u2014");
      }
    }
    expect(endReasonWords({ state: "MISSED", endReason: "no_answer", isInitiator: false, kind: "VIDEO" })).toBe("Missed video call");
    expect(endReasonWords({ state: "ENDED", endReason: "connection_lost", isInitiator: true, kind: "VIDEO" })).toBe("The connection was lost");
  });

  it("states a duration the way the conversation marker does", () => {
    expect(durationWords(252)).toBe("4 min 12 s");
    expect(durationWords(45)).toBe("45 s");
    expect(durationWords(null)).toBe("");
    expect(durationWords(-3)).toBe("");
  });
});

describe("reading the database's snapshot", () => {
  const row = {
    id: BASE.id,
    kind: "VIDEO",
    purpose: "CONVERSATION",
    state: "RINGING",
    version: 2,
    conversation_id: BASE.conversationId,
    review_id: null,
    role: "CALLEE",
    my_state: "RINGING",
    is_initiator: false,
    other_name: "Ada",
    other_state: "ACCEPTED",
    created_at: BASE.createdAt,
    ring_expires_at: BASE.ringExpiresAt,
    server_now: BASE.serverNow,
    glare: true,
  };

  it("maps every field and keeps the flags", () => {
    const s = snapshotFromRow(row)!;
    expect(s.role).toBe("CALLEE");
    expect(s.myState).toBe("RINGING");
    expect(s.otherName).toBe("Ada");
    expect(s.version).toBe(2);
    expect(s.glare).toBe(true);
    expect(s.replayed).toBeUndefined();
  });

  it("carries the other person's photo and whether their ring is on screen", () => {
    const plain = snapshotFromRow(row)!;
    expect(plain.otherAvatarUrl).toBeUndefined();
    expect(plain.otherRinging).toBeUndefined();
    const s = snapshotFromRow({ ...row, other_avatar_url: "https://img.example/a.jpg", other_ringing: true })!;
    expect(s.otherAvatarUrl).toBe("https://img.example/a.jpg");
    expect(s.otherRinging).toBe(true);
    expect(snapshotFromRow({ ...row, other_avatar_url: "" })!.otherAvatarUrl).toBeUndefined();
  });

  it("refuses anything that is not a call, and unknown words become null", () => {
    expect(snapshotFromRow(null)).toBeNull();
    expect(snapshotFromRow({ ...row, state: "PARTY" })).toBeNull();
    expect(snapshotFromRow({ ...row, kind: "HOLOGRAM" })).toBeNull();
    expect(snapshotFromRow({ ...row, role: "ADMIN" })!.role).toBeNull();
  });

  it("keeps the newer view, and never revives a finished call", () => {
    const older = { ...BASE, version: 3, state: "ACTIVE" as CallState };
    const newer = { ...BASE, version: 4, state: "INTERRUPTED" as CallState };
    expect(newerSnapshot(older, newer)).toBe(newer);
    expect(newerSnapshot(newer, older)).toBe(newer);
    const ended = { ...BASE, version: 5, state: "ENDED" as CallState };
    const lateActive = { ...BASE, version: 9, state: "ACTIVE" as CallState };
    expect(newerSnapshot(ended, lateActive)).toBe(ended);
    expect(newerSnapshot(null, older)).toBe(older);
  });
});
