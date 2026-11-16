import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE COPILOT'S ESCALATIONS TOOL. Pinned: every member of staff the console
 * admits is offered it, whatever their desk; it re-checks the door and the
 * person; it reads only through the desk's own reads; it hands back counts,
 * plain lines and links, never the "what happened" text; before the SQL has
 * run it says so instead of guessing; and the how-to facts match the form's
 * own tables.
 */
const requireConsole = vi.fn();
const listEscalations = vi.fn();
vi.mock("@/lib/admin/guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/guard")>()),
  requireConsole: (...args: unknown[]) => requireConsole(...args),
}));
vi.mock("@/lib/admin/escalations/read", () => ({ listEscalations: (...args: unknown[]) => listEscalations(...args) }));

import { STAFF_SCOPES } from "@/lib/admin/guard";
import { ROUTING } from "@/lib/admin/escalations/types";
import type { EscalationRow } from "@/lib/admin/escalations/types";
import { ESCALATION_TOOLS, HOW_TO_ESCALATE, getEscalations } from "./escalations";
import { COPILOT_TOOLS, FORBIDDEN_TOOL_NAME, isOfferable, runCopilotTool, toolsForViewer } from "./registry";
import type { CopilotViewer } from "./types";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const viewer = (over: Partial<CopilotViewer> = {}): CopilotViewer => ({ userId: "u1", firstName: "Ada", isAdmin: false, isSuperAdmin: false, scopes: ["support"], position: "support_agent", ...over });
const ctx = (v: CopilotViewer = viewer()) => ({ viewer: v, now: NOW });

const row = (over: Partial<EscalationRow> = {}): EscalationRow => ({
  id: "10000000-0000-4000-8000-000000000001",
  reference: "ESC-000041",
  title: "The same selfie on two accounts",
  category: "identity_fraud",
  severity: "high",
  status: "open",
  routedTo: "trust_safety",
  level: 0,
  sourceDesk: "/admin/kyc",
  raisedByName: "Kemi",
  raisedByMe: false,
  assignedToName: null,
  assignedToMe: false,
  dueAt: "2026-11-15T09:00:00Z",
  createdAt: "2026-11-15T05:00:00Z",
  updatedAt: "2026-11-15T05:00:00Z",
  acknowledgedAt: null,
  resolvedAt: null,
  waitingOnMe: true,
  ...over,
});

const ok = (rows: EscalationRow[]) => ({ state: "ok", data: { view: "for_me", rows, canSeeAll: false } });

beforeEach(() => {
  requireConsole.mockReset();
  listEscalations.mockReset();
  requireConsole.mockResolvedValue({ state: "console", user: { id: "u1" }, supabase: {}, staff: {} });
  listEscalations.mockImplementation(async (view: string) =>
    view === "for_me"
      ? ok([row(), row({ id: "10000000-0000-4000-8000-000000000002", reference: "ESC-000044", title: "A payout sent twice", category: "money", severity: "urgent", dueAt: "2026-11-15T12:40:00Z" })])
      : ok([row({ id: "10000000-0000-4000-8000-000000000003", reference: "ESC-000031", title: "A page will not load", category: "technical", raisedByMe: true, raisedByName: null, status: "resolved", resolvedAt: "2026-11-14T10:00:00Z", waitingOnMe: false })]),
  );
});

describe("who is offered it", () => {
  it("is registered once, reads only, and its name trips no forbidden word", () => {
    expect(COPILOT_TOOLS.filter((t) => t.name === "get_escalations")).toHaveLength(1);
    expect(ESCALATION_TOOLS.map((t) => t.kind)).toEqual(["read"]);
    expect(FORBIDDEN_TOOL_NAME.test("get_escalations")).toBe(false);
    expect(getEscalations.description).not.toContain(String.fromCharCode(0x2014));
  });

  it("is offered to every staff member, whatever their desk, and to admins", () => {
    for (const scope of STAFF_SCOPES) expect(isOfferable(getEscalations, viewer({ scopes: [scope], position: null })), scope).toBe(true);
    expect(toolsForViewer(viewer({ isAdmin: true, scopes: STAFF_SCOPES, position: null })).map((t) => t.name)).toContain("get_escalations");
    expect(toolsForViewer(viewer({ scopes: ["social_media"], position: "social_media_manager" })).map((t) => t.name)).toContain("get_escalations");
  });

  it("is not offered to somebody with no access area at all", () => {
    expect(isOfferable(getEscalations, viewer({ scopes: [], position: null }))).toBe(false);
  });
});

describe("the access re-check", () => {
  it("refuses when the console door no longer admits the viewer, and reads nothing", async () => {
    requireConsole.mockResolvedValue({ state: "not-admin" });
    expect((await getEscalations.handler({}, ctx())).ok).toBe(false);
    expect(listEscalations).not.toHaveBeenCalled();
  });

  it("refuses when the door admits somebody else", async () => {
    requireConsole.mockResolvedValue({ state: "console", user: { id: "someone-else" }, supabase: {}, staff: {} });
    expect((await getEscalations.handler({}, ctx())).ok).toBe(false);
    expect(listEscalations).not.toHaveBeenCalled();
  });
});

