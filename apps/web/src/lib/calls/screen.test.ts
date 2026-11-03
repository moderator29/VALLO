import { describe, expect, it } from "vitest";
import { wordsForToken } from "./errors";
import {
  callIdFromParam,
  callMarkerView,
  clockOffsetMs,
  clockWords,
  endNeedsConfirm,
  fill,
  inboxMissedCall,
  isoToLagosInput,
  lagosInputToIso,
  lagosWords,
  mediaErrorKind,
  mediaPlatform,
  outcomeFormErrors,
  parseCallMarker,
  requestFormErrors,
  returnHref,
  ringSecondsLeft,
  startOutcome,
  startRefusal,
  talkSeconds,
} from "./screen";
import type { CallSnapshot } from "./types";

const snap = (over: Partial<CallSnapshot> = {}): CallSnapshot => ({
  id: "c1",
  kind: "VIDEO",
  purpose: "CONVERSATION",
  state: "RINGING",
  version: 1,
  conversationId: "conv-1",
  reviewId: null,
  role: "CALLER",
  myState: "JOINED",
  isInitiator: true,
  otherName: "Ada",
  otherState: "RINGING",
  scheduledFor: null,
  createdAt: "2026-10-08T12:00:00.000Z",
  ringingAt: "2026-10-08T12:00:01.000Z",
  ringExpiresAt: "2026-10-08T12:00:46.000Z",
  acceptedAt: null,
  connectedAt: null,
  interruptedAt: null,
  endedAt: null,
  endReason: null,
  durationSeconds: null,
  serverNow: "2026-10-08T12:00:10.000Z",
  ...over,
});

describe("the server clock", () => {
  it("measures how far the server is ahead of the device", () => {
    const device = Date.parse("2026-10-08T12:05:10.000Z");
    expect(clockOffsetMs("2026-10-08T12:00:10.000Z", device)).toBe(-300_000);
    expect(clockOffsetMs("not a time", device)).toBe(0);
  });

  it("counts talk time from connectedAt on the server's clock, and freezes it once ended", () => {
    const now = Date.parse("2026-10-08T12:04:22.500Z");
    expect(talkSeconds(snap({ connectedAt: "2026-10-08T12:00:10.000Z" }), now)).toBe(252);
    expect(talkSeconds(snap(), now)).toBeNull();
    expect(talkSeconds(snap({ connectedAt: "2026-10-08T12:00:10.000Z", endedAt: "x", durationSeconds: 61 }), now)).toBe(61);
    /* A device clock behind the server never shows a negative clock. */
    expect(talkSeconds(snap({ connectedAt: "2026-10-08T12:10:00.000Z" }), now)).toBe(0);
  });

  it("words the running clock", () => {
    expect(clockWords(0)).toBe("0:00");
    expect(clockWords(42)).toBe("0:42");
    expect(clockWords(252)).toBe("4:12");
    expect(clockWords(3723)).toBe("1:02:03");
    expect(clockWords(null)).toBe("0:00");
  });

  it("counts a ring down, and only while ringing", () => {
    const now = Date.parse("2026-10-08T12:00:10.000Z");
    expect(ringSecondsLeft(snap(), now)).toBe(36);
    expect(ringSecondsLeft(snap(), Date.parse("2026-10-08T12:01:00.000Z"))).toBe(0);
    expect(ringSecondsLeft(snap({ state: "ACTIVE" }), now)).toBeNull();
  });
});

describe("a start tap's answer", () => {
  it("recovers the refusal kind from the action's sentence", () => {
    expect(startRefusal(wordsForToken("call:not_engaged"))).toBe("not_engaged");
    expect(startRefusal(wordsForToken("call:blocked"))).toBe("blocked");
    expect(startRefusal(wordsForToken("call:caller_busy"))).toBe("caller_busy");
    expect(startRefusal(wordsForToken("call:rate_limited"))).toBe("rate_limited");
    expect(startRefusal(wordsForToken("call:disabled"))).toBe("disabled");
    expect(startRefusal(wordsForToken("call:provider_unavailable"))).toBe("disabled");
    expect(startRefusal("Something else entirely.")).toBe("other");
  });

  it("opens the right screen: glare shows THEIR call, busy shows a note", () => {
    expect(startOutcome(snap())).toBe("outgoing");
    expect(startOutcome(snap({ glare: true, role: "CALLEE" }))).toBe("incoming");
    expect(startOutcome(snap({ state: "BUSY" }))).toBe("busy");
    expect(startOutcome(snap({ state: "ENDED", replayed: true }))).toBe("ended");
    expect(startOutcome(snap({ replayed: true, state: "ACTIVE" }))).toBe("outgoing");
  });
});

