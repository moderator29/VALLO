import { beforeEach, describe, expect, it, vi } from "vitest";

/* F-14 and F-15: the launch read and the silent re-register, with the shell
   and the plugin stood in. */
const state = vi.hoisted(() => ({
  receive: "granted" as string,
  registered: 0,
  posted: [] as unknown[],
  local: null as null | { deviceRef: string },
  cleared: 0,
  status: 200,
}));

vi.mock("@/lib/native/platform", () => ({ looksNative: () => true }));
vi.mock("./device-state", () => ({
  readLocalDevice: () => state.local,
  writeLocalDevice: () => undefined,
  clearLocalDevice: () => {
    state.cleared += 1;
  },
  isIosHomeScreenApp: () => false,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    registerPlugin: () => ({
      checkPermissions: async () => ({ receive: state.receive }),
      requestPermissions: async () => {
        throw new Error("must never prompt");
      },
      register: async () => {
        state.registered += 1;
      },
      addListener: async (event: string, handler: (p: { value?: string }) => void) => {
        if (event === "registration") setTimeout(() => handler({ value: "fcm-token" }), 0);
        return { remove: async () => undefined };
      },
    }),
  },
}));

const { currentPermission, readNativePermission, refreshNativeRegistration } = await import("./enrol");

beforeEach(() => {
  state.receive = "granted";
  state.registered = 0;
  state.posted = [];
  state.local = { deviceRef: "abc123" };
  state.cleared = 0;
  state.status = 200;
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    state.posted.push(JSON.parse(init.body));
    return {
      ok: state.status === 200,
      status: state.status,
      json: async () => (state.status === 200 ? { ok: true, deviceRef: "abc123" } : { ok: false, reason: "signed_out" }),
    };
  });
});

describe("the shell's launch push read (F-14, F-15)", () => {
  it("reads the real permission without asking, and remembers it", async () => {
    state.receive = "denied";
    expect(await readNativePermission()).toBe("denied");
    expect(currentPermission()).toBe("denied");
  });

  it("re-registers a device enrolled before, silently", async () => {
    expect(await refreshNativeRegistration()).toBe("refreshed");
    expect(state.registered).toBe(1);
    expect(state.posted[0]).toMatchObject({ platform: "android", token: "fcm-token" });
  });

  it("does nothing for a device never enrolled on this install", async () => {
    state.local = null;
    expect(await refreshNativeRegistration()).toBe("skipped");
    expect(state.registered).toBe(0);
  });

  it("does nothing when the permission is not granted", async () => {
    state.receive = "prompt";
    expect(await refreshNativeRegistration()).toBe("skipped");
    expect(state.registered).toBe(0);
  });

  it("keeps the record when the launch has no session, so the next signed-in launch re-registers", async () => {
    state.status = 401;
    expect(await refreshNativeRegistration()).toBe("failed");
    expect(state.cleared).toBe(0);
  });

  it("keeps the record when the register route is pacing calls (429): the server row is still live", async () => {
    state.status = 429;
    expect(await refreshNativeRegistration()).toBe("failed");
    expect(state.cleared).toBe(0);
  });

  it("still forgets the record when the server refuses it for another reason", async () => {
    state.status = 500;
    expect(await refreshNativeRegistration()).toBe("failed");
    expect(state.cleared).toBe(1);
  });
});
