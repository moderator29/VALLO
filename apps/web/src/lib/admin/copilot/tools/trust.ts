import { z } from "zod";
import {
  readAdminCommunities,
  readAdminVerifications,
  readAppeals,
  readCase,
  readCases,
  readRoommateSignals,
  readTrustOverview,
  type DeskRead,
} from "@/lib/admin/cases/queries";
import { CASE_MODULES, CASE_SEVERITIES, CASE_STATUSES, type CaseFilters } from "@/lib/admin/cases/model";
import { UUID_RE, capList, clampLimit, clip, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool, type ToolResult } from "./types";

/**
 * Trust and Safety: the case desk, appeals, the trust overview, Roommates and
 * Circle. Every read is the case engine's own database function, which checks
 * the viewer itself; the scopes here only choose who is offered the tool.
 */

const CASE_SCOPES = ["trust_safety", "moderation", "roommates", "circle"] as const;

function deskWords(state: Exclude<DeskRead<unknown>["state"], "ok">, what: string): ToolResult {
  if (state === "not-open") return { ok: false, error: `${what} is not set up on this server yet. Say so; do not guess.` };
  if (state === "forbidden") return refused();
  return unreadable(what);
}

export const listCases = defineTool({
  name: "list_cases",
  description:
    "Trust and Safety cases the viewer may see, newest activity first, with filters for status, module, severity, assigned (any, me, none) and overdue. Returns case numbers, severity, status, who it is about, due time and the link. Use it for 'what cases are overdue' or 'what is critical'.",
  kind: "read",
  scopes: CASE_SCOPES,
  status: "Reading the cases",
  input: z.object({
    status: z.enum(["open", "all", ...CASE_STATUSES]).optional(),
    module: z.enum(CASE_MODULES).optional(),
    severity: z.enum(CASE_SEVERITIES).optional(),
    assigned: z.enum(["any", "me", "none"]).optional(),
    overdue: z.boolean().optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, CASE_SCOPES);
    if (!gate.ok) return refused();
    const status = input.status ?? "open";
    const filters: CaseFilters = {
      status: status === "all" ? null : status,
      module: input.module ?? null,
      severity: input.severity ?? null,
      assigned: input.assigned ?? "any",
      overdue: input.overdue === true,
      q: "",
      offset: 0,
    };
    const read = await readCases(filters);
    if (read.state !== "ok") return deskWords(read.state, "The case list");
    const rows = read.data.items.map((c) => ({
      id: c.id,
      number: c.number,
      module: c.module,
      category: c.category,
      severity: c.severity,
      status: c.status,
      about: c.subject?.name ?? null,
      assignedTo: c.assignee?.name ?? null,
      reports: c.reportCount,
      overdue: c.overdue,
      dueAt: c.dueAt,
      openedHoursAgo: waitingHours(c.createdAt, ctx.now),
      summary: clip(c.summary, 160),
      link: `/admin/cases/${c.id}`,
    }));
    return { ok: true, data: { matching: read.data.total, cases: capList(rows, clampLimit(input.limit), read.data.total), page: "/admin/cases" } };
  },
});

export const getCaseTimeline = defineTool({
  name: "get_case",
  description:
    "One Trust and Safety case by id: status, severity, due time, the reports, the timeline of events and notes, and what the member's history shows. Facts only; the decision stays with the human on the case page.",
  kind: "read",
  scopes: CASE_SCOPES,
  status: "Reading the case",
  input: z.object({ id: z.string().regex(UUID_RE) }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, CASE_SCOPES);
    if (!gate.ok) return refused();
    const read = await readCase(input.id);
    if (read.state !== "ok") return deskWords(read.state, "That case");
    const c = read.data;
    if (!c) return { ok: false, error: "No case with that id is visible to this person." };
    return {
      ok: true,
      data: {
        id: c.id,
        number: c.number,
        module: c.module,
        category: c.category,
        severity: c.severity,
        status: c.status,
        about: c.subject?.name ?? null,
        assignedTo: c.assignee?.name ?? null,
        overdue: c.overdue,
        dueAt: c.dueAt,
        escalationReason: clip(c.escalationReason, 300),
        resolution: c.resolution,
        resolutionNote: clip(c.resolutionNote, 300),
        reports: c.reports.slice(0, 10).map((r) => ({ category: r.category, reason: clip(r.reason, 200), status: r.status, at: r.createdAt })),
        timeline: c.events.slice(-15).map((e) => ({ kind: e.kind, note: clip(e.body, 300), by: e.actor?.name ?? null, at: e.createdAt })),
        memberHistory: c.subjectHistory
          ? { casesBefore: c.subjectHistory.cases, upheld: c.subjectHistory.upheld, activeRestrictions: c.subjectHistory.restrictions.filter((r) => r.active).length, memberSince: c.subjectHistory.memberSince }
          : null,
        link: `/admin/cases/${c.id}`,
      },
    };
  },
});

