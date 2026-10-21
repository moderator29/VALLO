import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The first message from a profile opens the direct chat through
 * `start_direct_conversation`. The database refuses with 42501 for a block
 * and for "Ask me first" (trigger conversations_direct_contact_policy), so
 * the action reads the refusal's word to say the true sentence.
 */
const ME = "11111111-1111-4111-8111-111111111111";
const ADA = "22222222-2222-4222-8222-222222222222";

const rpcResult = vi.hoisted(() => ({
  value: { data: null as unknown, error: null as null | { code?: string; message?: string } },
}));
const sent = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "nc",
  SIGNED_OUT_MESSAGE: "so",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: ME },
    supabase: { rpc: async () => rpcResult.value },
  }),
}));
vi.mock("../flags", () => ({ isFeatureEnabled: async () => true }));
vi.mock("../phone-otp/gate", () => ({ phoneGateFor: async () => null }));
vi.mock("./blocks", () => ({ BLOCKED_THREAD_MESSAGE: "blocked", blockedBetween: async () => false }));
vi.mock("./direct", () => ({
  readDirectTarget: async () => ({
    state: "ready",
    viewerId: ME,
    conversationId: null,
    target: { userId: ADA, handle: "ada", displayLabel: "Ada Eze", avatarUrl: "", isAgent: false },
  }),
}));
vi.mock("./actions", () => ({
  sendMessage: async (input: unknown) => {
    sent.calls.push(input);
    return { ok: true, data: {} };
  },
}));

const { sendDirectMessage } = await import("./direct-actions");

beforeEach(() => {
  sent.calls = [];
  rpcResult.value = { data: null, error: null };
});

describe("the first direct message", () => {
  it("opens the chat and sends when the database accepts (control)", async () => {
    rpcResult.value = { data: "33333333-3333-4333-8333-333333333333", error: null };
    const result = await sendDirectMessage({ handle: "ada", body: "Hello" });
    expect(result).toEqual({ ok: true, data: { conversationId: "33333333-3333-4333-8333-333333333333" } });
    expect(sent.calls).toHaveLength(1);
  });

  it("says follow first, not blocked, when the database holds Ask me first", async () => {
    rpcResult.value = { data: null, error: { code: "42501", message: "direct:follow_first" } };
    const result = await sendDirectMessage({ handle: "ada", body: "Hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Follow Ada Eze to message them");
    expect(sent.calls).toHaveLength(0);
  });

  it("says blocked when the database refuses across a block", async () => {
    rpcResult.value = { data: null, error: { code: "42501", message: "direct:blocked" } };
    const result = await sendDirectMessage({ handle: "ada", body: "Hello" });
    expect(result).toMatchObject({ ok: false, error: "blocked" });
  });
});
