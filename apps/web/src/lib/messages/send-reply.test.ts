import { describe, expect, it, vi } from "vitest";

/**
 * A reply names the message it answers. `sendMessage` used to drop
 * `replyToId` on its way into the work, so every reply was saved as a plain
 * message and the quote vanished on the next open. The insert is read here.
 */
const ME = "957b3bd2-cce3-425d-bba9-5cd876ca3d62";
const THREAD = "c0000000-0000-4000-8000-000000000001";
const QUOTED = "a0000000-0000-4000-8000-000000000002";

const inserted = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

function client() {
  return {
    from() {
      const chain: Record<string, unknown> = {};
      chain.insert = (row: Record<string, unknown>) => {
        inserted.rows.push(row);
        return chain;
      };
      chain.select = () => chain;
      chain.single = async () => ({
        data: { id: "m1", conversation_id: THREAD, body: "yes", created_at: "2026-10-17T10:00:00Z" },
        error: null,
      });
      return chain;
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "nc",
  SIGNED_OUT_MESSAGE: "so",
  resolveSession: async () => ({ state: "signed-in", user: { id: ME }, supabase: client() }),
}));
vi.mock("../offline/replay-guard", () => ({
  oncePerTap: (_s: string, _u: string, _k: unknown, work: () => unknown) => work(),
  tapKey: () => null,
}));
vi.mock("../flags", () => ({ isFeatureEnabled: async () => true }));
vi.mock("../phone-otp/gate", () => ({ phoneGateFor: async () => null }));
vi.mock("./blocks", () => ({
  BLOCKED_MESSAGE: "b",
  BLOCKED_THREAD_MESSAGE: "bt",
  blockedBetween: async () => false,
  guardConversation: async () => ({ ok: true }),
}));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => client() }));

const { sendMessage } = await import("./actions");

describe("sending a reply", () => {
  it("saves the message it answers", async () => {
    inserted.rows = [];
    const result = await sendMessage({ conversationId: THREAD, body: "yes", replyToId: QUOTED });
    expect(result.ok).toBe(true);
    expect(inserted.rows[0]).toMatchObject({ conversation_id: THREAD, reply_to_id: QUOTED });
  });

  it("saves a plain message with no quote (control)", async () => {
    inserted.rows = [];
    await sendMessage({ conversationId: THREAD, body: "yes" });
    expect(inserted.rows[0]).toMatchObject({ reply_to_id: null });
  });
});
