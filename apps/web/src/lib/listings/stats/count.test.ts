import { describe, expect, it, vi } from "vitest";
import { countListingView, type CountDeps } from "./count";

vi.mock("@/lib/admin/internal-accounts", () => ({ isInternalAccount: async (id: string) => id === "staff-user" }));

const ID = "7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13";
const MEMBER = "11111111-1111-4111-8111-111111111111";
const CHROME = "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const IP = "102.89.34.7";

function beacon(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://www.vallospaces.com/api/listing-view", {
    method: "POST",
    body,
    headers: {
      host: "www.vallospaces.com",
      origin: "https://www.vallospaces.com",
      "sec-fetch-site": "same-origin",
      "user-agent": CHROME,
      "x-forwarded-for": IP,
      ...headers,
    },
  });
}

function deps(over: Partial<CountDeps> & { answers?: { data: unknown; error: unknown }[] } = {}) {
  const calls: [string, Record<string, unknown>][] = [];
  const answers = [...(over.answers ?? [{ data: true, error: null }])];
  const d: CountDeps = {
    viewer: over.viewer ?? (async () => null),
    allow: over.allow ?? (async () => true),
    db:
      over.db ??
      (() => ({
        rpc: async (fn: string, args: object) => {
          calls.push([fn, args as Record<string, unknown>]);
          return answers.shift() ?? { data: null, error: { code: "XX000" } };
        },
      })),
  };
  return { d, calls };
}

const body = JSON.stringify({ id: ID });

describe("counting one beacon", () => {
  it("counts a guest by a 64-hex key and never sends the address", async () => {
    const { d, calls } = deps();
    expect(await countListingView(beacon(body), d)).toBe("counted");
    expect(calls).toHaveLength(1);
    const [fn, args] = calls[0]!;
    expect(fn).toBe("record_listing_view");
    expect(args.p_listing).toBe(ID);
    expect(args.p_viewer).toBeNull();
    expect(String(args.p_guest)).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(IP);
  });

  it("counts a member by id, and reports a repeat the same day", async () => {
    const { d, calls } = deps({ viewer: async () => MEMBER, answers: [{ data: false, error: null }] });
    expect(await countListingView(beacon(body), d)).toBe("repeat");
    expect(calls[0]![1]).toMatchObject({ p_viewer: MEMBER, p_guest: null });
  });

  it("never asks the database about a bot, another site, a declined browser or a bad body", async () => {
    const { d, calls } = deps();
    expect(await countListingView(beacon(body, { "user-agent": "curl/8.4.0" }), d)).toBe("refused:bot");
    expect(await countListingView(beacon(body, { origin: "https://evil.example" }), d)).toBe("refused:foreign");
    expect(await countListingView(beacon(body, { cookie: "vallo_consent=1.10" }), d)).toBe("refused:declined");
    expect(await countListingView(beacon(body, { "sec-gpc": "1" }), d)).toBe("refused:declined");
    expect(await countListingView(beacon('{"id":"x"}'), d)).toBe("dropped");
    expect(calls).toHaveLength(0);
  });

  it("stops at the rate limit and leaves out the QA accounts", async () => {
    const limited = deps({ allow: async () => false });
    expect(await countListingView(beacon(body), limited.d)).toBe("limited");
    expect(limited.calls).toHaveLength(0);
    const qa = deps({ viewer: async () => "957b3bd2-cce3-425d-bba9-5cd876ca3d62" });
    expect(await countListingView(beacon(body), qa.d)).toBe("refused:bot");
    expect(qa.calls).toHaveLength(0);
  });

  it("is a quiet no-op before the SQL for a guest, and still reaches V-73 for a member", async () => {
    const missing = { data: null, error: { code: "PGRST202", message: "Could not find the function public.record_listing_view" } };
    const guest = deps({ answers: [missing] });
    expect(await countListingView(beacon(body), guest.d)).toBe("unavailable");
    expect(guest.calls.map((c) => c[0])).toEqual(["record_listing_view"]);

    const member = deps({ viewer: async () => MEMBER, answers: [missing, { data: null, error: null }] });
    expect(await countListingView(beacon(body), member.d)).toBe("counted");
    expect(member.calls[1]).toEqual(["record_listing_views", { p_viewer: MEMBER, p_seen: [], p_opened: ID }]);

    const staff = deps({ viewer: async () => "staff-user", answers: [missing] });
    expect(await countListingView(beacon(body), staff.d)).toBe("repeat");
    expect(staff.calls).toHaveLength(1);
  });

  it("never throws: no database, a throwing database", async () => {
    expect(await countListingView(beacon(body), deps({ db: () => null }).d)).toBe("unavailable");
    const throwing = deps({
      db: () => ({
        rpc: () => {
          throw new Error("down");
        },
      }),
    });
    expect(await countListingView(beacon(body), throwing.d)).toBe("unavailable");
  });
});
