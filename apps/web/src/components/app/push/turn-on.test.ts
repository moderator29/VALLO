import { beforeEach, describe, expect, it, vi } from "vitest";

import { mergeSettings } from "@/lib/profile/schema";
import { NOTIFICATION_TOPICS, everyPushOn } from "@/lib/profile/model";
import { TOPIC_BY_KIND, wantsPush, type NotificationKind } from "@/lib/push/preferences";
import { wantsSavedPriceDrops } from "@/lib/push/policy";

/*
 * THE ONE YES (the founder, 13 November 2026). `enrol` (the system prompt and
 * the registration) and `updateSettings` (the one write) are the boundaries,
 * stood in here; everything between them is the real code.
 */
const state = vi.hoisted(() => ({
  outcome: { ok: true, deviceRef: "a1b2c3d4e5f6", platform: "ios" } as unknown,
  writes: [] as unknown[],
  writeOk: true,
  enrolCalls: 0,
  store: new Map<string, string>(),
}));

vi.mock("./enrol", () => ({
  enrol: async () => {
    state.enrolCalls += 1;
    return state.outcome;
  },
}));
vi.mock("@/lib/profile/actions", () => ({
  updateSettings: async (patch: unknown) => {
    state.writes.push(patch);
    return state.writeOk ? { ok: true, data: {} } : { ok: false, error: "Signed out." };
  },
}));

const { turnOnNotifications, systemGranted } = await import("./turn-on");
const { offerVerdict, readMemory } = await import("./moments");

beforeEach(() => {
  state.outcome = { ok: true, deviceRef: "a1b2c3d4e5f6", platform: "ios" };
  state.writes = [];
  state.writeOk = true;
  state.enrolCalls = 0;
  state.store = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => state.store.get(key) ?? null,
      setItem: (key: string, value: string) => void state.store.set(key, value),
      removeItem: (key: string) => void state.store.delete(key),
    },
  });
});

describe("a granted permission turns every topic on, in one write", () => {
  it("registers the device and writes push on for every topic in ONE updateSettings call", async () => {
    const result = await turnOnNotifications();
    expect(result).toEqual({ kind: "on", deviceRef: "a1b2c3d4e5f6", topicsSaved: true });
    expect(state.enrolCalls).toBe(1);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toEqual(everyPushOn());
    const written = state.writes[0] as ReturnType<typeof everyPushOn>;
    for (const topic of NOTIFICATION_TOPICS) {
      expect(written.notifications.channels[topic]).toEqual({ push: true });
    }
    expect(written.notifications.savedPriceDrops).toBe(true);
  });

  it("the written document makes the send path deliver every kind, over old per-topic offs", async () => {
    await turnOnNotifications();
    /* A member who had switched Bookings off by email, Messages push off,
       and never said yes to marketing pushes. */
    const before = {
      notifications: {
        bookings: false,
        messages: true,
        wallet: true,
        marketing: true,
        savedPriceDrops: false,
        channels: { messages: { push: false } },
        quiet_hours: { enabled: true, from: "22:00", to: "07:00", timezone: "Africa/Lagos" },
      },
      whatsappDoorbell: true,
    };
    const after = mergeSettings(before, state.writes[0] as Parameters<typeof mergeSettings>[1]);
    for (const kind of Object.keys(TOPIC_BY_KIND) as NotificationKind[]) {
      expect(wantsPush(after, kind)).toBe(true);
    }
    expect(wantsSavedPriceDrops(after)).toBe(true);
    /* Email, quiet hours and keys this schema does not know stay as they were. */
    expect(after.notifications.bookings).toBe(false);
    expect(after.notifications.quiet_hours?.enabled).toBe(true);
    expect((after as unknown as { whatsappDoorbell: boolean }).whatsappDoorbell).toBe(true);
  });

  it("still writes every topic on when the system said yes and only the registration failed", async () => {
    state.outcome = { ok: false, reason: "not_saved", step: "register", detail: "500" };
    const result = await turnOnNotifications();
    expect(result.kind).toBe("failed");
    expect(state.writes).toHaveLength(1);
  });

  it("says so when the one write is refused, and the device is still on", async () => {
    state.writeOk = false;
    expect(await turnOnNotifications()).toEqual({ kind: "on", deviceRef: "a1b2c3d4e5f6", topicsSaved: false });
    expect(state.writes).toHaveLength(1);
  });
});

describe("a refusal writes nothing and is never asked again", () => {
  it("a denied system prompt writes no settings and the first-run screen never shows again", async () => {
    state.outcome = { ok: false, reason: "permission_denied" };
    expect(await turnOnNotifications()).toEqual({ kind: "denied" });
    expect(state.writes).toHaveLength(0);
    /* Even on a device that later reads the permission as askable again. */
    expect(offerVerdict({ permission: "default", registered: false, memory: readMemory() })).toEqual({
      show: false,
      because: "answered",
    });
  });

  it("a device without push writes nothing", async () => {
    state.outcome = { ok: false, reason: "unsupported" };
    expect(await turnOnNotifications()).toEqual({ kind: "unsupported" });
    expect(state.writes).toHaveLength(0);
  });

  it("only a step past the permission counts as granted", () => {
    expect(systemGranted({ ok: false, reason: "failed", step: "permission", detail: "Error" })).toBe(false);
    expect(systemGranted({ ok: false, reason: "unsupported", step: "plugin" })).toBe(false);
    expect(systemGranted({ ok: false, reason: "failed", step: "token", detail: "timeout" })).toBe(true);
    expect(systemGranted({ ok: false, reason: "signed_out", step: "register", detail: "401" })).toBe(true);
  });
});
