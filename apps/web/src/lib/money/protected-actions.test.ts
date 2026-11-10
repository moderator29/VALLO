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
  session: { state: "signed-in", user: { id: "11111111-1111-4111-8111-111111111111" }, supabase: {} } as unknown,
  sessionReads: 0,
  admin: null as unknown,
  rail: {
    refreshProtectedPayment: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "read", status: "awaiting_payment", moved: false })),
    reportTransfer: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "read", status: "awaiting_payment", moved: false })),
    confirmProtectedMilestone: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "submitted" })),
    raiseProtectedDispute: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "submitted" })),
    askNewTransferDetails: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "refused", reason: "not_documented" })),
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
}));

const actions = await import("./protected-actions");
const { PROTECTED_ACTION_REFUSED } = await import("./copy");

const ME = "11111111-1111-4111-8111-111111111111";
const target = { agreementId: "33333333-3333-4333-8333-333333333333", arrangementId: "44444444-4444-4444-8444-444444444444" };
const problem = { ...target, reason: "no_access", statement: "The door code did not work at all." };

const all = [
  ["refreshProtected", () => actions.refreshProtected(target)],
  ["reportProtectedTransfer", () => actions.reportProtectedTransfer(target)],
  ["confirmProtected", () => actions.confirmProtected(target)],
  ["raiseProtectedProblem", () => actions.raiseProtectedProblem(problem)],
  ["newProtectedDetails", () => actions.newProtectedDetails(target)],
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
    state.session = { state: "signed-in", user: { id: ME }, supabase: {} };
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
