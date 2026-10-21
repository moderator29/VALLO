import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The session memo.
 *
 * `resolveSession` is wrapped in React's `cache`, which turns the platform's
 * most-called server function into one auth round trip per request instead of
 * one per caller. The file's own header argues why that is safe. This spec
 * holds the two properties that argument depends on:
 *
 *   1. Two resolutions inside one request make ONE `auth.getUser()` call.
 *   2. The answer is identical, so a caller cannot tell it was memoised.
 *
 * It also holds the three outcomes themselves, because "unconfigured",
 * "signed-out" and "signed-in" are three genuinely different instructions to a
 * server action and collapsing any two of them is how an action starts
 * pretending.
 */

const env = vi.hoisted(() => ({ isSupabaseConfigured: vi.fn(() => true) }));
const getUser = vi.hoisted(() => vi.fn());
const server = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/env")>();
  return { ...actual, ...env };
});

vi.mock("@/lib/supabase/server", () => server);

/**
 * A request scope, because a Vitest process is not one.
 *
 * React's `cache` stores its memo in whatever the current async dispatcher
 * hands back from `getCacheForType`, and when there is no dispatcher it simply
 * calls straight through with no memoisation at all. In the real app Next
 * installs that dispatcher per request over `AsyncLocalStorage`, which is what
 * makes the memo request-scoped and therefore safe. In a bare test there is no
 * dispatcher, so without this helper `cache` is a no-op and the memo could
 * silently stop working with every test still green.
 *
 * So this installs the smallest dispatcher that is faithful to the real one: a
 * Map per scope, cleared when the scope ends. It reaches for a React internal
 * to do it, which is a thing to do in a test and not in application code, and
 * the trade is worth naming: without it, THE ONE PROPERTY THIS FILE EXISTS TO
 * PROVE cannot be observed anywhere in the suite.
 */
type AsyncDispatcher = { getCacheForType: <T>(create: () => T) => T };

function enterRequestScope(): () => void {
  const internals = (
    React as unknown as {
      __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        A: AsyncDispatcher | null;
      };
    }
  ).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  const previous = internals.A;
  const store = new Map<unknown, unknown>();
  internals.A = {
    getCacheForType<T>(create: () => T): T {
      if (!store.has(create)) store.set(create, create());
      return store.get(create) as T;
    },
  };
  return () => {
    internals.A = previous;
  };
}

/**
 * A fresh module registry per test, so one test's memo is never the next one's
 * answer. This is the same reason the memo is safe in production: its lifetime
 * is a scope, not the process.
 */
async function loadSession() {
  vi.resetModules();
  return import("./session");
}

describe("the signed-out refusal a client recognises", () => {
  it("opens with the lead a client component matches (envelope.ts cannot import this module)", async () => {
    const { SIGNED_OUT_MESSAGE } = await loadSession();
    const { SIGNED_OUT_LEAD, isSignedOutRefusal } = await import("./envelope");
    expect(SIGNED_OUT_MESSAGE.startsWith(SIGNED_OUT_LEAD)).toBe(true);
    expect(isSignedOutRefusal(SIGNED_OUT_MESSAGE)).toBe(true);
  });
});

