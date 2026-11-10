import { z } from "zod";

import { readAcquisition, readCampaigns, readReferralPerformance, readResults } from "@/lib/admin/marketing/queries";
import { buildUtmLink, summarise as summariseCampaigns, CAMPAIGN_STATUS_LABEL, CHANNEL_LABEL } from "@/lib/admin/marketing/model";
import { campaignCalendar, currentMonth } from "@/lib/admin/marketing/extras";
import { readContentItems, readFeedModeration } from "@/lib/admin/content/queries";
import { KIND_LABEL as CONTENT_KIND_LABEL, STATUS_LABEL as CONTENT_STATUS_LABEL, contentHealth, isOverdue as contentOverdue } from "@/lib/admin/content/model";
import { countEntries, entriesOf, expiringSoon, kindDef, type Entry } from "@/lib/admin/desk-entries/model";
import { readEntries } from "@/lib/admin/desk-entries/queries";
import { readHealth, readIncidents, readIncidentUpdates } from "@/lib/admin/technical/queries";
import { INCIDENT_STATUS_LABEL, SEVERITY_SHORT, summariseIncidents, trendWords, looksLikeSecret } from "@/lib/admin/technical/model";
import { readPolicyNotes, readQaReviews, readTicketTopics } from "@/lib/admin/support-lead/queries";
import { medianHoursToFinish, qualityByAgent, topTopics, workload, type TeamRow } from "@/lib/admin/support-lead/model";
import { getSupportQueue } from "@/lib/admin/support-queue";
import { readDocFeedback } from "@/app/admin/doc-feedback/read";
import { requireAdmin } from "@/lib/admin/guard";
import { capList, clampLimit, clip, recheck, refused, unreadable } from "./common";
import { defineTool, type ProposalDraft, type ToolResult } from "./types";

/**
 * THE COPILOT'S TOOLS FOR THE FOUR STAFF DESKS (marketing, content,
 * technical, support lead; 10 November 2026). Read tools reuse the desks' own
 * read functions after the desk's own door has been asked again. Propose
 * tools are all DRAFTS: text for the person to read, edit and add on the desk
 * themselves; nothing is saved, sent or posted from here. No tool here shows
 * a budget amount, a key, a secret, a ticket's text or a member's name.
 */

const limitInput = z.object({ limit: z.number().int().min(1).max(25).optional() });
const draftText = z.string().trim().min(1).max(3000);

const NOT_SET_UP = (desk: string): ToolResult => ({ ok: false, error: `The ${desk} desk is not set up on this server yet. Say so; do not guess.` });

const draft = (summary: string, d: ProposalDraft): ToolResult => ({
  ok: true,
  data: { proposed: true, summary, note: "A draft card is now on the person's screen. Nothing has been saved or sent. Tell them to read it, change it and add it on the desk themselves." },
  proposal: d,
});

const entryRow = (e: Entry, link: string) => ({
  kind: kindDef(e.kind)?.label ?? e.kind,
  title: clip(e.title, 120),
  status: e.status,
  due: e.dueOn,
  link,
});

/* ---------------------------------------------------------------- marketing */

const MK = "/admin/marketing";

export const getMarketingDesk = defineTool({
  name: "get_marketing_desk",
  description: "Marketing desk: campaigns by status, those waiting for approval or sent back, those ending within seven days, how many are over budget (a count, never an amount), and results logged this week.",
  kind: "read",
  scopes: ["marketing"],
  status: "Reading the campaigns",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    const db = gate.door.supabase as never;
    const [campaigns, results] = await Promise.all([readCampaigns(db), readResults(db)]);
    if (campaigns.state === "not-open") return NOT_SET_UP("marketing");
    if (campaigns.state !== "ok" || results.state !== "ok") return unreadable("The campaigns");
    const s = summariseCampaigns(campaigns.data, results.data, ctx.now);
    const waiting = campaigns.data.filter((c) => c.approval === "submitted" && c.status !== "cancelled");
    return {
      ok: true,
      data: {
        summary: s,
        waitingForApproval: capList(waiting.map((c) => ({ name: clip(c.name, 100), channel: CHANNEL_LABEL[c.channel], starts: c.startsOn, link: MK })), clampLimit(input.limit, 6), waiting.length),
        live: campaigns.data.filter((c) => c.status === "live").slice(0, 8).map((c) => ({ name: clip(c.name, 100), channel: CHANNEL_LABEL[c.channel], ends: c.endsOn, status: CAMPAIGN_STATUS_LABEL[c.status] })),
        page: MK,
      },
    };
  },
});

