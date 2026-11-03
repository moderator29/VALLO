import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueue = vi.fn();
vi.mock("./outbox", async (orig) => ({ ...(await orig<object>()), enqueue }));

const ID = "3653d202-e498-4db0-ab71-882649f7f446";

describe("setOrKeep", () => {
  beforeEach(() => {
    enqueue.mockReset();
    vi.resetModules();
  });

  it("returns the answer when the send goes through, keeping nothing", async () => {
    const { setOrKeep } = await import("./send-or-keep");
    const out = await setOrKeep("like_post", ID, true, async () => ({ ok: true as const, data: { marked: true } }));
    expect(out.state).toBe("sent");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("keeps the wanted state when the request dies", async () => {
    enqueue.mockResolvedValue(true);
    const { setOrKeep } = await import("./send-or-keep");
    const out = await setOrKeep("like_post", ID, true, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(out.state).toBe("kept");
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0]).toMatchObject({ key: `like_post:${ID}`, want: true });
  });

  it("says not_kept for a target the outbox refuses", async () => {
    const { setOrKeep } = await import("./send-or-keep");
    const out = await setOrKeep("like_post", "nope", true, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(out.state).toBe("not_kept");
  });
});
