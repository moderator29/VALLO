import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE SUPPORT SCOPE OPENS SUPPORT AND NOTHING ELSE.
 *
 * Run through the REAL door (`requireAdmin` in ./guard) with only the session
 * and the database faked:
 *
 *  - a support agent is refused by the money, KYC and compliance actions and
 *    the money export, before any of them reads or writes anything;
 *  - a staff member without the support scope, a signed-in member, a
 *    signed-out visitor, and a support agent whose session has not proved
 *    the console's door are all refused by every support action and read,
 *    before any database call beyond reading their own access;
 *  - the support desk's reads name no private column, and the pending
 *    member-context function returns only the fields support needs.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

type Who = "signed-out" | "member" | "support" | "support-unproved" | "moderation" | "admin";
let who: Who = "support";
const rpcCalls: string[] = [];
const serviceCalls: string[] = [];

function staffAccess(): Record<string, unknown> | null {
  const base = { is_admin: false, is_super_admin: false, handbook_version: "v", handbook_acknowledged: true, console_verified: true };
  switch (who) {
    case "member":
      return { ...base, scopes: [] };
    case "support":
      return { ...base, scopes: ["support"], position: "support_agent" };
    case "support-unproved":
      return { ...base, scopes: ["support"], console_verified: false };
    case "moderation":
      return { ...base, scopes: ["moderation"], position: "moderator" };
    case "admin":
      return { ...base, is_admin: true, scopes: [] };
    default:
      return null;
  }
}

/** A query builder that records the table and answers "nothing" to anything. */
function recorder(log: string[]) {
  const chain: Record<string, unknown> = {};
  const answer = Promise.resolve({ data: null, error: { code: "TEST", message: "not in this test" }, count: 0 });
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === "then") return answer.then.bind(answer);
      return () => new Proxy(chain, handler);
    },
  };
  return {
    from: (table: string) => {
      log.push(`from:${table}`);
      return new Proxy(chain, handler);
    },
    rpc: async (fn: string) => {
      log.push(`rpc:${fn}`);
      return { data: null, error: { code: "TEST" } };
    },
    auth: { admin: { getUserById: async () => ({ data: null }) } },
  };
}

vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => {
    if (who === "signed-out") return { state: "signed-out" };
    return {
      state: "signed-in",
      user: { id: "00000000-0000-4000-8000-00000000000a", email: "someone@example.com" },
      supabase: {
        from: (table: string) => ({
          select: () => ({
            eq: async () => ({
              data: table === "user_roles" && who === "admin" ? [{ role: "admin" }] : [],
              error: null,
            }),
          }),
        }),
        rpc: async (fn: string) => {
          if (fn === "my_staff_access") return { data: staffAccess(), error: null };
          rpcCalls.push(fn);
          return { data: { status: "ok" }, error: null };
        },
      },
    };
  },
}));

vi.mock("../supabase/admin", () => ({ createAdminClient: () => recorder(serviceCalls) }));

const TICKET = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  who = "support";
  rpcCalls.length = 0;
  serviceCalls.length = 0;
});

describe("a support agent cannot reach another desk", () => {
  it("is refused every other scope at the door", async () => {
    const { requireAdmin } = await import("./guard");
    expect((await requireAdmin("support")).state).toBe("admin");
    for (const scope of ["finance", "kyc_review", "compliance", "moderation", "listing_approval", "agreements", "guarantee", "operations"] as const) {
      expect((await requireAdmin(scope)).state, scope).toBe("not-admin");
    }
    expect((await requireAdmin()).state).toBe("not-admin");
  });

  it("cannot decide a KYC document, and nothing is read or written", async () => {
    const { reviewKycDocument } = await import("./kyc-actions");
    const r = await reviewKycDocument({ documentId: TICKET, approve: true });
    expect(r.ok).toBe(false);
    expect(rpcCalls).toEqual([]);
    expect(serviceCalls).toEqual([]);
  });

  it("cannot change a fee rate", async () => {
    const { setFeeRate } = await import("./money-actions");
    const r = await setFeeRate({ kind: "commission", basisPoints: 0, flatMinor: 0, effectiveFrom: "2026-10-01", note: "a probe note" });
    expect(r.ok).toBe(false);
    expect(rpcCalls).toEqual([]);
    expect(serviceCalls).toEqual([]);
  });

  it("cannot open a suspicious transaction case", async () => {
    const { openStrCase } = await import("./str-actions");
    const r = await openStrCase({ sourceKind: "manual", sourceId: "x", grounds: "a probe that must never reach the database" });
    expect(r.ok).toBe(false);
    expect(rpcCalls).toEqual([]);
  });

  it("cannot export the money history", async () => {
    const { GET } = await import("@/app/admin/money/export/route");
    const res = await GET({ nextUrl: new URL("https://example.com/admin/money/export") } as never);
    expect(res.status).toBe(403);
    expect(serviceCalls).toEqual([]);
  });
});