export const getCampaignCalendar = defineTool({
  name: "get_campaign_calendar",
  description: "The campaign calendar for a month (YYYY-MM, default this month): which campaigns run in each week.",
  kind: "read",
  scopes: ["marketing"],
  status: "Reading the campaign calendar",
  input: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    const campaigns = await readCampaigns(gate.door.supabase as never);
    if (campaigns.state === "not-open") return NOT_SET_UP("marketing");
    if (campaigns.state !== "ok") return unreadable("The campaigns");
    const month = input.month ?? currentMonth(ctx.now);
    return { ok: true, data: { month, weeks: campaignCalendar(campaigns.data, month).map((w) => ({ week: w.label, campaigns: w.campaigns.map((c) => `${clip(c.name, 80)} (${CHANNEL_LABEL[c.channel]})`) })), page: `${MK}?tab=calendar` } };
  },
});

export const getAcquisitionFigures = defineTool({
  name: "get_acquisition_figures",
  description: "Customer acquisition by week for the last eight weeks: sign-ups, listings created and referrals, as counts. A series that could not be read is null; say it is not available, never zero.",
  kind: "read",
  scopes: ["marketing"],
  status: "Reading acquisition figures",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    const data = await readAcquisition(gate.door.supabase as never, ctx.now);
    return { ok: true, data: { ...data, page: `${MK}?tab=acquisition` } };
  },
});

export const getReferralPerformance = defineTool({
  name: "get_referral_performance",
  description: "Referral and promo performance from the real referral rows: people who signed up with a code per week, how many are pending, earned or taken back, and the referral campaigns' titles and dates. No reward amounts and no names.",
  kind: "read",
  scopes: ["marketing"],
  status: "Reading referral performance",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    const data = await readReferralPerformance(gate.door.supabase as never, ctx.now);
    if (!data) return unreadable("The referral figures");
    return { ok: true, data: { ...data, page: `${MK}?tab=referrals` } };
  },
});

export const getMarketingNotes = defineTool({
  name: "get_marketing_notes",
  description: "The marketing desk's notes: audience segments, market notes, creative briefs, the A/B test log and monthly reports, newest first, with their status.",
  kind: "read",
  scopes: ["marketing"],
  status: "Reading the marketing notes",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    const read = await readEntries(gate.door.supabase as never, "marketing");
    if (read.state === "not-open") return NOT_SET_UP("marketing");
    if (read.state !== "ok") return unreadable("The marketing notes");
    return { ok: true, data: { counts: countEntries(read.data), recent: capList(read.data.filter((e) => e.status !== "retired").map((e) => entryRow(e, MK)), clampLimit(input.limit, 10), read.data.length) } };
  },
});

export const buildTrackedLink = defineTool({
  name: "build_tracked_link",
  description: "Build a tracked (UTM) link from a page address, a source, a medium and a campaign name, with optional content and term. Pure: nothing is saved. Return the link for the person to copy.",
  kind: "read",
  scopes: ["marketing"],
  status: "Building the link",
  input: z.object({ base: z.string().max(300), source: z.string().max(80), medium: z.string().max(80), campaign: z.string().max(120), content: z.string().max(120).optional(), term: z.string().max(120).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    const built = buildUtmLink({ ...input, content: input.content ?? "", term: input.term ?? "" });
    return built.ok ? { ok: true, data: { link: built.url, tags: built.tags } } : { ok: false, error: built.error };
  },
});

export const draftCreativeBrief = defineTool({
  name: "draft_creative_brief",
  description: "Draft a creative brief (the one message, audience, tone, what is needed, the call to action, what must not be said) for the Marketing Manager to read and add on the Briefs tab. Nothing is saved. Never promise that a payment is safe, protected or guaranteed.",
  kind: "propose",
  scopes: ["marketing"],
  status: "Drafting a brief",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    return draft("Draft a creative brief", { label: "Draft creative brief (not saved)", summary: "A draft for you to read, edit and add on the Briefs and tests tab.", args: { text: input.text }, mode: "draft", deskHref: `${MK}?tab=briefs`, action: null });
  },
});

