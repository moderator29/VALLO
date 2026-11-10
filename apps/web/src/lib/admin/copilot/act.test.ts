import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/business-development/actions", () => ({ addProspect: vi.fn(), logActivity: vi.fn() }));
vi.mock("@/lib/admin/my-desk/actions", () => ({ addTaskComment: vi.fn(), createTask: vi.fn(), postAnnouncement: vi.fn() }));
vi.mock("@/lib/admin/overview/actions", () => ({ raiseEscalation: vi.fn(), recommendStaffAccess: vi.fn() }));
vi.mock("@/lib/admin/social-media/actions", () => ({ createDraft: vi.fn() }));

import { confirmProposal, resetUsedProposals } from "./act";
import { openProposal, proposalKey, sealProposal } from "./proposals";
import { finalizeProposal } from "./tools/registry";
import type { CopilotViewer, ProposalAction } from "./tools/types";

const viewer: CopilotViewer = { userId: "u1", firstName: "Ada", isAdmin: false, isSuperAdmin: false, scopes: ["support"], position: "support_agent" };
const NOW = Date.parse("2026-11-10T09:00:00Z");
const key = Buffer.from("k".repeat(32));
const action: ProposalAction = { kind: "create_my_task", input: { title: "Follow up", detail: "", dueDate: "", priority: "normal", relatedDesk: "", relatedLink: "" } };
const seal = (over: Partial<Parameters<typeof sealProposal>[1]> = {}, now = NOW) =>
  sealProposal(key, { u: "u1", t: "create_my_task", a: action, label: "Add a task", summary: "Adds Follow up", ...over }, now).token;

const execute = vi.fn(async () => ({ ok: true as const, message: "Task added to your list." }));
const audit = vi.fn(async () => true);
const used = new Set<string>();
const claim = async (n: string) => (used.has(n) ? false : (used.add(n), true));
const run = (token: unknown, v: CopilotViewer = viewer, now = NOW + 60_000) => confirmProposal({ token, viewer: v, now }, { key, claim, execute, audit });

beforeEach(() => {
  execute.mockClear();
  audit.mockClear();
  used.clear();
  resetUsedProposals();
});

describe("propose, confirm, act", () => {
  it("runs the desk action once, audits it as made through the copilot, and returns a banner-able outcome", async () => {
    const out = await run(seal());
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ ok: true, message: "Task added to your list.", href: "/admin/my-desk/tasks" });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "u1", tool: "create_my_task", kind: "create_my_task", ok: true }));
  });

  it("refuses a replay", async () => {
    const token = seal();
    expect((await run(token)).status).toBe(200);
    const again = await run(token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("used");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("refuses an expired proposal after fifteen minutes", async () => {
    const out = await run(seal(), viewer, NOW + 16 * 60_000);
    expect(out.status).toBe(410);
    expect(out.body.code).toBe("expired");
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses another staff member's token", async () => {
    const out = await run(seal(), { ...viewer, userId: "u2" });
    expect(out.status).toBe(403);
    expect(out.body.code).toBe("wrong_user");
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a token whose arguments were changed", async () => {
    const token = seal();
    const [body, mac] = token.split(".");
    const parsed = JSON.parse(Buffer.from(body!, "base64url").toString()) as { a: { input: { title: string } } };
    parsed.a.input.title = "Something else";
    const forged = `${Buffer.from(JSON.stringify(parsed)).toString("base64url")}.${mac}`;
    const out = await run(forged);
    expect(out.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
    expect((await run("garbage")).status).toBe(400);
    expect((await run(undefined)).status).toBe(400);
  });

  it("refuses a validly signed proposal whose arguments fail the closed schema or whose action is not on the list", async () => {
    const bad = seal({ a: { kind: "create_my_task", input: { ...action.input, title: "" } } as ProposalAction });
    expect((await run(bad)).status).toBe(400);
    const rogue = seal({ a: { kind: "issue_refund", input: {} } as unknown as ProposalAction });
    expect((await run(rogue)).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses when the person no longer holds the tool's access", async () => {
    const token = seal({ t: "add_bd_prospect", a: { kind: "add_bd_prospect", input: { contactName: "A", businessName: "B", category: "agent", email: "a@b.co", phone: "", location: "", notes: "", nextFollowUpAt: "" } } });
    const out = await run(token);
    expect(out.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it("reports a refused desk action honestly and still audits it", async () => {
    execute.mockResolvedValueOnce({ ok: false as never, message: "Your access does not allow this." } as never);
    const out = await run(seal());
    expect(out.body).toMatchObject({ ok: false, code: "failed", message: "Your access does not allow this." });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("finalizeProposal signs an action and leaves a draft unsigned", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "s".repeat(40);
    const ctx = { viewer, now: NOW };
    const card = { label: "l", summary: "s", args: {}, mode: "act" as const, deskHref: "/admin/my-desk/tasks", action };
    const signed = finalizeProposal("create_my_task", card, ctx)!;
    expect(signed.token).toBeTruthy();
    expect(Date.parse(signed.expiresAt) - NOW).toBe(15 * 60_000);
    expect(openProposal(proposalKey()!, signed.token, "u1", NOW).ok).toBe(true);
    const draft = finalizeProposal("draft_ticket_reply", { ...card, mode: "draft", action: null }, ctx)!;
    expect(draft.token).toBeUndefined();
  });
});
