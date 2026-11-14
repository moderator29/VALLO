import { describe, expect, it } from "vitest";
import { invitesStatusPlan } from "./useCallRealtime";

/**
 * BR-20. removeChannel makes realtime-js fire the channel's own status
 * callback again with CLOSED, synchronously. The rule under test is the one
 * that stops that turning into recursion: once a reopen is under way, every
 * further status from the same channel is ignored. On live this recursion
 * was 69 "Maximum call stack size exceeded" crash rows across home, the feed
 * and the console before the guard existed.
 */
describe("invitesStatusPlan", () => {
  it("reopens once on an error, a timeout or a close", () => {
    const fresh = { closed: false, reopening: false };
    expect(invitesStatusPlan("CHANNEL_ERROR", fresh)).toBe("reopen");
    expect(invitesStatusPlan("TIMED_OUT", fresh)).toBe("reopen");
    expect(invitesStatusPlan("CLOSED", fresh)).toBe("reopen");
  });

  it("ignores the CLOSED that our own removeChannel fires back", () => {
    expect(invitesStatusPlan("CLOSED", { closed: false, reopening: true })).toBe("ignore");
    expect(invitesStatusPlan("CHANNEL_ERROR", { closed: false, reopening: true })).toBe("ignore");
  });

  it("the simulated realtime-js echo settles instead of recursing", () => {
    /* A callback wired the way the hook wires it, against a fake removeChannel
       that synchronously echoes CLOSED, exactly as realtime-js does. Without
       the guard this loop never ends. */
    let reopening = false;
    let removals = 0;
    let reopensScheduled = 0;
    const callback = (status: string): void => {
      const plan = invitesStatusPlan(status, { closed: false, reopening });
      if (plan !== "reopen") return;
      reopening = true;
      reopensScheduled += 1;
      removeChannel();
    };
    const removeChannel = (): void => {
      removals += 1;
      if (removals > 5) throw new Error("recursion: removeChannel echoed CLOSED for ever");
      callback("CLOSED");
    };
    callback("CHANNEL_ERROR");
    expect(removals).toBe(1);
    expect(reopensScheduled).toBe(1);
  });

  it("ignores everything after cleanup, a late SUBSCRIBED included", () => {
    expect(invitesStatusPlan("SUBSCRIBED", { closed: true, reopening: false })).toBe("ignore");
    expect(invitesStatusPlan("SUBSCRIBED", { closed: false, reopening: true })).toBe("ignore");
    expect(invitesStatusPlan("CLOSED", { closed: true, reopening: false })).toBe("ignore");
  });

  it("marks the channel live only on a fresh SUBSCRIBED", () => {
    expect(invitesStatusPlan("SUBSCRIBED", { closed: false, reopening: false })).toBe("live");
  });
});