export const draftMarketingReportReading = defineTool({
  name: "draft_marketing_report_reading",
  description: "Draft the 'what worked, what did not, next month' reading for the monthly report, from numbers the person gave you. Do not invent a figure. Nothing is saved.",
  kind: "propose",
  scopes: ["marketing"],
  status: "Drafting the report reading",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["marketing"]);
    if (!gate.ok) return refused();
    return draft("Draft a report reading", { label: "Draft report reading (not saved)", summary: "A draft for you to paste into the monthly report and change.", args: { text: input.text }, mode: "draft", deskHref: `${MK}?tab=report`, action: null });
  },
});

/* ------------------------------------------------------------------ content */

const CT = "/admin/content";

export const getContentDesk = defineTool({
  name: "get_content_desk",
  description: "Content desk: items by status, those past their planned date, in review for over a week, due this week, published this month, and the next items on the calendar.",
  kind: "read",
  scopes: ["content"],
  status: "Reading the content desk",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["content"]);
    if (!gate.ok) return refused();
    const read = await readContentItems(gate.door.supabase as never);
    if (read.state === "not-open") return NOT_SET_UP("content");
    if (read.state !== "ok") return unreadable("The content items");
    const late = read.data.filter((i) => contentOverdue(i));
    return {
      ok: true,
      data: {
        health: contentHealth(read.data, ctx.now),
        overdue: capList(late.map((i) => ({ title: clip(i.title, 100), kind: CONTENT_KIND_LABEL[i.kind], status: CONTENT_STATUS_LABEL[i.status], planned: i.plannedFor, link: CT })), clampLimit(input.limit, 6), late.length),
        page: CT,
      },
    };
  },
});

export const getContentWorkbench = defineTool({
  name: "get_content_workbench",
  description: "The content desk's smaller tools: open requests from other departments, style notes, SEO and publishing checklists (with how many boxes are ticked), translation status for English, Hausa, Yoruba and Igbo, staff announcement drafts and help gaps.",
  kind: "read",
  scopes: ["content"],
  status: "Reading the content workbench",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["content"]);
    if (!gate.ok) return refused();
    const read = await readEntries(gate.door.supabase as never, "content");
    if (read.state === "not-open") return NOT_SET_UP("content");
    if (read.state !== "ok") return unreadable("The content workbench");
    const open = read.data.filter((e) => e.status !== "retired" && e.status !== "done");
    return {
      ok: true,
      data: {
        counts: countEntries(read.data, undefined),
        requests: capList(entriesOf(open, "content_request").map((e) => ({ ...entryRow(e, `${CT}?tab=requests`), from: e.fields.from_dept ?? null, priority: e.fields.priority ?? null })), clampLimit(input.limit, 8)),
        translations: entriesOf(open, "translation").slice(0, 10).map((e) => ({ title: clip(e.title, 100), en: e.fields.en ?? "not_started", ha: e.fields.ha ?? "not_started", yo: e.fields.yo ?? "not_started", ig: e.fields.ig ?? "not_started" })),
        helpGaps: entriesOf(open, "docs_gap").slice(0, 10).map((e) => entryRow(e, `${CT}?tab=gaps`)),
      },
    };
  },
});

export const getHelpGaps = defineTool({
  name: "get_help_gaps",
  description: "Help pages members say did not help (from the Pages-that-fail data, last 30 days) and the open knowledge-base gaps the support lead keeps. Pages and counts only.",
  kind: "read",
  scopes: ["content"],
  status: "Reading the help gaps",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["content"]);
    if (!gate.ok) return refused();
    const door = await requireAdmin("content");
    if (door.state !== "admin") return refused();
    const [docs, kb] = await Promise.all([readDocFeedback(door.userClient), readEntries(door.supabase as never, "support_lead")]);
    return {
      ok: true,
      data: {
        failingPages: docs.state === "ok" ? capList(docs.rows.map((r) => ({ page: r.page, didNotHelp: r.notHelpful, helped: r.helpful })), clampLimit(input.limit, 8)) : docs.state === "not-switched-on" ? "Page feedback is not switched on yet." : "Could not be read just now.",
        knowledgeBaseGaps: kb.state === "ok" ? kb.data.filter((e) => e.kind === "kb_gap" && e.status === "open").slice(0, 10).map((e) => ({ question: clip(e.title, 140), seen: e.fields.seen ?? null })) : "Could not be read just now.",
        page: `${CT}?tab=gaps`,
      },
    };
  },
});

