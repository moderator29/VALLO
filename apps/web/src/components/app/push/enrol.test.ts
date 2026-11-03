import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deviceIsLive, failureMessage, readLocalDevice } from "./device-state";
import { enrol, failureReference, replyFailure } from "./enrol";

/**
 * `enrol` from the permission grant to the register call, every branch the
 * founder could have hit on 23 September, with the browser stood in by
 * stubs. After each run the SAME rule the settings control uses
 * (`deviceIsLive`) is asked whether this device now reads on.
 */

const ENDPOINT = "https://web.push.apple.com/QAbcdefghijklmnop";
/* A real uncompressed P-256 public key shape, base64url, 65 bytes. */
const PUBLIC_KEY = "BHbluqkxAQZcZ3bhDOpfGe5rpoTG6yCF7DelATIoCo2jblBzbiwwgkXUHerjnJrHtDiGCszk_11B4CjdHJXQAdc";

type Reply = { status: number; body: unknown };

let replies: Record<string, Reply | Error>;
let calls: string[];
let store: Map<string, string>;
let subscribed: boolean;

function json(status: number, body: unknown): Reply {
  return { status, body };
}

beforeEach(() => {
  calls = [];
  store = new Map();
  subscribed = false;
  replies = {
    "/api/push/key": json(200, { configured: true, publicKey: PUBLIC_KEY }),
    "/api/push/register": json(200, { ok: true, deviceRef: "a1b2c3d4e5f6" }),
  };

  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
  };
  const registration = {
    scope: "https://www.vallospaces.com/",
    pushManager: {
      getSubscription: async () => (subscribed ? subscription : null),
      subscribe: async () => {
        subscribed = true;
        return subscription;
      },
    },
  };

  vi.stubGlobal("window", {
    Notification: {},
    PushManager: function PushManager() {},
    atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: async () => "granted",
  });
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    serviceWorker: {
      register: async () => registration,
      ready: Promise.resolve(registration),
      getRegistration: async () => undefined,
    },
  });
  vi.stubGlobal("fetch", async (url: string) => {
    /* The attempt report (`reportAttempt`) is telemetry, not part of enrolment. */
    if (url === "/api/push/enrol-log") return { ok: true, status: 200, json: async () => ({ ok: true }) };
    calls.push(url);
    const reply = replies[url];
    if (reply instanceof Error) throw reply;
    if (!reply) throw new Error(`unexpected fetch ${url}`);
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** What the settings control would read after the page re-rendered. */
function readsOn(liveRefs: string[]): boolean {
  return deviceIsLive({
    permission: "granted",
    local: readLocalDevice(),
    currentEndpoint: subscribed ? ENDPOINT : null,
    liveRefs,
  });
}

describe("the founder's branch: permission granted, the key route refuses a signed-out request", () => {
  it("is signed_out, never reaches register, and does not read on", async () => {
    replies["/api/push/key"] = json(401, { error: "Sign in to use this.", code: "sign-in-required" });
    const outcome = await enrol();
    expect(outcome).toMatchObject({ ok: false, reason: "signed_out" });
    expect(calls).toEqual(["/api/push/key"]);
    expect(readLocalDevice()).toBeNull();
    expect(readsOn([])).toBe(false);
    /* And the screen has words for it, not a bare light. */
    expect(failureMessage("signed_out", { iosHomeScreenApp: true, where: "settings" })).toMatch(
      /not signed in inside this app/,
    );
  });
});

describe("the branch after the key route opened: key fine, register refuses a signed-out request", () => {
  it("is signed_out, not not_saved, and does not read on", async () => {
    replies["/api/push/register"] = json(401, { ok: false, reason: "signed_out" });
    const outcome = await enrol();
    expect(outcome).toMatchObject({ ok: false, reason: "signed_out" });
    expect(calls).toEqual(["/api/push/key", "/api/push/register"]);
    /* The browser now HOLDS a subscription. That is exactly the state that
       must not light the control: the server has no row. */
    expect(subscribed).toBe(true);
    expect(readLocalDevice()).toBeNull();
    expect(readsOn([])).toBe(false);
  });
});

describe("register failures", () => {
  it("a 500 is not_saved and does not read on", async () => {
    replies["/api/push/register"] = json(500, { ok: false, reason: "not_saved" });
    expect(await enrol()).toMatchObject({ ok: false, reason: "not_saved" });
    expect(readsOn([])).toBe(false);
  });

  it("a 200 without a device_ref is not_saved", async () => {
    replies["/api/push/register"] = json(200, { ok: true });
    expect(await enrol()).toMatchObject({ ok: false, reason: "not_saved" });
    expect(readLocalDevice()).toBeNull();
  });

  it("a network failure on register is not_saved", async () => {
    replies["/api/push/register"] = new Error("offline");
    expect(await enrol()).toMatchObject({ ok: false, reason: "not_saved" });
  });

  it("a failure forgets an earlier record, so it cannot light the control", async () => {
    store.set("vallo.push.device.v1", JSON.stringify({ deviceRef: "a1b2c3d4e5f6", endpoint: ENDPOINT }));
    replies["/api/push/register"] = json(500, {});
    await enrol();
    expect(readsOn(["a1b2c3d4e5f6"])).toBe(false);
  });
});

describe("the key route, the other ways", () => {
  it("no key on the deployment is not_configured, a different fault from signed_out", async () => {
    replies["/api/push/key"] = json(200, { configured: false, missing: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] });
    expect(await enrol()).toMatchObject({ ok: false, reason: "not_configured" });
    expect(calls).toEqual(["/api/push/key"]);
  });

  it("a fetch that never completed is failed, not a claim about configuration", async () => {
    replies["/api/push/key"] = new Error("offline");
    expect(await enrol()).toMatchObject({ ok: false, reason: "failed" });
  });

  it("a refused permission stops before any request", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission: async () => "denied" });
    expect(await enrol()).toMatchObject({ ok: false, reason: "permission_denied" });
    expect(calls).toEqual([]);
  });
});

