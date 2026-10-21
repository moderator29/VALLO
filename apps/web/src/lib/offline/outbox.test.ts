import { describe, expect, it } from "vitest";
import { asEntry, backoff, due, entryKey, hasAuthCookie, makeEntry, OUTBOX_KINDS } from "./outbox";
import { INFLIGHT_MAX_AGE_MS, readInflight } from "./inflight";

const ID = "3653d202-e498-4db0-ab71-882649f7f446";

describe("the outbox (V-40)", () => {
  it("never carries money", () => {
    expect(OUTBOX_KINDS).toEqual(["save_listing", "save_place", "send_message", "request_inspection", "submit_review", "drop_post"]);
    for (const kind of OUTBOX_KINDS) expect(kind).not.toMatch(/pay|money|withdraw|transfer|fund|card|wallet/);
    expect(makeEntry("withdraw", ID, true, 0)).toBeNull();
    expect(makeEntry("send_money", ID, true, 0)).toBeNull();
  });
  it("keys an intent by what it is about, so a second tap replaces the first", () => {
    const first = makeEntry("save_listing", ID, true, 1)!;
    const second = makeEntry("save_listing", ID, false, 2)!;
    expect(first.key).toBe(second.key);
    expect(second.want).toBe(false);
    expect(entryKey("save_place", `accommodation:${ID}`)).toBe(`save_place:accommodation:${ID}`);
    expect(makeEntry("save_place", "hotel:x", true, 0)).toBeNull();
  });
  it("replays oldest first, only what is due, and backs off", () => {
    const a = { ...makeEntry("save_listing", "a", true, 10)!, nextAt: 10 };
    const b = { ...makeEntry("save_listing", "b", true, 5)!, nextAt: 5 };
    const later = { ...makeEntry("save_listing", "c", true, 1)!, nextAt: 1_000 };
    expect(due([a, b, later], 100).map((e) => e.target)).toEqual(["b", "a"]);
    expect([0, 1, 2, 3, 9].map(backoff)).toEqual([5_000, 15_000, 45_000, 120_000, 120_000]);
  });
  it("checks what it reads back", () => {
    expect(asEntry({ kind: "save_listing", target: ID, want: true, createdAt: 3 })).toMatchObject({ target: ID, createdAt: 3 });
    expect(asEntry({ kind: "save_listing", target: ID, want: "yes" })).toBeNull();
  });
});

describe("in-flight payment notes (V-40)", () => {
  it("keeps valid references for two days and drops anything else", () => {
    const now = 1_000_000_000_000;
    const raw = JSON.stringify([
      { reference: "rm-book-abc123", amountMinor: 500_000, at: now - 1000 },
      { reference: "rm-book-old", amountMinor: 1, at: now - INFLIGHT_MAX_AGE_MS - 1 },
      { reference: "<script>", at: now },
      "junk",
    ]);
    expect(readInflight(raw, now)).toEqual([{ reference: "rm-book-abc123", amountMinor: 500_000, at: now - 1000 }]);
    expect(readInflight("{", now)).toEqual([]);
    expect(readInflight(null, now)).toEqual([]);
  });
});

describe("creates in the outbox (V-40)", () => {
  const ID = "3f1c2a4e-9b7d-4c1e-8a2b-6d5e4f3a2b1c";

  it("keeps a message, a request, a review and a post under the tap's own UUID", async () => {
    const { makeCreateEntry, asEntry } = await import("./outbox");
    const made = [
      makeCreateEntry("send_message", ID, { conversationId: "c", body: "hello" }, 1),
      makeCreateEntry("request_inspection", ID, { listingId: "l", when: "2026-10-01T10:00:00Z" }, 1),
      makeCreateEntry("submit_review", ID, { bookingId: "b", rating: "5" }, 1),
      makeCreateEntry("drop_post", ID, { kind: "GIST", body: "hi" }, 1),
    ];
    for (const entry of made) {
      expect(entry?.key).toBe(`${entry?.kind}:${ID}`);
      expect(asEntry(JSON.parse(JSON.stringify(entry)))).toEqual({ ...entry, userId: null });
      expect(asEntry({ ...entry, userId: "u-1" })?.userId).toBe("u-1");
    }
  });

  it("keeps a reply with the message it answers", async () => {
    const { makeCreateEntry } = await import("./outbox");
    const entry = makeCreateEntry("send_message", ID, { conversationId: "c", body: "yes", replyToId: "q" }, 1);
    expect(entry?.payload).toEqual({ conversationId: "c", body: "yes", replyToId: "q" });
  });

  it("refuses money, unknown fields, missing fields and a key that is not a UUID", async () => {
    const { makeCreateEntry, asEntry } = await import("./outbox");
    expect(makeCreateEntry("withdraw", ID, { amount: "5000" }, 1)).toBeNull();
    expect(makeCreateEntry("send_money", ID, { amount: "5000" }, 1)).toBeNull();
    expect(makeCreateEntry("send_message", ID, { conversationId: "c", body: "x", amount: "5000" }, 1)).toBeNull();
    expect(makeCreateEntry("send_message", ID, { conversationId: "c", body: "   " }, 1)).toBeNull();
    expect(makeCreateEntry("send_message", "not-a-uuid", { conversationId: "c", body: "x" }, 1)).toBeNull();
    expect(asEntry({ kind: "drop_post", target: ID, want: true, payload: { kind: "GIST", body: 5 } })).toBeNull();
  });
});

/* R3-18: a page with no auth cookie answers "nobody" without fetching
   supabase-js, so the cookie test must find the cookie in every shape the
   SSR client writes it, and nothing else. */
describe("the auth cookie, read without the client", () => {
  it("finds the session cookie whole or chunked, anywhere in the header", () => {
    expect(hasAuthCookie("sb-abcd-auth-token=base64-xyz")).toBe(true);
    expect(hasAuthCookie("vallo_first_run=seen; sb-abcd-auth-token.0=base64-a; sb-abcd-auth-token.1=b")).toBe(true);
    expect(hasAuthCookie("nf_theme=dark;sb-proj-ref-auth-token=x")).toBe(true);
  });

  it("is not fooled by anything else", () => {
    expect(hasAuthCookie("")).toBe(false);
    expect(hasAuthCookie("vallo_first_run=seen; nf_theme=dark")).toBe(false);
    expect(hasAuthCookie("sb-abcd-auth-token-code-verifier=x")).toBe(false);
    expect(hasAuthCookie("not-sb-abcd-auth-token=x")).toBe(false);
  });
});