export const getFeedModerationCounts = defineTool({
  name: "get_feed_moderation_counts",
  description: "Feed moderation as counts only: open reports, held posts, stories and comments, open feed and Circle cases. A count that could not be read is null; say it is not available.",
  kind: "read",
  scopes: ["content"],
  status: "Reading the feed counts",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["content"]);
    if (!gate.ok) return refused();
    return { ok: true, data: { ...(await readFeedModeration(gate.door.supabase as never)), page: `${CT}?tab=feed` } };
  },
});

export const draftContentOutline = defineTool({
  name: "draft_content_outline",
  description: "Draft an outline or first version of a help article, guide or announcement for the Content Manager to read, edit and add on the desk. Plain Nigerian-first English; never describe Vallo as holding anyone's money; never say a payment is safe, protected or guaranteed. Nothing is saved.",
  kind: "propose",
  scopes: ["content"],
  status: "Drafting content",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["content"]);
    if (!gate.ok) return refused();
    return draft("Draft content", { label: "Draft content (not saved)", summary: "A draft for you to read, edit and add as an item. Nothing has been saved or published.", args: { text: input.text }, mode: "draft", deskHref: CT, action: null });
  },
});

export const draftStaffAnnouncementText = defineTool({
  name: "draft_staff_announcement_text",
  description: "Draft the words of a staff announcement for the Content Manager to add as a draft, to be approved before the COO or an admin posts it. Short and plain. Nothing is posted.",
  kind: "propose",
  scopes: ["content"],
  status: "Drafting an announcement",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["content"]);
    if (!gate.ok) return refused();
    return draft("Draft an announcement", { label: "Draft staff announcement (not posted)", summary: "A draft for the Publishing tab. Nothing has reached anyone.", args: { text: input.text }, mode: "draft", deskHref: `${CT}?tab=publishing`, action: null });
  },
});

/* ---------------------------------------------------------------- technical */

const TC = "/admin/technical";

export const getTechnicalHealth = defineTool({
  name: "get_technical_health",
  description: "Platform health, read only: scheduled jobs (late, failing, no run seen), open alerts, open crash-log error types and the last 24 hours, whether each service is set up (never its key), and the release code. A part that could not be read is null.",
  kind: "read",
  scopes: ["technical"],
  status: "Reading platform health",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const h = await readHealth(ctx.now);
    return {
      ok: true,
      data: {
        deployment: h.deployment,
        services: h.providers,
        jobsNeedingAttention: h.jobs ? h.jobs.filter((j) => j.state !== "on_time").map((j) => ({ job: j.name, state: j.state, lastRun: j.lastAt })) : null,
        openAlerts: h.openAlerts,
        openErrorTypes: h.crashes.open,
        errorTypesLast24h: h.crashes.last24h,
        page: TC,
      },
    };
  },
});

export const getErrorTrends = defineTool({
  name: "get_error_trends",
  description: "Error trend from the crash log, as counts: error types seen per day over fourteen days with a one-line comparison, and the most frequent open error types (type, place, release, times). No message, no stack, no member.",
  kind: "read",
  scopes: ["technical"],
  status: "Reading error trends",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const h = await readHealth(ctx.now);
    if (!h.crashes.daily) return unreadable("The crash log");
    return {
      ok: true,
      data: {
        perDay: h.crashes.daily,
        comparison: trendWords(h.crashes.daily),
        topOpen: capList((h.crashes.groups ?? []).map((g) => ({ type: g.type, where: g.source + (g.area ? `, ${g.area}` : ""), release: g.release, times: g.occurrences })), clampLimit(input.limit, 8)),
        page: `${TC}?tab=errors`,
      },
    };
  },
});

