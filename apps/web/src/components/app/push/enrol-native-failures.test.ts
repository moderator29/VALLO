import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * WHY `push_tokens` STAYS EMPTY ON A HANDSET, SAID BY THE FAILURE ITSELF.
 *
 * Every native failure used to read as "unsupported" or a bare "failed", so a
 * phone that never registered could not say whether the binary lacked the
 * plugin, the permission call threw, APNs or FCM refused, or no token came.
 * Each now names its step and a short reason, and a token that arrives at
 * once is never lost to a listener that was not attached yet.
 */
const state = vi.hoisted(() => ({
  request: async (): Promise<{ receive: string }> => ({ receive: "granted" }),
  register: async (): Promise<void> => undefined,
  emit: null as null | { event: "registration" | "registrationError"; payload: { value?: string; error?: unknown } },
  attached: [] as string[],
  attachDelayMs: 0,
  posted: [] as unknown[],
}));

vi.mock("@/lib/native/platform", () => ({ looksNative: () => true }));
vi.mock("./device-state", () => ({
  readLocalDevice: () => null,
  writeLocalDevice: () => undefined,
  clearLocalDevice: () => undefined,
  isIosHomeScreenApp: () => false,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
    registerPlugin: () => {
      const handlers = new Map<string, (p: { value?: string; error?: unknown }) => void>();
      return {
        requestPermissions: () => state.request(),
        addListener: async (event: string, handler: (p: { value?: string; error?: unknown }) => void) => {
          /* The bridge attaches a listener a moment after it is asked to. */
          await new Promise((resolve) => setTimeout(resolve, state.attachDelayMs));
          handlers.set(event, handler);
          state.attached.push(event);
          return { remove: async () => undefined };
        },
        register: async () => {
          await state.register();
          /* iOS answers from its cache at once and keeps nothing for a late listener. */
          if (state.emit) handlers.get(state.emit.event)?.(state.emit.payload);
        },
      };
    },
  },
}));

const { enrol, failureReference } = await import("./enrol");

beforeEach(() => {
  state.request = async () => ({ receive: "granted" });
  state.register = async () => undefined;
  state.emit = { event: "registration", payload: { value: "A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90" } };
  state.attached = [];
  state.attachDelayMs = 5;
  state.posted = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    state.posted.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ ok: true, deviceRef: "abc123abc123" }) };
  });
});

describe("native enrolment", () => {
  it("attaches both listeners before asking, so an instant token is kept", async () => {
    const outcome = await enrol();
    expect(outcome).toMatchObject({ ok: true, platform: "ios" });
    expect(state.posted[0]).toMatchObject({ platform: "ios", deviceLabel: "iPhone" });
  });

  it("names APNs' own refusal instead of saying unsupported", async () => {
    state.emit = {
      event: "registrationError",
      payload: { error: "no valid aps-environment entitlement string found for application" },
    };
    const outcome = await enrol();
    expect(outcome).toMatchObject({ ok: false, reason: "failed", step: "token" });
    expect(failureReference(outcome)).toMatch(/^token\/os-no-valid-aps-environment/);
    expect(state.posted).toEqual([]);
  });

  it("says unsupported only for a binary without the plugin", async () => {
    state.request = async () => {
      throw Object.assign(new Error("not implemented"), { code: "UNIMPLEMENTED" });
    };
    expect(await enrol()).toMatchObject({ ok: false, reason: "unsupported", step: "plugin" });
  });

  it("names a permission call that throws for any other reason", async () => {
    state.request = async () => {
      throw Object.assign(new Error("bridge"), { name: "TypeError" });
    };
    expect(await enrol()).toMatchObject({ ok: false, reason: "failed", step: "permission", detail: "TypeError" });
  });

  it("names a register call the plugin refuses", async () => {
    state.emit = null;
    state.register = async () => {
      throw new Error("refused");
    };
    expect(await enrol()).toMatchObject({ ok: false, reason: "failed", step: "token", detail: "register" });
  });

  it("names the wait that never got an answer", async () => {
    vi.useFakeTimers();
    state.emit = null;
    state.attachDelayMs = 0;
    const pending = enrol();
    await vi.advanceTimersByTimeAsync(10_500);
    expect(await pending).toMatchObject({ ok: false, reason: "failed", step: "token", detail: "timeout" });
    vi.useRealTimers();
  });

  it("keeps a refused permission as a refusal", async () => {
    state.request = async () => ({ receive: "denied" });
    expect(await enrol()).toEqual({ ok: false, reason: "permission_denied" });
  });
});