describe("register ok", () => {
  it("records the device and reads on once the page lists its ref", async () => {
    const outcome = await enrol();
    expect(outcome).toEqual({ ok: true, deviceRef: "a1b2c3d4e5f6", platform: "web" });
    expect(readLocalDevice()).toEqual({ deviceRef: "a1b2c3d4e5f6", endpoint: ENDPOINT });
    expect(readsOn(["a1b2c3d4e5f6"])).toBe(true);
    /* and still not on if the server's list does not hold it */
    expect(readsOn([])).toBe(false);
  });
});

describe("replyFailure", () => {
  it("maps statuses", () => {
    expect(replyFailure(401)).toBe("signed_out");
    expect(replyFailure(403)).toBe("signed_out");
    expect(replyFailure(503)).toBe("not_configured");
    expect(replyFailure(200)).toBeNull();
    expect(replyFailure(500)).toBeNull();
  });
});

describe("the browser half, where every real attempt on 23 September died", () => {
  it("a subscription made against an earlier key is dropped and a fresh one taken", async () => {
    let unsubscribed = false;
    let subscribedWith: ArrayBuffer | null = null;
    const stale = {
      endpoint: "https://web.push.apple.com/stale",
      options: { applicationServerKey: new Uint8Array([4, 1, 2, 3]).buffer },
      unsubscribe: async () => {
        unsubscribed = true;
        return true;
      },
      toJSON: () => ({ endpoint: "https://web.push.apple.com/stale", keys: { p256dh: "x", auth: "y" } }),
    };
    const fresh = {
      endpoint: ENDPOINT,
      toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
    };
    const registration = {
      scope: "https://www.vallospaces.com/",
      pushManager: {
        getSubscription: async () => (unsubscribed ? null : stale),
        subscribe: async (options: { applicationServerKey: ArrayBuffer }) => {
          subscribedWith = options.applicationServerKey;
          return fresh;
        },
      },
    };
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      serviceWorker: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        getRegistration: async () => undefined,
      },
    });
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
      if (url === "/api/push/register") posted.push(String(init?.body));
      const reply = replies[url] as Reply;
      return { ok: true, status: reply.status, json: async () => reply.body };
    });

    const outcome = await enrol();
    expect(outcome).toMatchObject({ ok: true });
    expect(unsubscribed).toBe(true);
    expect(subscribedWith).not.toBeNull();
    expect(new Uint8Array(subscribedWith as unknown as ArrayBuffer).length).toBe(65);
    expect(posted[0]).toContain(ENDPOINT);
    expect(posted[0]).not.toContain("stale");
  });

  it("an already-granted permission is not asked again", async () => {
    let asked = 0;
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: async () => {
        asked += 1;
        return "granted";
      },
    });
    expect(await enrol()).toMatchObject({ ok: true });
    expect(asked).toBe(0);
  });

  it("a worker that never activates is a failure with a reference, not a spinner for ever", async () => {
    vi.useFakeTimers();
    try {
      const registration = { scope: "/", pushManager: { getSubscription: async () => null, subscribe: async () => null } };
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        serviceWorker: {
          register: async () => registration,
          ready: new Promise(() => {}),
          getRegistration: async () => undefined,
        },
      });
      const pending = enrol();
      await vi.advanceTimersByTimeAsync(16_000);
      const outcome = await pending;
      expect(outcome).toMatchObject({ ok: false, reason: "failed", step: "ready", detail: "TimeoutError" });
      expect(failureReference(outcome)).toBe("ready/TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a subscribe the browser refuses names the step and the error", async () => {
    const registration = {
      scope: "/",
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => {
          const error = new Error("Push notification prompting can only be done from a user gesture.");
          error.name = "NotAllowedError";
          throw error;
        },
      },
    };
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      serviceWorker: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        getRegistration: async () => undefined,
      },
    });
    const outcome = await enrol();
    expect(failureReference(outcome)).toBe("subscribe/NotAllowedError");
    expect(calls).toEqual(["/api/push/key"]);
  });

  it("a signed-out register names the status", async () => {
    replies["/api/push/register"] = json(401, { code: "sign-in-required" });
    const outcome = await enrol();
    expect(outcome).toMatchObject({ ok: false, reason: "signed_out" });
    expect(failureReference(outcome)).toBe("register/401");
  });
});