describe("resolveSession", () => {
  beforeEach(() => {
    getUser.mockReset();
    server.createClient.mockReset();
    env.isSupabaseConfigured.mockReset();
    env.isSupabaseConfigured.mockReturnValue(true);
    server.createClient.mockImplementation(async () => ({ auth: { getUser } }));
  });

  it("reports unconfigured without reaching for a client", async () => {
    env.isSupabaseConfigured.mockReturnValue(false);
    const { resolveSession } = await loadSession();

    expect(await resolveSession()).toEqual({ state: "unconfigured" });
    expect(server.createClient).not.toHaveBeenCalled();
  });

  it("reports signed-out when there is no user, and never invents one", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { resolveSession } = await loadSession();

    expect(await resolveSession()).toEqual({ state: "signed-out" });
  });

  it("returns the user and an RLS-bound client when signed in", async () => {
    const user = { id: "user-1", email: "ada@example.ng" };
    getUser.mockResolvedValue({ data: { user } });
    const { resolveSession } = await loadSession();

    const result = await resolveSession();
    expect(result.state).toBe("signed-in");
    if (result.state !== "signed-in") throw new Error("unreachable");
    expect(result.user).toBe(user);
    expect(result.supabase).toBeDefined();
  });

  /**
   * The performance property, stated as a test so it cannot quietly regress.
   *
   * Before the memo, `/home` alone resolved the session twice: once in the
   * layout through `getShellIdentity` and once in the page through
   * `getHomeOverview`. Both of those were already wrapped in `cache`, which is
   * exactly why the duplication was invisible; the memo was on the callers
   * rather than on the shared call.
   */
  it("makes one auth round trip however many callers ask", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { resolveSession } = await loadSession();
    const leave = enterRequestScope();

    try {
      const [a, b, c] = await Promise.all([
        resolveSession(),
        resolveSession(),
        resolveSession(),
      ]);
      const d = await resolveSession();

      expect(getUser).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
      expect(b).toBe(c);
      expect(c).toBe(d);
    } finally {
      leave();
    }
  });

  /**
   * The safety half of the memo. Two requests are two scopes, so the second one
   * must ask again rather than inherit. A memo that survived a scope would be a
   * way to serve one person's session to the next caller, which is the only
   * genuinely dangerous thing a session cache can do.
   */
  it("does not leak an answer across scopes", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { resolveSession } = await loadSession();

    const leaveFirst = enterRequestScope();
    const first = await resolveSession();
    leaveFirst();
    expect(first.state).toBe("signed-in");

    getUser.mockResolvedValue({ data: { user: null } });
    const leaveSecond = enterRequestScope();
    const second = await resolveSession();
    leaveSecond();

    expect(second).toEqual({ state: "signed-out" });
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});

/**
 * B-2 FOLLOW-UP: THE FINISH-SETUP HOLD ON WRITES.
 *
 * The edge gate holds only GET page loads, so a Google or Apple account that
 * has not accepted the terms and the 18+ statement could still post, message,
 * book or pay by calling an action directly. Inside a server action,
 * `resolveSession()` answers such an account as signed out, so every write
 * refuses in the envelope it already speaks. Three properties matter:
 *
 *   1. owed (social-only, no flag, no receipt) inside an action -> refused;
 *   2. done (the flag, or the receipt on file) -> allowed;
 *   3. an email account costs NOTHING: no header read and no query.
 */
