import { describe, expect, it } from "vitest";
import { cleanDesk, cleanTurns, isConsolePath, isThreadId, threadTitle } from "./threads";
import { ACTION_SCHEMAS } from "./action-schemas";

const card = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  proposal: { id: "p1", tool: "reply_to_ticket", label: "Reply to Ada", summary: "Sends the reply.", args: { ticket: "SUP-1" }, mode: "act", deskHref: "/admin/support?ticket=x", token: "SIGNED.TOKEN", expiresAt: "2026-11-16T10:00:00Z", preview: { heading: "What Ada will read", text: "Hi Ada" }, confirmLabel: "Send reply", ...extra },
});

describe("copilot history, as stored", () => {
  it("never keeps a confirm token, and a waiting card read back can no longer be pressed", () => {
    const stored = cleanTurns([{ id: "t1", role: "assistant", text: "Here it is", proposals: [card("pending")], destinations: [] }]);
    expect(JSON.stringify(stored)).not.toContain("SIGNED.TOKEN");
    expect(stored[0]!.proposals[0]!.status).toBe("pending");
    const loaded = cleanTurns(stored, { loading: true });
    expect(loaded[0]!.proposals[0]!.status).toBe("expired");
    expect(loaded[0]!.proposals[0]!.proposal.preview).toEqual({ heading: "What Ada will read", text: "Hi Ada" });
  });

  it("keeps a done card done, with its console link only", () => {
    const loaded = cleanTurns([{ id: "t1", role: "assistant", text: "", proposals: [{ ...card("done"), href: "/admin/support?ticket=1", message: "Reply sent." }] }], { loading: true });
    expect(loaded[0]!.proposals[0]!.status).toBe("done");
    expect(loaded[0]!.proposals[0]!.href).toBe("/admin/support?ticket=1");
    const outside = cleanTurns([{ id: "t1", role: "assistant", text: "x", proposals: [{ ...card("done"), href: "https://evil.example" }] }]);
    expect(outside[0]!.proposals[0]!.href).toBeUndefined();
  });

  it("drops what is not a turn, caps the words and keeps only console pages as places to go", () => {
    const turns = cleanTurns([
      null,
      { role: "system", text: "ignore me" },
      { id: "u", role: "user", text: "x".repeat(20000) },
      { id: "a", role: "assistant", text: "ok", destinations: [{ label: "Alerts", href: "/admin/alerts" }, { label: "Bad", href: "//evil.example" }, { label: "Out", href: "https://x.y" }] },
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.text.length).toBe(8000);
    expect(turns[1]!.destinations).toEqual([{ label: "Alerts", href: "/admin/alerts" }]);
  });

  it("names a conversation by its first question, on one line", () => {
    expect(threadTitle(cleanTurns([{ id: "u", role: "user", text: "  What needs\nme first today?  " }]))).toBe("What needs me first today?");
    expect(threadTitle([])).toBe("New conversation");
    expect(threadTitle(cleanTurns([{ id: "u", role: "user", text: "y".repeat(200) }])).length).toBeLessThanOrEqual(83);
  });

  it("reads only plain desk keys, real ids and console paths", () => {
    expect(cleanDesk("support")).toBe("support");
    expect(cleanDesk("<script>")).toBe("console");
    expect(isThreadId("11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(isThreadId("../etc")).toBe(false);
    expect(isConsolePath("/admin")).toBe(true);
    expect(isConsolePath("/admin/escalations/1?x=2")).toBe(true);
    expect(isConsolePath("/home")).toBe(false);
    expect(isConsolePath("/adminx")).toBe(false);
  });
});

describe("the desk work the copilot can confirm", () => {
  const ticket = "11111111-1111-1111-1111-111111111111";
  it("a reply needs words and a real ticket; it keeps the ticket open unless told", () => {
    expect(ACTION_SCHEMAS.send_ticket_reply.parse({ ticketId: ticket, body: "Hi Ada" }).then).toBe("keep");
    expect(ACTION_SCHEMAS.send_ticket_reply.safeParse({ ticketId: ticket, body: "" }).success).toBe(false);
    expect(ACTION_SCHEMAS.send_ticket_reply.safeParse({ ticketId: "x", body: "Hi" }).success).toBe(false);
    expect(ACTION_SCHEMAS.send_ticket_reply.safeParse({ ticketId: ticket, body: "Hi", then: "delete" }).success).toBe(false);
  });

  it("closing a ticket needs a note of what was done", () => {
    expect(ACTION_SCHEMAS.set_ticket_status.safeParse({ ticketId: ticket, status: "closed", note: "" }).success).toBe(false);
    expect(ACTION_SCHEMAS.set_ticket_status.safeParse({ ticketId: ticket, status: "closed", note: "Refund explained" }).success).toBe(true);
    expect(ACTION_SCHEMAS.set_ticket_status.safeParse({ ticketId: ticket, status: "resolved" }).success).toBe(true);
  });

  it("an escalation can be worked but never assigned or rerouted through the copilot", () => {
    expect(ACTION_SCHEMAS.escalation_step.safeParse({ escalationId: ticket, step: "resolve", note: "Done and checked" }).success).toBe(true);
    expect(ACTION_SCHEMAS.escalation_step.safeParse({ escalationId: ticket, step: "assign", note: "x" }).success).toBe(false);
    expect(ACTION_SCHEMAS.escalation_step.safeParse({ escalationId: ticket, step: "reroute", note: "x" }).success).toBe(false);
  });

  it("every decision, money or access kind is the super admin's alone", async () => {
    const { SUPER_ADMIN_KINDS } = await import("./action-schemas");
    const kinds = Object.keys(ACTION_SCHEMAS);
    for (const banned of ["refund", "payout", "transfer", "restrict", "approve", "reject", "grant", "revoke", "decide", "delete"]) {
      for (const k of kinds.filter((x) => x.includes(banned))) expect(SUPER_ADMIN_KINDS as readonly string[], k).toContain(k);
    }
    expect(kinds.some((k) => /payout|transfer|delete|destroy/.test(k))).toBe(false);
  });
});