describe("only support reaches the support desk", () => {
  const refusedEveryWay = async () => {
    const actions = await import("./support-workbench-actions");
    const claim = await import("./support-desk-actions");
    const reads = await import("./support-queue");
    const results = [
      await actions.sendSupportReply({ ticketId: TICKET, body: "Hello there" }),
      await actions.escalateSupportTicket({ ticketId: TICKET, scope: "finance", reason: "a probe reason" }),
      await actions.returnSupportEscalation({ ticketId: TICKET, escalationId: TICKET, note: "a probe note" }),
      await claim.takeTicket({ ticketId: TICKET }),
      await claim.releaseTicket({ ticketId: TICKET }),
    ];
    for (const r of results) expect(r.ok).toBe(false);
    expect((await reads.getSupportQueue()).state).toBe("forbidden");
    expect((await reads.getSupportTicketDetail(TICKET)).state).toBe("forbidden");
    /* Nothing touched the tickets: no service-role read, and no database
       function but the escalation check the database itself gates. */
    expect(serviceCalls).toEqual([]);
    expect(rpcCalls.filter((fn) => fn !== "support_ticket_escalations_for")).toEqual([]);
    return results;
  };

  it("refuses a moderator", async () => {
    who = "moderation";
    await refusedEveryWay();
  });

  it("refuses a signed-in member who is not staff", async () => {
    who = "member";
    const results = await refusedEveryWay();
    expect(results[0]!.ok === false && results[0]!.error).toMatch(/operations team/);
  });

  it("refuses a signed-out visitor", async () => {
    who = "signed-out";
    const results = await refusedEveryWay();
    expect(results[0]!.ok === false && results[0]!.error).toMatch(/Sign in/);
  });

  it("refuses a support agent whose session has not confirmed it is them at the console door", async () => {
    who = "support-unproved";
    const results = await refusedEveryWay();
    expect(results[0]!.ok === false && results[0]!.error).toMatch(/Confirm it is you/);
  });

  it("lets a support agent through to the database, which decides again", async () => {
    who = "support";
    const { escalateSupportTicket } = await import("./support-workbench-actions");
    const r = await escalateSupportTicket({ ticketId: TICKET, scope: "finance", reason: "Refund not arrived after a week" });
    expect(r.ok).toBe(true);
    expect(rpcCalls).toEqual(["support_escalate_ticket"]);
  });

  it("will not escalate to compliance, even for a support agent", async () => {
    const { escalateSupportTicket } = await import("./support-workbench-actions");
    const r = await escalateSupportTicket({ ticketId: TICKET, scope: "compliance", reason: "trying the compliance desk" });
    expect(r.ok).toBe(false);
    expect(rpcCalls).toEqual([]);
  });
});

describe("what the support desk reads", () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("selects no private column and no document table", () => {
    const queue = src("src/lib/admin/support-queue.ts");
    const selects = [...queue.matchAll(/select\(\s*"([^"]+)"/g), ...queue.matchAll(/TICKET_COLUMNS =\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(selects.length).toBeGreaterThan(3);
    for (const s of selects) {
      expect(s).not.toMatch(/\b(tin|cac_number|address|landmark|phone|latitude|longitude|representative_\w+|registered_name|storage_path)\b/);
      expect(s).not.toBe("*");
    }
    expect(queue).not.toMatch(/from\("(agent_documents|business_documents|businesses|listings|transactions|str_cases|payouts)"\)/);
  });

  it("the member context function returns only the fields support needs", () => {
    const sql = src("../../supabase/migrations/20260929204530_support_desk_escalations_and_member_context.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.support_member_context"), sql.indexOf("revoke all on function public.support_escalate_ticket"));
    const keys = [...fn.matchAll(/'([a-z_]+)',\s/g)].map((m) => m[1]!).filter((k) => !["ok", "forbidden", "not_found", "open", "pending"].includes(k));
    const allowed = new Set([
      "status", "has_account", "first_name", "member_since", "is_lister", "lister_verified", "badge_tier",
      "bookings", "agreements", "tickets_total", "tickets_open", "recent_tickets",
      "id", "reference", "topic", "created_at",
    ]);
    for (const k of keys) expect(allowed.has(k), k).toBe(true);
    expect(fn).not.toMatch(/\b(tin|cac_number|address|phone|email|nin|bvn|date_of_birth|storage_path|amount)\b/);
    expect(fn).toMatch(/private\.staff_can\(me, 'support'\)/);
    expect(sql).toMatch(/set search_path to ''/);
    expect(sql).not.toMatch(/disable row level security|grant (insert|update|delete)[^;]*to (anon|authenticated)/i);
  });

  it("every support action checks the door first", () => {
    const actions = src("src/lib/admin/support-workbench-actions.ts");
    const bodies = actions.split(/export async function /).slice(1);
    expect(bodies.length).toBe(3);
    for (const body of bodies) {
      const first = body.indexOf("{", body.indexOf(")"));
      const opening = body.slice(first, first + 400);
      expect(opening).toMatch(/requireAdmin\("support"\)|ticketDoor\(/);
    }
  });
});