describe("what it hands back", () => {
  it("counts what waits on the viewer and what is overdue, each as one plain line with its link", async () => {
    const result = await getEscalations.handler({}, ctx());
    if (!result.ok) throw new Error(result.error);
    const data = result.data as { waitingOnYou: { total: number; overdue: number; items: Record<string, unknown>[] }; raisedByYou: { open: number; closed: number; items: Record<string, unknown>[] }; page: string };
    expect(listEscalations.mock.calls.map((c) => c[0]).sort()).toEqual(["for_me", "mine"]);
    expect(data.waitingOnYou).toMatchObject({ total: 2, overdue: 1 });
    expect(data.waitingOnYou.items[0]).toEqual({
      /* The id, so escalation_step can act on it (16 November 2026). */
      id: "10000000-0000-4000-8000-000000000001",
      reference: "ESC-000041",
      title: "The same selfie on two accounts",
      kind: "Identity or fraud",
      urgency: "High",
      status: "Not seen yet",
      clock: "overdue by 3 hours",
      overdue: true,
      waited: "waiting 7 hours",
      raisedBy: "Kemi",
      raisedFrom: "the Verification desk",
      link: "/admin/escalations/10000000-0000-4000-8000-000000000001",
    });
    expect(data.raisedByYou).toMatchObject({ open: 0, closed: 1 });
    expect(data.raisedByYou.items[0]).toMatchObject({ raisedBy: "you", status: "Resolved", clock: "resolved" });
    expect(data.page).toBe("/admin/escalations");
  });

  it("never carries the text of what happened, an id of a person, or a raw state", async () => {
    const result = await getEscalations.handler({}, ctx());
    if (!result.ok) throw new Error(result.error);
    const written = JSON.stringify(result.data);
    expect(written).not.toContain("whatHappened");
    expect(written).not.toContain("what_happened");
    expect(written).not.toContain("identity_fraud");
    expect(written).not.toContain("trust_safety");
    expect(written).not.toContain("assigned");
  });

  it("caps a long list and says more exist", async () => {
    listEscalations.mockResolvedValue(ok(Array.from({ length: 30 }, (_, i) => row({ id: `10000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, reference: `ESC-0001${i}` }))));
    const result = await getEscalations.handler({ limit: 3 }, ctx());
    if (!result.ok) throw new Error(result.error);
    const data = result.data as { waitingOnYou: { total: number; shown: number; more: boolean; items: unknown[] } };
    expect(data.waitingOnYou).toMatchObject({ total: 30, shown: 3, more: true });
    expect(data.waitingOnYou.items).toHaveLength(3);
  });

  it("says escalations are not set up, rather than reporting zero, before the SQL has run", async () => {
    listEscalations.mockResolvedValue({ state: "not_set_up" });
    const result = await getEscalations.handler({}, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not set up");
      expect(result.error).toContain("their lead");
    }
  });

  it("says it could not be read when both reads fail, and gives a null part when one does", async () => {
    listEscalations.mockResolvedValue({ state: "unavailable" });
    expect((await getEscalations.handler({}, ctx())).ok).toBe(false);
    listEscalations.mockImplementation(async (view: string) => (view === "for_me" ? ok([row()]) : { state: "unavailable" }));
    const result = await getEscalations.handler({}, ctx());
    if (!result.ok) throw new Error(result.error);
    expect((result.data as { raisedByYou: unknown }).raisedByYou).toBeNull();
    expect((result.data as { waitingOnYou: { total: number } }).waitingOnYou.total).toBe(1);
  });

  it("runs through the registry for a viewer on any desk", async () => {
    const v = viewer({ scopes: ["content"], position: "content_manager" });
    const run = await runCopilotTool("get_escalations", {}, ctx(v), toolsForViewer(v));
    expect(run.ok).toBe(true);
    expect(run.content).toContain("ESC-000041");
  });
});

describe("how to escalate", () => {
  it("states the routing table the form uses, in plain words", () => {
    expect(HOW_TO_ESCALATE.whereEachKindGoes).toHaveLength(Object.keys(ROUTING).length);
    expect(HOW_TO_ESCALATE.whereEachKindGoes).toContainEqual({ kind: "Money", goesTo: "the Finance team" });
    expect(HOW_TO_ESCALATE.whereEachKindGoes).toContainEqual({ kind: "Identity or fraud", goesTo: "Trust and Safety" });
    expect(HOW_TO_ESCALATE.whereEachKindGoes).toContainEqual({ kind: "Staff access", goesTo: "the super admin" });
  });

  it("states the response times, urgent first", () => {
    expect(HOW_TO_ESCALATE.responseTimes).toEqual([
      { urgency: "Urgent", answered: "within 1 hour" },
      { urgency: "High", answered: "within 4 hours" },
      { urgency: "Normal", answered: "within 24 hours" },
      { urgency: "Low", answered: "within 3 days" },
    ]);
  });

  it("names the button, the form, and the two rules that keep a member's details and a suspicion inside the console", () => {
    const text = JSON.stringify(HOW_TO_ESCALATE);
    expect(text).toContain("Press Escalate at the top of any admin page");
    expect(text).toContain("/admin/escalations/new");
    expect(text).toContain("Do not paste ID numbers, bank details or documents");
    expect(text).toContain("never tell the member you suspect them");
  });
});