export const getAppeals = defineTool({
  name: "get_appeals",
  description: "Appeals against restrictions: how many are open, and the oldest ones with the restriction kind and how long they have waited. A decision is for the human on the appeals desk.",
  kind: "read",
  scopes: ["trust_safety"],
  status: "Reading the appeals",
  input: z.object({ status: z.enum(["open", "upheld", "overturned", "withdrawn"]).optional(), limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["trust_safety"]);
    if (!gate.ok) return refused();
    const read = await readAppeals(input.status ?? "open");
    if (read.state !== "ok") return deskWords(read.state, "The appeals list");
    const rows = [...(read.data ?? [])]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a) => ({
        id: a.id,
        status: a.status,
        member: a.member.name,
        restriction: a.restriction?.kind ?? null,
        caseNumber: a.caseNumber,
        waitingHours: waitingHours(a.createdAt, ctx.now),
        link: "/admin/appeals",
      }));
    return { ok: true, data: { appeals: capList(rows, clampLimit(input.limit, 6)), page: "/admin/appeals" } };
  },
});

export const getTrustOverview = defineTool({
  name: "get_trust_overview",
  description:
    "Trust overview for a period (default 30 days): cases open, new, escalated, overdue, unassigned, critical, opened and resolved, median hours to resolve, restrictions and appeals, plus Roommates and Circle headline counts.",
  kind: "read",
  scopes: ["analyst", "trust_safety"],
  status: "Reading the trust overview",
  input: z.object({ days: z.number().int().min(1).max(365).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["analyst", "trust_safety"]);
    if (!gate.ok) return refused();
    const read = await readTrustOverview(input.days ?? 30);
    if (read.state !== "ok") return deskWords(read.state, "The trust overview");
    const { cases, restrictions, roommates, circle, since } = read.data;
    return {
      ok: true,
      data: {
        since,
        cases: { ...cases, daily: undefined },
        restrictions,
        roommates: { profiles: roommates.profiles, listings: roommates.listings, groups: roommates.groups, verificationsWaiting: roommates.verificationsWaiting },
        circle,
        page: "/admin/trust",
      },
    };
  },
});

export const getRoommatesDesk = defineTool({
  name: "get_roommates_desk",
  description: "Roommates moderation: the verifications waiting (count and oldest ages) and the abuse signals the desk shows (counts of heavy senders, repeat listers, duplicate titles, often-reported people).",
  kind: "read",
  scopes: ["roommates", "trust_safety"],
  status: "Reading the Roommates desk",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["roommates", "trust_safety"]);
    if (!gate.ok) return refused();
    const [verifications, signals] = await Promise.all([readAdminVerifications("pending"), readRoommateSignals()]);
    const sig = signals.state === "ok" ? signals.data : null;
    const waiting = verifications.state === "ok" ? verifications.data : null;
    if (!sig && !waiting) return unreadable("The Roommates desk");
    return {
      ok: true,
      data: {
        verificationsWaiting: waiting ? waiting.length : null,
        signals: sig
          ? { heavySenders: sig.heavySenders.length, repeatListers: sig.repeatListers.length, duplicateTitles: sig.duplicateTitles.length, reportedOften: sig.reportedOften.length }
          : null,
        page: "/admin/roommates",
      },
    };
  },
});

export const getCircleDesk = defineTool({
  name: "get_circle_desk",
  description: "Circle moderation: communities by status, how many have held posts or open cases, with the top few that need attention.",
  kind: "read",
  scopes: ["circle", "trust_safety"],
  status: "Reading the Circle desk",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["circle", "trust_safety"]);
    if (!gate.ok) return refused();
    const read = await readAdminCommunities({});
    if (read.state !== "ok") return deskWords(read.state, "The Circle desk");
    const needs = read.data.filter((c) => c.held > 0 || c.openCases > 0).sort((a, b) => b.openCases + b.held - (a.openCases + a.held));
    return {
      ok: true,
      data: {
        communities: read.data.length,
        live: read.data.filter((c) => c.status === "live").length,
        paused: read.data.filter((c) => c.status === "paused").length,
        needingAttention: capList(
          needs.map((c) => ({ name: c.name, status: c.status, heldPosts: c.held, openCases: c.openCases, members: c.members, link: "/admin/circle" })),
          clampLimit(input.limit, 6),
          needs.length,
        ),
        page: "/admin/circle",
      },
    };
  },
});

export const TRUST_TOOLS = [listCases, getCaseTimeline, getAppeals, getTrustOverview, getRoommatesDesk, getCircleDesk];