describe("call markers in a thread", () => {
  it("reads every body the database writes", () => {
    expect(parseCallMarker("Video call, 4 min 12 s")).toEqual({ kind: "VIDEO", outcome: "talked", seconds: 252 });
    expect(parseCallMarker("Voice call, 45 s")).toEqual({ kind: "AUDIO", outcome: "talked", seconds: 45 });
    expect(parseCallMarker("Voice call, missed")?.outcome).toBe("missed");
    expect(parseCallMarker("Video call, missed (busy)")?.outcome).toBe("busy");
    expect(parseCallMarker("Video call, declined")?.outcome).toBe("declined");
    expect(parseCallMarker("Video call, could not connect")?.outcome).toBe("failed");
    expect(parseCallMarker("Video call, see you soon")).toBeNull();
    expect(parseCallMarker("Hello")).toBeNull();
  });

  it("is a missed call only for the person who was called", () => {
    const callee = callMarkerView({ body: "Video call, missed", mine: false });
    const caller = callMarkerView({ body: "Video call, missed", mine: true });
    expect(callee).toMatchObject({ missed: true, outgoing: false, kind: "VIDEO" });
    expect(caller).toMatchObject({ missed: false, outgoing: true, outcome: "missed" });
    expect(callMarkerView({ body: "Voice call, cancelled", mine: false })?.missed).toBe(true);
    expect(callMarkerView({ body: "Voice call, missed (busy)", mine: false })?.missed).toBe(true);
    expect(callMarkerView({ body: "Voice call, declined", mine: false })?.missed).toBe(false);
  });

  it("prefers the snapshot (per viewer) over the words", () => {
    const view = callMarkerView({
      body: "Video call, ended",
      mine: false,
      snapshot: { kind: "AUDIO", state: "ENDED", durationSeconds: 61, isInitiator: true, connectedAt: "x" },
    });
    expect(view).toEqual({ kind: "AUDIO", outcome: "talked", seconds: 61, missed: false, outgoing: true });
    expect(
      callMarkerView({ body: "x", mine: true, snapshot: { kind: "VIDEO", state: "MISSED", durationSeconds: null, isInitiator: false, connectedAt: null } })?.missed,
    ).toBe(true);
  });

  it("draws the inbox's missed line only for a real marker from the other side", () => {
    expect(inboxMissedCall("Video call, missed", false, true)).toBe("VIDEO");
    expect(inboxMissedCall("Video call, missed", false, false)).toBeNull();
    expect(inboxMissedCall("Video call, missed", true, true)).toBeNull();
    expect(inboxMissedCall("Video call, 4 min 12 s", false, true)).toBeNull();
  });
});

