/**
 * THE ESCALATION WRITES (lib/admin/escalations/actions.ts). Pinned: the door
 * is the console's and the handbook; the text rule refuses an ID, bank or
 * card number before anything is sent; the attached record must be a page
 * inside the console; the database's answer decides where it landed; an
 * urgent one records a critical alert with the reference and no text; every
 * refusal is a sentence; and a missing function says "not set up".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = "11111111-1111-4111-8111-111111111111";
const ID = "7e7e7e7e-7e7e-4e7e-8e7e-7e7e7e7e7e7e";

const state = vi.hoisted(() => ({
  door: null as unknown,
  allowed: true,
  answer: { data: null as unknown, error: null as unknown },
  throws: false,
  calls: [] as { fn: string; args: Record<string, unknown> }[],
  alerts: [] as { kind: string; severity: string; detail: Record<string, unknown>; subjectId?: string }[],
  revalidated: [] as string[],
  buckets: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: (path: string) => void state.revalidated.push(path) }));
vi.mock("@/lib/admin/guard", () => ({
  requireConsole: async () => state.door,
  ADMIN_FORBIDDEN_MESSAGE: "not staff",
  ADMIN_SIGNED_OUT_MESSAGE: "sign in",
  ADMIN_STEP_UP_MESSAGE: "confirm it is you",
  ADMIN_UNCONFIGURED_MESSAGE: "cannot reach the console",
}));
vi.mock("@/lib/security/rate-limit", () => ({
  consume: async (request: { bucket: string }) => {
    state.buckets.push(request.bucket);
    return { allowed: state.allowed };
  },
  subjectForUser: (id: string) => `user:${id}`,
}));
vi.mock("@/lib/alerts", () => ({
  recordAlert: async (input: { kind: string; severity: string; detail: Record<string, unknown>; subjectId?: string }) => {
    state.alerts.push(input);
    return { ok: true, id: null, deduplicated: false };
  },
}));

const { actOnEscalation, raiseEscalation } = await import("./actions");
const { PERSONAL_NUMBER_REFUSAL } = await import("./types");

const client = {
  rpc: async (fn: string, args: Record<string, unknown>) => {
    state.calls.push({ fn, args });
    if (state.throws) throw new Error("network down");
    return state.answer;
  },
};

const staff = (over: Record<string, unknown> = {}) => ({
  state: "console",
  user: { id: ME },
  supabase: client,
  staff: { isAdmin: false, isSuperAdmin: false, scopes: ["kyc_review"], handbookAcknowledged: true, ...over },
});

const raise = {
  category: "money" as const,
  severity: "high" as const,
  title: "A payment is stuck",
  whatHappened: "The payer says the money left their bank and nothing shows.",
  whatIsNeeded: "Check the transfer with the partner.",
  sourcePath: "/admin/kyc?person=abc",
  recordUrl: "/admin/kyc?person=abc",
  recordLabel: "This page",
};

beforeEach(() => {
  state.door = staff();
  state.allowed = true;
  state.throws = false;
  state.answer = {
    data: { status: "ok", id: ID, reference: "ESC-000123", routed_to: "finance", intended: "finance", level: 0, due_at: "2026-11-15T14:00:00Z" },
    error: null,
  };
  state.calls = [];
  state.alerts = [];
  state.revalidated = [];
  state.buckets = [];
});

describe("the door", () => {
  it.each([
    [{ state: "signed-out" }, "sign in"],
    [{ state: "not-admin" }, "not staff"],
    [{ state: "step-up" }, "confirm it is you"],
    [{ state: "unconfigured" }, "cannot reach the console"],
  ])("refuses %o in words and sends nothing", async (door, words) => {
    state.door = door;
    expect(await raiseEscalation(raise)).toEqual({ ok: false, error: words });
    expect(await actOnEscalation({ id: ID, action: "acknowledge" })).toEqual({ ok: false, error: words });
    expect(state.calls).toEqual([]);
  });

  it("asks staff who have not acknowledged the handbook to read it first", async () => {
    state.door = staff({ handbookAcknowledged: false });
    const result = await raiseEscalation(raise);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("handbook");
    expect(state.calls).toEqual([]);
  });

  it("lets an admin through without a handbook line of their own", async () => {
    state.door = staff({ isAdmin: true, scopes: [], handbookAcknowledged: false });
    expect((await raiseEscalation(raise)).ok).toBe(true);
  });

  it("slows a run of them, and sends nothing while slowed", async () => {
    state.allowed = false;
    expect((await raiseEscalation(raise)).ok).toBe(false);
    expect((await actOnEscalation({ id: ID, action: "acknowledge" })).ok).toBe(false);
    expect(state.calls).toEqual([]);
    expect(state.buckets).toEqual(["admin_escalation_raise", "admin_escalation_act"]);
  });
});

describe("raising one", () => {
  it("sends the fields, the desk it came from and the record, on the caller's own session", async () => {
    const result = await raiseEscalation(raise);
    expect(result).toEqual({
      ok: true,
      data: { id: ID, reference: "ESC-000123", routedTo: "finance", intended: "finance", dueAt: "2026-11-15T14:00:00Z" },
    });
    expect(state.calls).toEqual([
      {
        fn: "staff_escalation_raise",
        args: {
          p_category: "money",
          p_severity: "high",
          p_title: "A payment is stuck",
          p_what_happened: "The payer says the money left their bank and nothing shows.",
          p_what_is_needed: "Check the transfer with the partner.",
          p_source_desk: "/admin/kyc",
          p_record_url: "/admin/kyc?person=abc",
          p_record_label: "This page",
          p_routed_to: null,
        },
      },
    ]);
    expect(state.revalidated).toEqual(["/admin"]);
  });

  it("lets the database choose the route unless the person chose another", async () => {
    await raiseEscalation({ ...raise, routedTo: "compliance" });
    expect(state.calls[0]?.args.p_routed_to).toBe("compliance");
    const bad = await raiseEscalation({ ...raise, routedTo: "the_moon" });
    expect(bad.ok).toBe(false);
    expect(state.calls).toHaveLength(1);
  });

  it("checks the fields before anything is sent", async () => {
    const result = await raiseEscalation({ ...raise, title: "ab", whatHappened: "short", whatIsNeeded: "no" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["title", "whatHappened", "whatIsNeeded"]);
    expect((await raiseEscalation({ ...raise, category: "weather" as never })).ok).toBe(false);
    expect((await raiseEscalation({ ...raise, severity: "soon" as never })).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });

  it.each([
    ["title", { title: "NIN 12345678901 failed" }],
    ["whatHappened", { whatHappened: "Their BVN is 22212345678 and the check failed twice." }],
    ["whatIsNeeded", { whatIsNeeded: "Refund to account 0123456789 today." }],
    ["whatHappened", { whatHappened: "The card 4084 0840 8408 4081 was charged twice." }],
  ])("refuses an ID, bank or card number in %s, and says to link the record", async (field, over) => {
    const result = await raiseEscalation({ ...raise, ...over });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Link the record instead of pasting an ID or account number.");
      expect(result.fieldErrors?.[field]).toBe(PERSONAL_NUMBER_REFUSAL);
    }
    expect(state.calls).toEqual([]);
  });

  it.each(["https://example.com/admin/kyc", "/settings/phone", "/admin/../settings", "//example.com/admin/x"])(
    "refuses a record that is not a page inside the console: %s",
    async (recordUrl) => {
      const result = await raiseEscalation({ ...raise, recordUrl });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors?.recordUrl).toContain("inside the console");
      expect(state.calls).toEqual([]);
    },
  );

  it("raises with no record when the page is the overview, and drops a label with nothing to label", async () => {
    await raiseEscalation({ ...raise, sourcePath: "/admin", recordUrl: null });
    expect(state.calls[0]?.args).toMatchObject({ p_source_desk: "/admin", p_record_url: null, p_record_label: null });
  });

  it("reads a desk it does not recognise as the console itself", async () => {
    await raiseEscalation({ ...raise, sourcePath: "https://example.com/x", recordUrl: null });
    expect(state.calls[0]?.args.p_source_desk).toBe("/admin");
  });

  it("reports where it really landed when the team was empty", async () => {
    state.answer = { data: { status: "ok", id: ID, reference: "ESC-000124", routed_to: "coo", intended: "trust_safety", level: 1 }, error: null };
    const result = await raiseEscalation({ ...raise, category: "identity_fraud" });
    expect(result).toMatchObject({ ok: true, data: { routedTo: "coo", intended: "trust_safety" } });
  });

  it("pages a human for an urgent one, with the reference and the route and none of the text", async () => {
    await raiseEscalation({ ...raise, severity: "urgent" });
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]).toMatchObject({ kind: "escalation.urgent", severity: "critical", subjectId: "ESC-000123" });
    const written = JSON.stringify(state.alerts[0]);
    expect(written).not.toContain("payer");
    expect(written).not.toContain("stuck");
  });

  it("pages nobody for anything less than urgent, or for one that was refused", async () => {
    await raiseEscalation(raise);
    state.answer = { data: { status: "forbidden" }, error: null };
    await raiseEscalation({ ...raise, severity: "urgent" });
    expect(state.alerts).toEqual([]);
  });

  it.each([
    ["personal_data", "Link the record instead of pasting an ID or account number."],
    ["invalid_record", "The attached link must be a page inside the console."],
    ["forbidden", "Read and acknowledge the staff handbook first. Escalations open once you have."],
  ])("turns the database's refusal %s into a sentence", async (status, words) => {
    state.answer = { data: { status }, error: null };
    const result = await raiseEscalation(raise);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(words);
    expect(state.revalidated).toEqual([]);
  });

  it("says not set up when the SQL has not run, and never pretends it was sent", async () => {
    state.answer = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    const result = await raiseEscalation({ ...raise, severity: "urgent" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not set up");
    expect(state.alerts).toEqual([]);
  });

  it("never reports success on an answer it cannot read, an error or a thrown call", async () => {
    state.answer = { data: { status: "ok" }, error: null };
    expect((await raiseEscalation(raise)).ok).toBe(false);
    state.answer = { data: null, error: { code: "42501", message: "denied" } };
    expect((await raiseEscalation(raise)).ok).toBe(false);
    state.throws = true;
    expect((await raiseEscalation(raise)).ok).toBe(false);
  });
});

describe("acting on one", () => {
  beforeEach(() => {
    state.answer = { data: { status: "ok", id: ID, escalation_status: "acknowledged", routed_to: "finance" }, error: null };
  });

  it("sends the action on the caller's own session and says how it stands", async () => {
    expect(await actOnEscalation({ id: ID, action: "acknowledge" })).toEqual({ ok: true, data: { status: "acknowledged", routedTo: "finance" } });
    expect(state.calls).toEqual([{ fn: "staff_escalation_act", args: { p_id: ID, p_action: "acknowledge", p_body: null, p_target: null } }]);
    expect(state.revalidated).toEqual(["/admin"]);
  });

  it("needs a real id and a known action", async () => {
    expect((await actOnEscalation({ id: "x", action: "acknowledge" })).ok).toBe(false);
    expect((await actOnEscalation({ id: ID, action: "erase" as never })).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });

  it.each([
    ["resolve", "done"],
    ["decline", "no"],
    ["reroute", "short"],
    ["comment", ""],
    ["ask_raiser", "why"],
    ["raiser_reply", ""],
    ["reopen", "no"],
  ] as const)("asks for the words %s needs before anything is sent", async (action, body) => {
    const result = await actOnEscalation({ id: ID, action, body, target: "compliance" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.body).toBeTruthy();
    expect(state.calls).toEqual([]);
  });

  it("resolves with a closing note of ten characters or more", async () => {
    state.answer = { data: { status: "ok", escalation_status: "resolved", routed_to: "finance" }, error: null };
    const result = await actOnEscalation({ id: ID, action: "resolve", body: "The transfer arrived an hour later." });
    expect(result).toEqual({ ok: true, data: { status: "resolved", routedTo: "finance" } });
    expect(state.calls[0]?.args).toMatchObject({ p_action: "resolve", p_body: "The transfer arrived an hour later." });
  });

  it("refuses a number in a note, a question, a reason or a closing note", async () => {
    for (const action of ["comment", "ask_raiser", "resolve", "decline"] as const) {
      const result = await actOnEscalation({ id: ID, action, body: "Their number is 08031234567, call them today." });
      expect(result.ok, action).toBe(false);
      if (!result.ok) expect(result.error, action).toBe(PERSONAL_NUMBER_REFUSAL);
    }
    expect(state.calls).toEqual([]);
  });

  it("sends to another team only with a reason and a real team", async () => {
    expect((await actOnEscalation({ id: ID, action: "reroute", body: "This is a compliance question.", target: "the_moon" })).ok).toBe(false);
    expect(state.calls).toEqual([]);
    await actOnEscalation({ id: ID, action: "reroute", body: "This is a compliance question.", target: "compliance" });
    expect(state.calls[0]?.args).toMatchObject({ p_action: "reroute", p_target: "compliance" });
  });

  it("passes a person to give it to", async () => {
    await actOnEscalation({ id: ID, action: "assign", target: ME });
    expect(state.calls[0]?.args).toMatchObject({ p_action: "assign", p_target: ME, p_body: null });
  });

  it.each([
    ["forbidden", "not yours"],
    ["not_found", "could not be found"],
    ["closed", "closed"],
    ["too_late", "14 days"],
    ["no_raiser", "has left"],
    ["personal_data", "Link the record"],
    ["something_new", "did not go through"],
  ])("turns the database's refusal %s into a sentence", async (status, words) => {
    state.answer = { data: { status }, error: null };
    const result = await actOnEscalation({ id: ID, action: "acknowledge" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(words);
    expect(state.revalidated).toEqual([]);
  });

  it("says not set up when the SQL has not run", async () => {
    state.answer = { data: null, error: { code: "42883", message: "function does not exist" } };
    const result = await actOnEscalation({ id: ID, action: "acknowledge" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not set up");
  });
});
