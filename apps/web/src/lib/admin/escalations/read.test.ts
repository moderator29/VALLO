/**
 * THE ESCALATION READS (lib/admin/escalations/read.ts). Pinned: the door is
 * the console's; a missing function reads as "not set up" on every read, and
 * is not reported as a fault; any other error is reported and reads as
 * unavailable; a refusal from the database is a refusal on the screen; and a
 * row the database answers is turned into the shape the screens draw.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  door: null as unknown,
  answer: { data: null as unknown, error: null as unknown },
  throws: false,
  calls: [] as { fn: string; args: unknown }[],
  reported: [] as unknown[],
}));

vi.mock("@/lib/admin/guard", () => ({ requireConsole: async () => state.door }));
vi.mock("@/lib/observability/read-error", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/observability/read-error")>();
  return {
    ...real,
    reportReadFault: async (_kind: string, ...errors: unknown[]) => {
      state.reported.push(...errors.filter((e) => e !== null && e !== undefined && !real.isNotDeployed(e)));
    },
  };
});

const { getEscalation, getEscalationCounts, listEscalations, toEscalationDetail, toEscalationRow } = await import("./read");

const client = {
  rpc: async (fn: string, args: unknown) => {
    state.calls.push({ fn, args });
    if (state.throws) throw new Error("network down");
    return state.answer;
  },
};

const ID = "7e7e7e7e-7e7e-4e7e-8e7e-7e7e7e7e7e7e";
const ROW = {
  id: ID,
  reference: "ESC-000123",
  title: "A payment is stuck",
  category: "money",
  severity: "high",
  status: "open",
  routed_to: "finance",
  level: 0,
  source_desk: "/admin/kyc",
  raised_by_name: "Kemi",
  raised_by_me: false,
  assigned_to_name: null,
  assigned_to_me: false,
  due_at: "2026-11-15T14:00:00Z",
  created_at: "2026-11-15T10:00:00Z",
  updated_at: "2026-11-15T10:00:00Z",
  acknowledged_at: null,
  resolved_at: null,
  waiting_on_me: true,
};

beforeEach(() => {
  state.door = { state: "console", user: { id: "me" }, supabase: client, staff: {} };
  state.answer = { data: { status: "ok", rows: [ROW], can_see_all: false }, error: null };
  state.throws = false;
  state.calls = [];
  state.reported = [];
});

describe("the door", () => {
  it.each(["signed-out", "not-admin", "unconfigured", "step-up"])("answers forbidden to %s and calls nothing", async (door) => {
    state.door = { state: door };
    expect(await listEscalations("for_me")).toEqual({ state: "forbidden" });
    expect(await getEscalation(ID)).toEqual({ state: "forbidden" });
    expect(await getEscalationCounts()).toEqual({ state: "forbidden" });
    expect(state.calls).toEqual([]);
  });
});

describe("before the SQL has run", () => {
  it.each([
    ["PostgREST does not know the function", { code: "PGRST202", message: "Could not find the function public.staff_escalation_list" }],
    ["Postgres does not know the function", { code: "42883", message: "function does not exist" }],
  ])("reads as not set up when %s, on every read, and reports nothing", async (_what, error) => {
    state.answer = { data: null, error };
    expect(await listEscalations("for_me")).toEqual({ state: "not_set_up" });
    expect(await listEscalations("all")).toEqual({ state: "not_set_up" });
    expect(await getEscalation(ID)).toEqual({ state: "not_set_up" });
    expect(await getEscalationCounts()).toEqual({ state: "not_set_up" });
    expect(state.reported).toEqual([]);
  });
});

describe("when a read fails", () => {
  it("reads any other error as unavailable, and reports it", async () => {
    const refused = { code: "42501", message: "permission denied" };
    state.answer = { data: null, error: refused };
    expect(await listEscalations("for_me")).toEqual({ state: "unavailable" });
    expect(state.reported).toEqual([refused]);
  });

  it("reads a thrown call as unavailable, and reports it", async () => {
    state.throws = true;
    expect(await getEscalationCounts()).toEqual({ state: "unavailable" });
    expect(state.reported).toHaveLength(1);
  });

  it("reads an answer that is not an answer as unavailable", async () => {
    state.answer = { data: "nonsense", error: null };
    expect(await listEscalations("mine")).toEqual({ state: "unavailable" });
    state.answer = { data: { status: "invalid_view" }, error: null };
    expect(await listEscalations("mine")).toEqual({ state: "unavailable" });
  });

  it("passes on the database's own refusals", async () => {
    state.answer = { data: { status: "forbidden" }, error: null };
    expect(await listEscalations("all")).toEqual({ state: "forbidden" });
    state.answer = { data: { status: "not_found" }, error: null };
    expect(await getEscalation(ID)).toEqual({ state: "not_found" });
  });
});

describe("the list", () => {
  it("asks for the view it was given and draws the rows", async () => {
    const read = await listEscalations("mine");
    expect(state.calls).toEqual([{ fn: "staff_escalation_list", args: { p_view: "mine" } }]);
    expect(read).toMatchObject({ state: "ok", data: { view: "mine", canSeeAll: false } });
    if (read.state !== "ok") throw new Error("expected rows");
    expect(read.data.rows).toHaveLength(1);
    expect(read.data.rows[0]).toMatchObject({
      id: ID,
      reference: "ESC-000123",
      category: "money",
      severity: "high",
      status: "open",
      routedTo: "finance",
      level: 0,
      sourceDesk: "/admin/kyc",
      raisedByName: "Kemi",
      waitingOnMe: true,
    });
  });

  it("drops a row with no id, reference or clock rather than drawing a broken one", () => {
    expect(toEscalationRow({ ...ROW, id: null })).toBeNull();
    expect(toEscalationRow({ ...ROW, due_at: "" })).toBeNull();
    expect(toEscalationRow("row")).toBeNull();
  });

  it("reads a value it does not know as the calm default, never as a raw string on the screen", () => {
    const row = toEscalationRow({ ...ROW, category: "weather", severity: "soon", status: "lost", level: 9 });
    expect(row).toMatchObject({ category: "other", severity: "normal", status: "open", level: 0 });
  });
});

describe("one record", () => {
  it("never asks the database about something that is not an id", async () => {
    expect(await getEscalation("not-an-id")).toEqual({ state: "not_found" });
    expect(await getEscalation("' or 1=1 --")).toEqual({ state: "not_found" });
    expect(state.calls).toEqual([]);
  });

  it("reads the record, the timeline, who is looking and who it can be given to", async () => {
    state.answer = {
      error: null,
      data: {
        status: "ok",
        escalation: { ...ROW, what_happened: "The payer says the money left.", what_is_needed: "Check the transfer.", record_url: "/admin/kyc?person=abc", record_label: "This page", resolution: null, resolved_by_name: null },
        events: [
          { id: "e1", kind: "raised", body: null, detail: { routed_to: "finance" }, created_at: "2026-11-15T10:00:00Z", system: false, actor_name: "Kemi", actor_me: false },
          { id: "e2", kind: "bumped", body: null, detail: { to_level: 1 }, created_at: "2026-11-15T14:00:00Z", system: true, actor_name: null, actor_me: false },
          { id: "e3", kind: "invented", created_at: "2026-11-15T14:00:00Z" },
        ],
        viewer: { is_raiser: false, is_handler: true, is_lead: false, is_assignee: false },
        assignable: [{ id: "p1", name: "Tolu" }, { name: "no id" }],
      },
    };
    const read = await getEscalation(ID);
    expect(state.calls).toEqual([{ fn: "staff_escalation_get", args: { p_id: ID } }]);
    if (read.state !== "ok") throw new Error("expected a record");
    expect(read.data.record).toMatchObject({ whatHappened: "The payer says the money left.", whatIsNeeded: "Check the transfer.", recordUrl: "/admin/kyc?person=abc" });
    expect(read.data.events.map((e) => e.kind)).toEqual(["raised", "bumped"]);
    expect(read.data.events[1]).toMatchObject({ system: true, actorName: null });
    expect(read.data.viewer).toEqual({ isRaiser: false, isHandler: true, isLead: false, isAssignee: false });
    expect(read.data.assignable).toEqual([{ id: "p1", name: "Tolu" }]);
  });

  it("answers null for an answer with no record in it", () => {
    expect(toEscalationDetail({ status: "ok" })).toBeNull();
    expect(toEscalationDetail(null)).toBeNull();
  });
});

describe("the counts", () => {
  it("reads how many wait on the caller, how many are overdue and which routes have people", async () => {
    state.answer = { data: { status: "ok", waiting: 3, overdue: 1, staffed: ["finance", "coo", 7], can_see_all: true }, error: null };
    expect(await getEscalationCounts()).toEqual({ state: "ok", data: { waiting: 3, overdue: 1, staffed: ["finance", "coo"], canSeeAll: true } });
    expect(state.calls).toEqual([{ fn: "staff_escalation_counts", args: {} }]);
  });

  it("never draws a negative or a broken number", async () => {
    state.answer = { data: { status: "ok", waiting: "x", overdue: -4 }, error: null };
    expect(await getEscalationCounts()).toEqual({ state: "ok", data: { waiting: 0, overdue: 0, staffed: [], canSeeAll: false } });
  });
});