describe("permission recovery", () => {
  it("names the platform whose steps to show", () => {
    expect(mediaPlatform("anything", "ios")).toBe("iosApp");
    expect(mediaPlatform("anything", "android")).toBe("androidApp");
    expect(mediaPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", null)).toBe("iosWeb");
    expect(mediaPlatform("Mozilla/5.0 (Linux; Android 14)", "unknown")).toBe("androidWeb");
    expect(mediaPlatform("Mozilla/5.0 (X11; Linux x86_64)", null)).toBe("desktop");
  });

  it("classifies the browser's own errors", () => {
    expect(mediaErrorKind({ name: "NotAllowedError" })).toBe("denied");
    expect(mediaErrorKind(new Error("Permission denied"))).toBe("denied");
    expect(mediaErrorKind({ name: "NotFoundError" })).toBe("not_found");
    expect(mediaErrorKind({ name: "NotReadableError" })).toBe("in_use");
    expect(mediaErrorKind({ name: "SecurityError" })).toBe("insecure");
    expect(mediaErrorKind(new Error("boom"))).toBe("other");
  });
});

describe("ending and returning", () => {
  it("asks before ending only a live review call, from the reviewer", () => {
    expect(endNeedsConfirm(snap({ state: "ACTIVE" }))).toBe(false);
    expect(endNeedsConfirm(snap({ purpose: "ADMIN_REVIEW", role: "REVIEWER", state: "ACTIVE" }))).toBe(true);
    expect(endNeedsConfirm(snap({ purpose: "ADMIN_REVIEW", role: "REVIEWER", state: "RINGING" }))).toBe(false);
    expect(endNeedsConfirm(snap({ purpose: "ADMIN_REVIEW", role: "SUBJECT", state: "ACTIVE" }))).toBe(false);
  });

  it("goes back to the exact thread, on the side the call was taken", () => {
    expect(returnHref(snap(), "/home")).toBe("/messages/conv-1");
    expect(returnHref(snap(), "/agent/dashboard")).toBe("/agent/messages/conv-1");
    expect(returnHref(snap({ conversationId: null, reviewId: "r1", role: "REVIEWER" }), "/admin")).toBe("/admin/review-calls/r1");
    expect(returnHref(snap({ conversationId: null, reviewId: "r1", role: "SUBJECT" }), "/home")).toBe("/calls/reviews/r1");
  });

  it("takes only a call id from a deep link", () => {
    expect(callIdFromParam("8F0C3C4E-1D1B-4C5E-9A62-3E1F0B7A9C11")).toBe("8f0c3c4e-1d1b-4c5e-9a62-3e1f0b7a9c11");
    expect(callIdFromParam(["8f0c3c4e-1d1b-4c5e-9a62-3e1f0b7a9c11", "x"])).toBe("8f0c3c4e-1d1b-4c5e-9a62-3e1f0b7a9c11");
    expect(callIdFromParam("'; drop table")).toBeNull();
    expect(callIdFromParam(undefined)).toBeNull();
  });
});

describe("Lagos time", () => {
  it("shows an instant as Lagos reads it, whatever the device zone", () => {
    expect(lagosWords("2026-10-09T09:30:00.000Z")).toMatch(/^Fri,? 9 Oct,? 10:30$/);
    expect(lagosWords(null)).toBe("");
  });

  it("round-trips a typed Lagos time", () => {
    expect(lagosInputToIso("2026-10-09T10:30")).toBe("2026-10-09T09:30:00.000Z");
    expect(isoToLagosInput("2026-10-09T09:30:00.000Z")).toBe("2026-10-09T10:30");
    expect(lagosInputToIso("2026-02-30T10:00")).toBeNull();
    expect(lagosInputToIso("tomorrow")).toBeNull();
  });
});

describe("the staff forms", () => {
  const words = { outcome: "o", summary: "s", followUp: "f", purpose: "p", time: "t" };
  const now = Date.parse("2026-10-08T12:00:00.000Z");

  it("needs an outcome and a summary", () => {
    expect(outcomeFormErrors({ outcome: "", summary: "", followUpDue: "" }, now, words)).toEqual({ outcome: "o", summary: "s" });
    expect(outcomeFormErrors({ outcome: "ESCALATED", summary: "Sent to compliance", followUpDue: "" }, now, words)).toEqual({});
  });

  it("needs a future due date for a follow-up", () => {
    expect(outcomeFormErrors({ outcome: "FOLLOW_UP_REQUIRED", summary: "Call again", followUpDue: "" }, now, words)).toEqual({ followUpDue: "f" });
    expect(outcomeFormErrors({ outcome: "FOLLOW_UP_REQUIRED", summary: "Call again", followUpDue: "2026-10-08T10:00" }, now, words)).toEqual({ followUpDue: "f" });
    expect(outcomeFormErrors({ outcome: "FOLLOW_UP_REQUIRED", summary: "Call again", followUpDue: "2026-10-15T10:00" }, now, words)).toEqual({});
  });

  it("needs a purpose of 10 to 500 characters and a time when scheduling", () => {
    expect(requestFormErrors({ purpose: "short", when: "now", at: "" }, words)).toEqual({ purpose: "p" });
    expect(requestFormErrors({ purpose: "x".repeat(501), when: "now", at: "" }, words)).toEqual({ purpose: "p" });
    expect(requestFormErrors({ purpose: "A good reason to talk", when: "schedule", at: "" }, words)).toEqual({ at: "t" });
    expect(requestFormErrors({ purpose: "A good reason to talk", when: "schedule", at: "2026-10-09T10:30" }, words)).toEqual({});
  });

  it("fills copy templates", () => {
    expect(fill("{name} is on another call", { name: "Ada" })).toBe("Ada is on another call");
    expect(fill("{missing} stays", {})).toBe("{missing} stays");
  });
});

describe("mediaErrorKind on a phone's own wording (29 October 2026)", () => {
  it("reads Safari's missing media devices as unsupported, not as an unnamed failure", () => {
    expect(mediaErrorKind(new TypeError("undefined is not an object (evaluating 'navigator.mediaDevices.getUserMedia')"))).toBe("insecure");
    const unsupported = new Error("device is unsupported");
    unsupported.name = "DeviceUnsupportedError";
    expect(mediaErrorKind(unsupported)).toBe("insecure");
  });
  it("still calls a refusal a refusal", () => {
    expect(mediaErrorKind(new DOMException("denied", "NotAllowedError"))).toBe("denied");
    expect(mediaErrorKind(new Error("something else entirely"))).toBe("other");
  });
});