export const getIncidentLog = defineTool({
  name: "get_incident_log",
  description: "The technical incident log: open incidents with severity and status, resolved this month, median hours to resolve, and the latest update lines of open incidents.",
  kind: "read",
  scopes: ["technical"],
  status: "Reading the incident log",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const db = gate.door.supabase as never;
    const [incidents, updates] = await Promise.all([readIncidents(db), readIncidentUpdates(db)]);
    if (incidents.state === "not-open") return NOT_SET_UP("technical");
    if (incidents.state !== "ok") return unreadable("The incident log");
    const open = incidents.data.filter((i) => i.status !== "resolved");
    return {
      ok: true,
      data: {
        summary: summariseIncidents(incidents.data, ctx.now),
        open: capList(open.map((i) => ({ title: clip(i.title, 100), severity: SEVERITY_SHORT[i.severity], status: INCIDENT_STATUS_LABEL[i.status], started: i.startedAt, lastUpdate: updates.state === "ok" ? clip([...updates.data].reverse().find((u) => u.incidentId === i.id)?.body, 160) : null })), clampLimit(input.limit, 6), open.length),
        page: `${TC}?tab=incidents`,
      },
    };
  },
});

export const getTechnicalWorkbench = defineTool({
  name: "get_technical_workbench",
  description: "The technical desk's notes: runbook titles, release notes, expiry reminders (those running out within thirty days first), on-call notes, status page drafts and post-incident reviews.",
  kind: "read",
  scopes: ["technical"],
  status: "Reading the technical notes",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const read = await readEntries(gate.door.supabase as never, "technical");
    if (read.state === "not-open") return NOT_SET_UP("technical");
    if (read.state !== "ok") return unreadable("The technical notes");
    const live = read.data.filter((e) => e.status !== "retired");
    return {
      ok: true,
      data: {
        expiringWithin30Days: expiringSoon(read.data, 30).map((e) => entryRow(e, `${TC}?tab=reminders`)),
        runbooks: entriesOf(live, "runbook").slice(0, 15).map((e) => clip(e.title, 100)),
        releaseNotes: capList(entriesOf(live, "release_note").map((e) => entryRow(e, `${TC}?tab=releases`)), clampLimit(input.limit, 5)),
        statusDraftsWaiting: entriesOf(live, "status_draft").filter((e) => e.status === "submitted").length,
        reviewsOpen: entriesOf(live, "incident_review").filter((e) => e.status === "open").length,
      },
    };
  },
});

const noSecret = (text: string): ToolResult | null => (looksLikeSecret(text) ? { ok: false, error: "That text looks like it contains a key, token or password. Do not draft with it; describe what was seen instead." } : null);

export const draftIncidentUpdate = defineTool({
  name: "draft_incident_update",
  description: "Draft an incident update line (what changed, what is being done, when the next update is) for the Technical Administrator to post. Facts only; no cause that is not confirmed; never a key, token or password. Nothing is posted.",
  kind: "propose",
  scopes: ["technical"],
  status: "Drafting an incident update",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const bad = noSecret(input.text);
    if (bad) return bad;
    return draft("Draft an incident update", { label: "Draft incident update (not posted)", summary: "A draft for you to read, edit and post on the incident.", args: { text: input.text }, mode: "draft", deskHref: `${TC}?tab=incidents`, action: null });
  },
});

export const draftStatusPageText = defineTool({
  name: "draft_status_page_text",
  description: "Draft status page wording for an incident: headline, who is affected, what is being done and when the next update is due. Plain, calm, no unconfirmed cause. It is a draft that needs approval; nothing is published.",
  kind: "propose",
  scopes: ["technical"],
  status: "Drafting status page text",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const bad = noSecret(input.text);
    if (bad) return bad;
    return draft("Draft status page text", { label: "Draft status page text (not published)", summary: "A draft for the On call and status tab. It needs approval and nothing is published from the console.", args: { text: input.text }, mode: "draft", deskHref: `${TC}?tab=handover`, action: null });
  },
});