describe("resolveSession: the finish-setup hold", () => {
  const request = vi.hoisted(() => ({ headers: new Headers(), headerReads: 0 }));
  const rows = vi.hoisted(() => ({ data: [] as { document: string }[], error: null as unknown, reads: 0 }));

  vi.mock("next/headers", () => ({
    headers: async () => {
      request.headerReads += 1;
      return request.headers;
    },
    cookies: async () => ({ getAll: () => [], set: () => undefined }),
  }));

  const from = vi.fn((table: string) => {
    if (table !== "terms_acceptances") throw new Error(`unexpected read of ${table}`);
    return {
      select: () => ({
        eq: () => ({
          in: async () => {
            rows.reads += 1;
            return { data: rows.data, error: rows.error };
          },
        }),
      }),
    };
  });

  const GOOGLE = { id: "user-g", app_metadata: { provider: "google", providers: ["google"] } };
  const APPLE_DONE = {
    id: "user-a",
    app_metadata: { provider: "apple", providers: ["apple"], vallo_setup_done: true },
  };
  const EMAIL = { id: "user-e", app_metadata: { provider: "email", providers: ["email"] } };
  const LINKED = { id: "user-l", app_metadata: { provider: "google", providers: ["google", "email"] } };

  function asAction() {
    request.headers = new Headers({ "next-action": "abc123" });
  }

  beforeEach(() => {
    getUser.mockReset();
    from.mockClear();
    server.createClient.mockReset();
    env.isSupabaseConfigured.mockReset();
    env.isSupabaseConfigured.mockReturnValue(true);
    server.createClient.mockImplementation(async () => ({ auth: { getUser }, from }));
    request.headers = new Headers();
    request.headerReads = 0;
    rows.data = [];
    rows.error = null;
    rows.reads = 0;
  });

  it("refuses a write from a social-only account that owes the step", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    asAction();
    const { resolveSession } = await loadSession();

    expect(await resolveSession()).toEqual({ state: "signed-out", setupOwed: true });
    expect(rows.reads).toBe(1);
  });

  it("allows the write once the receipt is on file, read under the member's own client", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    rows.data = [{ document: "terms" }, { document: "age_18_or_over" }];
    asAction();
    const { resolveSession } = await loadSession();

    const session = await resolveSession();
    expect(session.state).toBe("signed-in");
    expect(from).toHaveBeenCalledWith("terms_acceptances");
  });

  it("still refuses with only half the record (terms, no age statement)", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    rows.data = [{ document: "terms" }];
    asAction();
    const { resolveSession } = await loadSession();

    expect((await resolveSession()).state).toBe("signed-out");
  });

  it("allows a finished account from the flag alone, with no read", async () => {
    getUser.mockResolvedValue({ data: { user: APPLE_DONE } });
    asAction();
    const { resolveSession } = await loadSession();

    expect((await resolveSession()).state).toBe("signed-in");
    expect(from).not.toHaveBeenCalled();
    expect(request.headerReads).toBe(0);
  });

  it("costs an email account nothing: no header read, no query", async () => {
    getUser.mockResolvedValue({ data: { user: EMAIL } });
    asAction();
    const { resolveSession, resolveWriteSession, accountSetupOwed } = await loadSession();

    expect((await resolveSession()).state).toBe("signed-in");
    expect((await resolveWriteSession()).state).toBe("signed-in");
    expect(await accountSetupOwed({ from } as never, EMAIL as never)).toBe(false);
    expect(from).not.toHaveBeenCalled();
    expect(request.headerReads).toBe(0);
  });

  it("never holds an account that also has an email identity", async () => {
    getUser.mockResolvedValue({ data: { user: LINKED } });
    asAction();
    const { resolveSession } = await loadSession();

    expect((await resolveSession()).state).toBe("signed-in");
    expect(from).not.toHaveBeenCalled();
  });

  it("leaves page renders to the proxy: no hold without the action header", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    const { resolveSession } = await loadSession();

    expect((await resolveSession()).state).toBe("signed-in");
    expect(from).not.toHaveBeenCalled();
  });

  it("holds a writing route handler whatever the request kind", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    const { resolveWriteSession } = await loadSession();

    expect(await resolveWriteSession()).toEqual({ state: "signed-out", setupOwed: true });
  });

  it("lifts the hold inside setupExempt (sign-out, deletion, read-only actions)", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    asAction();
    const { resolveSession } = await loadSession();
    const { setupExempt } = await import("./setup-exempt");

    const inside = await setupExempt(() => resolveSession());
    expect(inside.state).toBe("signed-in");
    expect(from).not.toHaveBeenCalled();
    /* ...and only inside it. */
    expect((await resolveSession()).state).toBe("signed-out");
  });

  it("lets the write through when the record cannot be read, like the edge gate", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    rows.error = { message: "timeout" };
    asAction();
    const { resolveSession } = await loadSession();

    expect((await resolveSession()).state).toBe("signed-in");
  });

  it("reads the record once per request however many resolutions an action makes", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE } });
    asAction();
    const { resolveSession } = await loadSession();
    const leave = enterRequestScope();
    try {
      await Promise.all([resolveSession(), resolveSession()]);
      await resolveSession();
      expect(rows.reads).toBe(1);
      expect(getUser).toHaveBeenCalledTimes(1);
    } finally {
      leave();
    }
  });
});
