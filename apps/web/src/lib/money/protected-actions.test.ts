/**
 * THE PROTECTED PAYMENT ACTIONS REFUSE WHILE THE RAIL IS OFF (lib/money/protected-actions.ts).
 *
 * Pinned: with the switch off, or with the provider undocumented, every one
 * of the five refuses in an ActionResult before reading a session or calling
 * the rail; the rate limit refuses; a malformed request refuses; the actor
 * passed to the rail is always the signed-in member; refresh and "I've made
 * the transfer" only ever reach the read-back steps and the action itself
 * writes nothing; and a passcode-locked session confirms nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";

const state = vi.hoisted(() => ({
  enabled: false,
  documented: false,
  allowed: true,
  locked: null as string | null,
  session: { state: "signed-in", user: { id: "11111111-1111-4111-8111-111111111111", email: "me@example.test" }, supabase: {} } as unknown,
  sessionReads: 0,
  admin: null as unknown,
  rail: {
    refreshProtectedPayment: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "read", status: "awaiting_payment", moved: false })),
    reportTransfer: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "read", status: "awaiting_payment", moved: false })),
    confirmProtectedMilestone: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "submitted" })),
    raiseProtectedDispute: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "submitted" })),
    askNewTransferDetails: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "refused", reason: "not_documented" })),
    openProtectedPayment: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "opened", arrangementId: "arr-1", status: "awaiting_payment" }) as unknown),
    onboardMember: vi.fn(async (_d: unknown, _i: unknown) => ({ state: "verified", partyId: "PAR_1", maskedIdentifier: null, verifiedName: null }) as unknown),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../payments/providers/escrowpay/switch", () => ({ escrowPayEnabled: async () => state.enabled }));
vi.mock("../payments/providers/escrowpay/client", () => ({
  get DOCUMENTED() {
    return state.documented;
  },
}));
vi.mock("../actions/session", () => ({
  resolveSession: async () => {
    state.sessionReads += 1;
    return state.session;
  },
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
}));
vi.mock("../security/rate-limit", () => ({
  consume: async () => (state.allowed ? { allowed: true, degraded: false } : { allowed: false, retryAfterSeconds: 60, retryIn: "in about a minute" }),
  subjectForUser: (id: string) => `user:${id}`,
}));
vi.mock("@/lib/passcode/money", () => ({ passcodeMoneyRefusal: async () => state.locked }));
vi.mock("../alerts", () => ({ recordAlert: async () => ({ ok: true }) }));
vi.mock("./member-wallet", () => ({ adminDb: () => state.admin }));
vi.mock("./protected-rail", () => ({
  protectedRailDeps: (db: unknown) => ({ db }),
  refreshProtectedPayment: (d: unknown, i: unknown) => state.rail.refreshProtectedPayment(d, i),
  reportTransfer: (d: unknown, i: unknown) => state.rail.reportTransfer(d, i),
  confirmProtectedMilestone: (d: unknown, i: unknown) => state.rail.confirmProtectedMilestone(d, i),
  raiseProtectedDispute: (d: unknown, i: unknown) => state.rail.raiseProtectedDispute(d, i),
  askNewTransferDetails: (d: unknown, i: unknown) => state.rail.askNewTransferDetails(d, i),
  openProtectedPayment: (d: unknown, i: unknown) => state.rail.openProtectedPayment(d, i),
}));
vi.mock("./protected-provider", () => ({ onboardMember: (d: unknown, i: unknown) => state.rail.onboardMember(d, i) }));

const actions = await import("./protected-actions");
const { PROTECTED_ACTION_REFUSED, PROTECTED_IDENTITY_RESULT, PROTECTED_START_REFUSED } = await import("./copy");

const ME = "11111111-1111-4111-8111-111111111111";
const target = { agreementId: "33333333-3333-4333-8333-333333333333", arrangementId: "44444444-4444-4444-8444-444444444444" };
const problem = { ...target, reason: "no_access", statement: "The door code did not work at all." };
const identity = { kind: "nin" as const, identifier: "12345678901", dateOfBirth: "1990-01-31", consent: true as const };
const start = { agreementId: target.agreementId, acceptedVersion: 3 };

const all = [
  ["refreshProtected", () => actions.refreshProtected(target)],
  ["reportProtectedTransfer", () => actions.reportProtectedTransfer(target)],
  ["confirmProtected", () => actions.confirmProtected(target)],
  ["raiseProtectedProblem", () => actions.raiseProtectedProblem(problem)],
  ["newProtectedDetails", () => actions.newProtectedDetails(target)],
  ["verifyProtectedIdentity", () => actions.verifyProtectedIdentity(identity)],
  ["startProtected", () => actions.startProtected(start)],
] as const;

let admin: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
  state.enabled = false;
  state.documented = false;
  state.allowed = true;
  state.locked = null;
  state.sessionReads = 0;
  admin = fakeSupabase();
  state.admin = admin.client;
  Object.values(state.rail).forEach((fn) => fn.mockClear());
});

const railCalls = () => Object.values(state.rail).reduce((n, fn) => n + fn.mock.calls.length, 0);

describe("switched off", () => {
  it.each(all)("%s refuses before reading a session or calling the rail", async (_name, run) => {
    const out = await run();
    expect(out).toEqual({ ok: false, error: PROTECTED_ACTION_REFUSED.rail_off });
    expect(state.sessionReads).toBe(0);
    expect(railCalls()).toBe(0);
  });

  it.each(all)("%s still refuses with the switch on while the provider is undocumented", async (_name, run) => {
    state.enabled = true;
    expect(await run()).toEqual({ ok: false, error: PROTECTED_ACTION_REFUSED.rail_off });
    expect(railCalls()).toBe(0);
  });

  it.each(all)("%s refuses with the API documented but the switch off", async (_name, run) => {
    state.documented = true;
    expect(await run()).toEqual({ ok: false, error: PROTECTED_ACTION_REFUSED.rail_off });
    expect(railCalls()).toBe(0);
  });
});

describe("once the rail is on (built, not live)", () => {
  beforeEach(() => {
    state.enabled = true;
    state.documented = true;
  });

  it.each(all)("%s refuses a signed-out caller and an exhausted limit", async (_name, run) => {
    state.session = { state: "signed-out" };
    expect((await run()).ok).toBe(false);
    state.session = { state: "signed-in", user: { id: ME, email: "me@example.test" }, supabase: {} };
    state.allowed = false;
    expect(await run()).toEqual({ ok: false, error: PROTECTED_ACTION_REFUSED.too_many });
    expect(railCalls()).toBe(0);
  });

  it("refuses malformed ids and a too-short statement", async () => {
    expect((await actions.refreshProtected({ agreementId: "x", arrangementId: target.arrangementId })).ok).toBe(false);
    expect((await actions.raiseProtectedProblem({ ...problem, statement: "short" })).ok).toBe(false);
    expect((await actions.raiseProtectedProblem({ ...problem, reason: "made_up" })).ok).toBe(false);
    expect(railCalls()).toBe(0);
  });

  it("refresh and 'I've made the transfer' reach only the read-back steps, as the signed-in member, and write nothing", async () => {
    expect(await actions.refreshProtected(target)).toEqual({ ok: true, data: { read: true } });
    expect(await actions.reportProtectedTransfer(target)).toEqual({ ok: true, data: { read: true } });
    expect(state.rail.refreshProtectedPayment.mock.calls[0]?.[1]).toEqual({ arrangementId: target.arrangementId, actorUserId: ME });
    expect(state.rail.reportTransfer.mock.calls[0]?.[1]).toEqual({ arrangementId: target.arrangementId, actorUserId: ME });
    expect(state.rail.confirmProtectedMilestone).not.toHaveBeenCalled();
    expect(admin.calls).toHaveLength(0);
  });

  it("a read-back the provider did not answer is not success", async () => {
    state.rail.refreshProtectedPayment.mockResolvedValueOnce({ outcome: "not_reachable" } as never);
    expect(await actions.refreshProtected(target)).toEqual({ ok: true, data: { read: false } });
  });

  it("a passcode-locked session confirms nothing", async () => {
    state.locked = "Unlock Vallo first.";
    expect(await actions.confirmProtected(target)).toEqual({ ok: false, error: "Unlock Vallo first." });
    expect(state.rail.confirmProtectedMilestone).not.toHaveBeenCalled();
  });

  it("an unanswered release instruction is reported as not submitted", async () => {
    state.rail.confirmProtectedMilestone.mockResolvedValueOnce({ outcome: "unknown" } as never);
    expect(await actions.confirmProtected(target)).toEqual({ ok: true, data: { submitted: false } });
  });

  it("a problem carries its reason in words with the member's own statement", async () => {
    await actions.raiseProtectedProblem(problem);
    expect(state.rail.raiseProtectedDispute.mock.calls[0]?.[1]).toEqual({
      arrangementId: target.arrangementId,
      actorUserId: ME,
      statement: "I could not access the property: The door code did not work at all.",
    });
  });

  it("new details are refused while the provider's process is undocumented", async () => {
    expect(await actions.newProtectedDetails(target)).toEqual({ ok: false, error: PROTECTED_ACTION_REFUSED.rail_off });
  });
});

describe("the identity check", () => {
  beforeEach(() => {
    state.enabled = true;
    state.documented = true;
    state.session = { state: "signed-in", user: { id: ME, email: "me@example.test" }, supabase: {} };
  });

  it("passes the number straight to the check, as the signed-in member, and answers only that it passed", async () => {
    expect(await actions.verifyProtectedIdentity(identity)).toEqual({ ok: true, data: { verified: true } });
    expect(state.rail.onboardMember.mock.calls[0]?.[1]).toEqual({ userId: ME, kind: "nin", identifier: "12345678901", dateOfBirth: "1990-01-31", email: "me@example.test", name: null, phone: null });
    expect(admin.calls).toHaveLength(0);
  });

  it("refuses without the member's own consent, a number that is not eleven digits, and a date that is not one", async () => {
    expect(await actions.verifyProtectedIdentity({ ...identity, consent: false as never })).toEqual({ ok: false, error: PROTECTED_IDENTITY_RESULT.bad_input });
    expect(await actions.verifyProtectedIdentity({ ...identity, identifier: "1234" })).toEqual({ ok: false, error: PROTECTED_IDENTITY_RESULT.bad_input });
    expect(await actions.verifyProtectedIdentity({ ...identity, dateOfBirth: "1990-02-31" })).toEqual({ ok: false, error: PROTECTED_IDENTITY_RESULT.bad_input });
    expect(state.rail.onboardMember).not.toHaveBeenCalled();
    expect(state.sessionReads).toBe(0);
  });

  it("refuses a member under 18, and one with no email on the account", async () => {
    const young = `${new Date().getUTCFullYear() - 10}-01-01`;
    expect(await actions.verifyProtectedIdentity({ ...identity, dateOfBirth: young })).toEqual({ ok: false, error: PROTECTED_IDENTITY_RESULT.under_age });
    state.session = { state: "signed-in", user: { id: ME }, supabase: {} };
    expect(await actions.verifyProtectedIdentity(identity)).toEqual({ ok: false, error: PROTECTED_IDENTITY_RESULT.no_email });
    expect(state.rail.onboardMember).not.toHaveBeenCalled();
  });

  it.each([
    ["not_matched", PROTECTED_IDENTITY_RESULT.not_matched],
    ["needs_review", PROTECTED_IDENTITY_RESULT.needs_review],
    ["bad_input", PROTECTED_IDENTITY_RESULT.bad_input],
    ["unavailable", PROTECTED_IDENTITY_RESULT.unavailable],
  ])("a check that came back %s is not success", async (stateName, message) => {
    state.rail.onboardMember.mockResolvedValueOnce({ state: stateName });
    expect(await actions.verifyProtectedIdentity(identity)).toEqual({ ok: false, error: message });
  });

  it("a passcode-locked session checks nothing", async () => {
    state.locked = "Unlock Vallo first.";
    expect(await actions.verifyProtectedIdentity(identity)).toEqual({ ok: false, error: "Unlock Vallo first." });
    expect(state.rail.onboardMember).not.toHaveBeenCalled();
  });
});

describe("starting a protected payment", () => {
  beforeEach(() => {
    state.enabled = true;
    state.documented = true;
    state.session = { state: "signed-in", user: { id: ME, email: "me@example.test" }, supabase: {} };
  });

  it("opens on the exact version the payer accepted, as the signed-in member", async () => {
    expect(await actions.startProtected(start)).toEqual({ ok: true, data: { state: "opened" } });
    expect(state.rail.openProtectedPayment.mock.calls[0]?.[1]).toEqual({ agreementId: target.agreementId, acceptedVersion: 3, actorUserId: ME });
  });

  it("sends an unchecked payer to the identity step, and reports an unanswered open as still being set up", async () => {
    state.rail.openProtectedPayment.mockResolvedValueOnce({ outcome: "refused", reason: "payer_identity_required" });
    expect(await actions.startProtected(start)).toEqual({ ok: true, data: { state: "identity" } });
    state.rail.openProtectedPayment.mockResolvedValueOnce({ outcome: "unknown", arrangementId: "arr-1" });
    expect(await actions.startProtected(start)).toEqual({ ok: true, data: { state: "pending" } });
  });

  it.each([
    ["lister_not_ready", PROTECTED_START_REFUSED.lister_not_ready],
    ["agreement_changed", PROTECTED_START_REFUSED.agreement_changed],
    ["card_payment_started", PROTECTED_START_REFUSED.card_payment_started],
    ["category_not_approved", PROTECTED_START_REFUSED.not_offered],
    ["switched_off", PROTECTED_ACTION_REFUSED.rail_off],
    ["store_unavailable", PROTECTED_ACTION_REFUSED.unavailable],
  ])("a refusal for %s is said plainly and is never success", async (reason, message) => {
    state.rail.openProtectedPayment.mockResolvedValueOnce({ outcome: "refused", reason });
    expect(await actions.startProtected(start)).toEqual({ ok: false, error: message });
  });

  it("a passcode-locked session opens nothing, and a malformed request opens nothing", async () => {
    state.locked = "Unlock Vallo first.";
    expect(await actions.startProtected(start)).toEqual({ ok: false, error: "Unlock Vallo first." });
    state.locked = null;
    expect((await actions.startProtected({ agreementId: "x", acceptedVersion: 3 })).ok).toBe(false);
    expect(state.rail.openProtectedPayment).not.toHaveBeenCalled();
  });
});
