import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE SIGN-IN'S CLIENT AND THE FACE ID'S CLIENT HAVE DEADLINES (SPEED, 13
 * November 2026). `createClientWithAgent` (every password and code sign-in)
 * had none, unlike `createClient`; the service-role client can now be asked
 * for one by a caller in front of a tap, and is unchanged for everybody else.
 */
const s = vi.hoisted(() => ({ ssr: [] as Record<string, unknown>[], js: [] as Record<string, unknown>[] }));

vi.mock("server-only", () => ({}));
vi.mock("./env", () => ({
  requireSupabasePublicEnv: () => ({ url: "https://project.supabase.co", anonKey: "anon-key" }),
  serviceRoleKey: () => "service-key-for-the-test",
}));
vi.mock("../supabase/env", () => ({
  requireSupabasePublicEnv: () => ({ url: "https://project.supabase.co", anonKey: "anon-key" }),
  serviceRoleKey: () => "service-key-for-the-test",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (iPhone) Safari/605" }),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: Record<string, unknown>) => {
    s.ssr.push(options);
    return {};
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: Record<string, unknown>) => {
    s.js.push(options);
    return {};
  },
}));

import { createClientWithAgent } from "../security/agent-client";
import { createAdminClient } from "./admin";

beforeEach(() => {
  s.ssr = [];
  s.js = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The deadline the client's fetch puts on an auth call. `AbortSignal.timeout`
 * runs on Node's own timers, which fake timers do not drive, so the asked
 * length is read off the call and the abort itself is proved with a short
 * real one in `deadline-fetch.test.ts`.
 */
async function deadlineOf(fetcher: typeof fetch): Promise<{ ms: number | undefined; signalled: boolean }> {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  let signalled = false;
  vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
    signalled = init?.signal instanceof AbortSignal;
    return new Response("{}");
  });
  await fetcher("https://project.supabase.co/auth/v1/token?grant_type=password");
  const ms = timeout.mock.calls.at(-1)?.[0];
  timeout.mockRestore();
  return { ms, signalled };
}

describe("createClientWithAgent", () => {
  it("still forwards the browser's agent family", async () => {
    await createClientWithAgent();
    const global = s.ssr[0]!.global as { headers: Record<string, string> };
    expect(global.headers["user-agent"]).toContain("iPhone");
  });

  it("ends a stalled auth call at the asked deadline", async () => {
    await createClientWithAgent({ deadlineMs: 8_000 });
    const { fetch: fetcher } = s.ssr[0]!.global as { fetch: typeof fetch };
    expect(await deadlineOf(fetcher)).toEqual({ ms: 8_000, signalled: true });
  });

  it("ends one at fifteen seconds when the caller asks for nothing", async () => {
    await createClientWithAgent();
    const { fetch: fetcher } = s.ssr[0]!.global as { fetch: typeof fetch };
    expect(await deadlineOf(fetcher)).toEqual({ ms: 15_000, signalled: true });
  });
});

describe("createAdminClient", () => {
  it("is unchanged when no deadline is asked for", () => {
    createAdminClient();
    expect(s.js[0]!.global).toBeUndefined();
  });

  it("ends a stalled call at the asked deadline", async () => {
    createAdminClient({ deadlineMs: 3_000 });
    const { fetch: fetcher } = s.js[0]!.global as { fetch: typeof fetch };
    expect(await deadlineOf(fetcher)).toEqual({ ms: 3_000, signalled: true });
  });
});