export const draftPostIncidentReview = defineTool({
  name: "draft_post_incident_review",
  description: "Draft a post-incident review (timeline, who was affected as counts, why it happened, what went well, what to change, actions with owners). It blames a process, never a person. Nothing is saved.",
  kind: "propose",
  scopes: ["technical"],
  status: "Drafting a review",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["technical"]);
    if (!gate.ok) return refused();
    const bad = noSecret(input.text);
    if (bad) return bad;
    return draft("Draft a post-incident review", { label: "Draft review (not saved)", summary: "A draft for the Reviews tab.", args: { text: input.text }, mode: "draft", deskHref: `${TC}?tab=reviews`, action: null });
  },
});

/* ------------------------------------------------------------- support lead */

const SL = "/admin/support-lead";

async function teamRows(): Promise<TeamRow[] | null> {
  const queue = await getSupportQueue();
  if (queue.state !== "ok") return null;
  return queue.data.rows.map((r) => ({
    id: r.id, reference: r.reference, topic: r.topic, lane: r.lane, breached: r.sla.breached, slaLabel: r.sla.label,
    holder: r.claim ? (r.claim.mine ? "You" : (r.claim.name ?? "A colleague")) : null, holderIsMe: r.claim?.mine ?? false,
    escalated: r.escalatedTo.length > 0, createdAt: r.createdAt, lastActivityAt: r.lastActivityAt,
  }));
}

export const getSupportTeamLoad = defineTool({
  name: "get_support_team_load",
  description: "Support team load: open tickets, how many nobody is holding, past their promised time, escalated, the age of the oldest, and open tickets per holder. Counts and references only; no ticket text.",
  kind: "read",
  scopes: ["support_lead"],
  status: "Reading the team's load",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    const rows = await teamRows();
    if (!rows) return unreadable("The support queue");
    const load = workload(rows, ctx.now);
    const late = rows.filter((r) => r.lane !== "done" && r.breached);
    return { ok: true, data: { ...load, lateTickets: capList(late.map((r) => ({ reference: r.reference, topic: r.topic, clock: r.slaLabel, holder: r.holder })), clampLimit(input.limit, 6), late.length), page: SL } };
  },
});

export const getSupportQuality = defineTool({
  name: "get_support_quality",
  description: "Quality reviews: average tone, accuracy, speed and policy scores per agent (1 to 5), the lowest area for each, and how many reviews were written this week. Agent names are not returned; refer to the Quality tab.",
  kind: "read",
  scopes: ["support_lead"],
  status: "Reading quality reviews",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    const read = await readQaReviews(gate.door.supabase as never);
    if (read.state === "not-open") return NOT_SET_UP("support lead");
    if (read.state !== "ok") return unreadable("The quality reviews");
    return { ok: true, data: { reviewsTotal: read.data.length, agents: qualityByAgent(read.data).map((a, i) => ({ agent: `Agent ${i + 1}`, reviews: a.reviews, tone: a.tone, accuracy: a.accuracy, speed: a.speed, policy: a.policy, lowest: a.lowest })), page: `${SL}?tab=quality` } };
  },
});

export const getRepeatedIssues = defineTool({
  name: "get_repeated_issues",
  description: "The repeated-issue tracker: the most common ticket topics in the last 30 days with counts and share, the median time recent finished tickets took, and the open knowledge-base gaps.",
  kind: "read",
  scopes: ["support_lead"],
  status: "Reading repeated issues",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    const db = gate.door.supabase as never;
    const [topics, rows, gaps] = await Promise.all([readTicketTopics(db, 30, ctx.now), teamRows(), readEntries(db, "support_lead")]);
    if (topics.state !== "ok") return unreadable("The ticket topics");
    return {
      ok: true,
      data: {
        topTopics: topTopics(topics.topics),
        medianHoursToFinishRecent: rows ? medianHoursToFinish(rows.filter((r) => r.lane === "done")) : null,
        openKnowledgeBaseGaps: gaps.state === "ok" ? gaps.data.filter((e) => e.kind === "kb_gap" && e.status === "open").slice(0, 10).map((e) => clip(e.title, 140)) : null,
        page: `${SL}?tab=figures`,
      },
    };
  },
});

