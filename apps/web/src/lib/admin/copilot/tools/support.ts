import { z } from "zod";
import { getSupportQueue, getSupportTicketDetail } from "@/lib/admin/support-queue";
import { UUID_RE, capList, clampLimit, clip, oldestFirst, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/** The support desk (`/admin/support`), through the desk's own queue and ticket reads. */

export const getSupportOverview = defineTool({
  name: "get_support_queue",
  description:
    "Support desk: open tickets by lane (new, waiting on us, waiting on the member, escalated), how many are past their promised time, and the oldest tickets waiting on the team with ids, topic, a short preview and the link.",
  kind: "read",
  scopes: ["support"],
  status: "Reading the support queue",
  input: z.object({ lane: z.enum(["new", "waiting_on_us", "waiting_on_member", "escalated", "late"]).optional(), limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support"]);
    if (!gate.ok) return refused();
    const read = await getSupportQueue({ now: ctx.now });
    if (read.state === "forbidden") return refused();
    if (read.state !== "ok") return unreadable("The support queue");
    const open = read.data.rows.filter((r) => r.lane !== "done");
    const onUs = open.filter((r) => r.lane !== "waiting_on_member");
    const count = (lane: string) => open.filter((r) => r.lane === lane).length;
    const pool = input.lane === "late" ? onUs.filter((r) => r.sla.breached) : input.lane ? open.filter((r) => r.lane === input.lane) : onUs;
    const rows = oldestFirst(pool, (r) => r.createdAt).map((r) => ({
      id: r.id,
      reference: r.reference,
      topic: r.topic,
      lane: r.lane,
      pastPromisedTime: r.sla.breached,
      promise: r.sla.promise,
      preview: clip(r.preview, 140),
      filedHoursAgo: waitingHours(r.createdAt, ctx.now),
      heldBy: r.claim ? (r.claim.mine ? "you" : r.claim.name) : null,
      link: `/admin/support?ticket=${r.id}`,
    }));
    return {
      ok: true,
      data: {
        openTotal: open.length,
        waitingOnTheTeam: onUs.length,
        pastPromisedTime: onUs.filter((r) => r.sla.breached).length,
        byLane: { new: count("new"), waiting_on_us: count("waiting_on_us"), waiting_on_member: count("waiting_on_member"), escalated: count("escalated") },
        oldestFirst: capList(rows, clampLimit(input.limit), rows.length),
        page: "/admin/support",
      },
    };
  },
});

export const getSupportTicket = defineTool({
  name: "get_support_ticket",
  description:
    "One support ticket by id: topic, lane, promised time, the conversation so far (latest messages, each shortened), escalations and what is related. Use it before drafting a reply. It does not return the member's email address.",
  kind: "read",
  scopes: ["support"],
  status: "Reading the ticket",
  input: z.object({ id: z.string().regex(UUID_RE) }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support"]);
    if (!gate.ok) return refused();
    const read = await getSupportTicketDetail(input.id, ctx.now);
    if (read.state === "forbidden") return refused();
    if (read.state !== "ok") return unreadable("That ticket");
    const t = read.data;
    if (!t) return { ok: false, error: "No ticket with that id was found." };
    return {
      ok: true,
      data: {
        id: t.row.id,
        reference: t.row.reference,
        memberName: t.row.name,
        topic: t.row.topic,
        lane: t.row.lane,
        status: t.row.status,
        promise: t.row.sla.promise,
        pastPromisedTime: t.row.sla.breached,
        hasAccount: t.row.hasAccount,
        related: t.related ? { kind: t.related.kind, label: t.related.label } : null,
        filedHoursAgo: waitingHours(t.row.createdAt, ctx.now),
        thread: t.thread.slice(-8).map((m) => ({ from: m.role === "admin" ? "staff" : "member", at: m.at, text: clip(m.body, 600) })),
        messagesInThread: t.thread.length,
        openEscalations: (t.escalations ?? []).filter((e) => !e.returnedAt).map((e) => ({ to: e.toScope, reason: clip(e.reason, 160) })),
        link: `/admin/support?ticket=${t.row.id}`,
      },
    };
  },
});

export const SUPPORT_TOOLS = [getSupportOverview, getSupportTicket];
