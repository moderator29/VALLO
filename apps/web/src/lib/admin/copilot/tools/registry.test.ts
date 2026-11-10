import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const requireAdmin = vi.fn();
vi.mock("@/lib/admin/guard", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/admin/guard")>()), requireAdmin: (...args: unknown[]) => requireAdmin(...args) }));
const getSupportQueue = vi.fn();
vi.mock("@/lib/admin/support-queue", () => ({ getSupportQueue: (...a: unknown[]) => getSupportQueue(...a), getSupportTicketDetail: vi.fn() }));
const getPaymentsDesk = vi.fn();
vi.mock("@/lib/admin/reads/payments", () => ({ getPaymentsDesk: (...a: unknown[]) => getPaymentsDesk(...a) }));

import { STAFF_SCOPES } from "@/lib/admin/guard";
import { capList, clip, scrub } from "./common";
import { COPILOT_TOOLS, FORBIDDEN_TOOL_NAME, runCopilotTool, toolDefinitions, toolsForViewer } from "./registry";
import { getSupportOverview } from "./support";
import { getPaymentsSummary } from "./finance";
import type { CopilotViewer } from "./types";

const viewer = (over: Partial<CopilotViewer> = {}): CopilotViewer => ({ userId: "u1", firstName: "Ada", isAdmin: false, isSuperAdmin: false, scopes: ["support"], position: "support_agent", ...over });
const ctx = (v: CopilotViewer) => ({ viewer: v, now: Date.parse("2026-11-10T09:00:00Z") });
const names = (v: CopilotViewer) => toolsForViewer(v).map((t) => t.name);

beforeEach(() => {
  requireAdmin.mockReset();
  getSupportQueue.mockReset();
  getPaymentsDesk.mockReset();
});

describe("the registry offers only the tools a viewer holds", () => {
  it("gives a support-only viewer the support tools and none of finance", () => {
    const offered = names(viewer());
    expect(offered).toEqual(expect.arrayContaining(["get_support_queue", "get_support_ticket", "draft_ticket_reply", "search_manual", "get_my_tasks", "create_my_task"]));
    for (const finance of ["get_money_overview", "get_chargebacks", "get_payments_summary", "get_compliance_lanes", "get_kyc_queue", "get_coo_desk", "recommend_staff_access", "raise_escalation", "post_announcement"]) {
      expect(offered).not.toContain(finance);
    }
  });

  it("gives a finance viewer finance and not support", () => {
    const offered = names(viewer({ scopes: ["finance"], position: "finance_officer" }));
    expect(offered).toEqual(expect.arrayContaining(["get_money_overview", "get_chargebacks", "get_payments_summary"]));
    expect(offered).not.toContain("get_support_queue");
  });

  it("gives an admin every tool, and a super admin the COO tools", () => {
    const admin = viewer({ isAdmin: true, scopes: STAFF_SCOPES, position: null });
    const offered = names(admin);
    expect(offered).toEqual(expect.arrayContaining(["get_support_queue", "get_money_overview", "get_listing_queue", "raise_escalation", "post_announcement", "recommend_staff_access"]));
    expect(COPILOT_TOOLS.every((t) => offered.includes(t.name))).toBe(true);
  });

  it("keeps COO-only and announcement tools from an ordinary desk lead", () => {
    const lead = viewer({ scopes: ["operations"], position: "operations_manager" });
    expect(names(lead)).not.toContain("recommend_staff_access");
    expect(names(lead)).not.toContain("post_announcement");
    const coo = viewer({ scopes: ["listing_approval", "moderation", "support", "agreements", "operations"], position: "coo" });
    expect(names(coo)).toContain("recommend_staff_access");
    expect(names(coo)).toContain("post_announcement");
    expect(names(coo)).toContain("get_coo_desk");
  });

  it("builds a valid JSON schema for every tool", () => {
    for (const def of toolDefinitions(COPILOT_TOOLS)) {
      expect(def.input_schema.type).toBe("object");
      expect(def.description.length).toBeGreaterThan(20);
    }
  });
});

describe("a tool the viewer was not offered cannot run, even when the model asks", () => {
  it("refuses a finance tool for a support-only viewer without touching the read", async () => {
    const v = viewer();
    const run = await runCopilotTool("get_payments_summary", {}, ctx(v), toolsForViewer(v));
    expect(run.ok).toBe(false);
    expect(run.content).toContain("not available");
    expect(getPaymentsDesk).not.toHaveBeenCalled();
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("refuses an unknown tool name", async () => {
    const v = viewer();
    const run = await runCopilotTool("delete_everything", {}, ctx(v), toolsForViewer(v));
    expect(run.ok).toBe(false);
  });

  it("refuses input that does not match the schema", async () => {
    const v = viewer({ isAdmin: true, scopes: STAFF_SCOPES });
    const run = await runCopilotTool("get_support_ticket", { id: "not-a-uuid" }, ctx(v), toolsForViewer(v));
    expect(run.ok).toBe(false);
    expect(run.content).toContain("does not match its schema");
  });
});

describe("every handler re-checks access with the desk's own guard", () => {
  it("refuses when the guard no longer admits the viewer, and never reads", async () => {
    requireAdmin.mockResolvedValue({ state: "not-admin" });
    const result = await getSupportOverview.handler({}, ctx(viewer()));
    expect(result.ok).toBe(false);
    expect(requireAdmin).toHaveBeenCalledWith("support");
    expect(getSupportQueue).not.toHaveBeenCalled();
  });

  it("refuses when the guard admits somebody else", async () => {
    requireAdmin.mockResolvedValue({ state: "admin", user: { id: "someone-else" }, supabase: {}, userClient: {}, isAdmin: true, isSuperAdmin: false, isStaff: true });
    const result = await getSupportOverview.handler({}, ctx(viewer()));
    expect(result.ok).toBe(false);
    expect(getSupportQueue).not.toHaveBeenCalled();
  });

  it("refuses a finance read for a viewer who does not hold finance, before any guard call", async () => {
    const result = await getPaymentsSummary.handler({}, ctx(viewer()));
    expect(result.ok).toBe(false);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(getPaymentsDesk).not.toHaveBeenCalled();
  });

  it("runs the desk's read once the guard agrees and caps what comes back", async () => {
    requireAdmin.mockResolvedValue({ state: "admin", user: { id: "u1" }, supabase: {}, userClient: {}, isAdmin: true, isSuperAdmin: false, isStaff: true });
    const rows = Array.from({ length: 40 }, (_, i) => ({
      id: `t${i}`,
      reference: `R${i}`,
      topic: "x",
      lane: "waiting_on_us",
      sla: { breached: i % 2 === 0, promise: "4h" },
      preview: "p".repeat(500),
      createdAt: new Date(Date.parse("2026-11-10T00:00:00Z") - i * 3_600_000).toISOString(),
      claim: null,
    }));
    getSupportQueue.mockResolvedValue({ state: "ok", data: { rows, escalationsInstalled: true } });
    const result = await getSupportOverview.handler({ limit: 5 }, ctx(viewer()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { oldestFirst: { total: number; shown: number; more: boolean; items: { id: string; link: string; preview: string }[] }; openTotal: number };
    expect(data.openTotal).toBe(40);
    expect(data.oldestFirst).toMatchObject({ total: 40, shown: 5, more: true });
    expect(data.oldestFirst.items[0]!.id).toBe("t39");
    expect(data.oldestFirst.items[0]!.link).toBe("/admin/support?ticket=t39");
    expect(data.oldestFirst.items[0]!.preview.length).toBeLessThanOrEqual(140);
  });
});

describe("results are capped and redacted", () => {
  it("caps a list with a total and a more-exist flag", () => {
    expect(capList([1, 2, 3, 4], 2)).toEqual({ total: 4, shown: 2, more: true, items: [1, 2] });
    expect(capList([1], 5)).toMatchObject({ more: false });
  });

  it("drops secrets, card data, identity numbers and document paths wherever they sit", () => {
    const cleaned = scrub({
      name: "Ada",
      password: "x",
      nested: { cardNumber: "4242", idNumber: "123", storagePath: "kyc/a.png", signedUrl: "https://x", token: "t", ok: 1, list: [{ accountNumber: "1", fine: true }] },
      accountNumber: "0123456789",
      media: { url: "x" },
    }) as Record<string, unknown>;
    expect(JSON.stringify(cleaned)).not.toMatch(/4242|0123456789|kyc\/a\.png|https:\/\/x|password/);
    expect(cleaned.name).toBe("Ada");
    expect((cleaned.nested as Record<string, unknown>).ok).toBe(1);
  });

  it("cuts long text", () => {
    expect(clip("a ".repeat(400), 50)!.length).toBeLessThanOrEqual(50);
    expect((scrub("z".repeat(5000)) as string).length).toBeLessThan(1600);
  });

  it("passes the redaction net on every tool result before the model sees it", async () => {
    const leaky = z.object({});
    const { defineTool } = await import("./types");
    const tool = defineTool({ name: "get_leaky", description: "d", kind: "read", scopes: ["support"], status: "x", input: leaky, handler: async () => ({ ok: true, data: { title: "ok", password: "hunter2", bvn: "22212345678" } }) });
    const run = await runCopilotTool("get_leaky", {}, ctx(viewer()), [tool]);
    expect(run.content).toContain("title");
    expect(run.content).not.toMatch(/hunter2|22212345678/);
  });
});

describe("no tool exists for a forbidden action", () => {
  it("has no tool whose name moves money, decides, restricts, grants, deletes or messages a member", () => {
    for (const tool of COPILOT_TOOLS) expect(tool.name, tool.name).not.toMatch(FORBIDDEN_TOOL_NAME);
  });

  it("has exactly the propose tools the brief names, and drafts are never executable", () => {
    const proposers = COPILOT_TOOLS.filter((t) => t.kind === "propose").map((t) => t.name).sort();
    /* The ten that can run a desk action once confirmed, two older drafts, and the draft-only tools of the Marketing, Content, Technical and Support Lead desks (10 November 2026): every one of those is a draft, so confirming runs nothing. */
    const staffDeskDrafts = [
      "draft_creative_brief", "draft_marketing_report_reading", "draft_content_outline", "draft_staff_announcement_text", "draft_incident_update", "draft_status_page_text",
      "draft_post_incident_review", "draft_canned_reply", "draft_coaching_note", "draft_policy_note",
    ];
    expect(proposers).toEqual(
      ["add_bd_prospect", "add_task_comment", "create_my_task", "create_social_draft", "draft_case_note", "draft_ticket_reply", "log_bd_activity", "post_announcement", "raise_escalation", "recommend_staff_access", ...staffDeskDrafts].sort(),
    );
  });

  it("would not offer a badly named tool even if one were registered", async () => {
    const { defineTool } = await import("./types");
    const bad = defineTool({ name: "approve_listing", description: "d", kind: "propose", scopes: ["listing_approval"], status: "x", input: z.object({}), handler: async () => ({ ok: true, data: {} }) });
    expect(toolsForViewer(viewer({ isAdmin: true, scopes: STAFF_SCOPES }), [bad])).toEqual([]);
  });
});