export const getSupportLibrary = defineTool({
  name: "get_support_library",
  description: "The support lead's library: policy notes by status, canned replies by status (titles and topics only), escalation rules, rota notes and coaching notes (counts only; never who they are about).",
  kind: "read",
  scopes: ["support_lead"],
  status: "Reading the support library",
  input: limitInput,
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    const db = gate.door.supabase as never;
    const [policy, entries] = await Promise.all([readPolicyNotes(db), readEntries(db, "support_lead")]);
    if (policy.state === "not-open") return NOT_SET_UP("support lead");
    if (policy.state !== "ok" || entries.state !== "ok") return unreadable("The support library");
    const macros = entriesOf(entries.data, "macro").filter((e) => e.status !== "retired");
    return {
      ok: true,
      data: {
        policyNotes: policy.data.map((p) => ({ title: clip(p.title, 100), status: p.status })).slice(0, clampLimit(input.limit, 12)),
        cannedReplies: macros.slice(0, 15).map((e) => ({ name: clip(e.title, 80), topic: e.fields.topic ?? null, status: e.status })),
        escalationRules: entriesOf(entries.data, "escalation_rule").filter((e) => e.status !== "retired").length,
        rotaNotesOpen: entriesOf(entries.data, "rota_note").filter((e) => e.status === "open").length,
        coachingNotesOpen: entriesOf(entries.data, "coaching_note").filter((e) => e.status === "open").length,
        page: `${SL}?tab=library`,
      },
    };
  },
});

export const draftCannedReply = defineTool({
  name: "draft_canned_reply",
  description: "Draft a canned reply for a common question, for the Customer Support Lead to add and send for approval. Warm and plain; says what we know and what happens next; never promises an outcome another desk decides; uses the house money wording (Vallo never holds customer money). Nothing is saved or sent.",
  kind: "propose",
  scopes: ["support_lead"],
  status: "Drafting a canned reply",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    return draft("Draft a canned reply", { label: "Draft canned reply (not saved)", summary: "A draft for the Replies and policy tab. It needs approval before the team uses it.", args: { text: input.text }, mode: "draft", deskHref: `${SL}?tab=library`, action: null });
  },
});

export const draftCoachingNote = defineTool({
  name: "draft_coaching_note",
  description: "Draft a coaching note about an agent's work: a specific example, what better looks like, and the support offered. About the answer, never the person. Nothing is saved.",
  kind: "propose",
  scopes: ["support_lead"],
  status: "Drafting a coaching note",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    return draft("Draft a coaching note", { label: "Draft coaching note (not saved)", summary: "A draft for the Quality and coaching tab.", args: { text: input.text }, mode: "draft", deskHref: `${SL}?tab=quality`, action: null });
  },
});

export const draftPolicyNote = defineTool({
  name: "draft_policy_note",
  description: "Draft a support policy note: what the team does and says, and when to escalate. Plain words. It stays a draft until the COO or an admin approves it. Nothing is saved.",
  kind: "propose",
  scopes: ["support_lead"],
  status: "Drafting a policy note",
  input: z.object({ text: draftText }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support_lead"]);
    if (!gate.ok) return refused();
    return draft("Draft a policy note", { label: "Draft policy note (not saved)", summary: "A draft for the Replies and policy tab. It needs approval.", args: { text: input.text }, mode: "draft", deskHref: `${SL}?tab=library`, action: null });
  },
});

export const STAFF_DESK_TOOLS = [
  getMarketingDesk, getCampaignCalendar, getAcquisitionFigures, getReferralPerformance, getMarketingNotes, buildTrackedLink, draftCreativeBrief, draftMarketingReportReading,
  getContentDesk, getContentWorkbench, getHelpGaps, getFeedModerationCounts, draftContentOutline, draftStaffAnnouncementText,
  getTechnicalHealth, getErrorTrends, getIncidentLog, getTechnicalWorkbench, draftIncidentUpdate, draftStatusPageText, draftPostIncidentReview,
  getSupportTeamLoad, getSupportQuality, getRepeatedIssues, getSupportLibrary, draftCannedReply, draftCoachingNote, draftPolicyNote,
];
