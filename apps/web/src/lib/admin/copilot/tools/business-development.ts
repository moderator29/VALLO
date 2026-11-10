import { z } from "zod";
import { dueThisWeek, kpiCounts, listAllActivity, listActivity, listPipeline, listingsAwaitingReview, weeklySummary } from "@/lib/admin/business-development/reads";
import { BD_STAGE_LABEL, BD_STAGES, type BdProspect } from "@/lib/admin/business-development/types";
import { UUID_RE, capList, clampLimit, clip, recheck, refused, unreadable } from "./common";
import { defineTool } from "./types";

/** The partnership pipeline (`/admin/business-development`). Business and contact names only: no email or phone. */

const link = "/admin/business-development";

const prospectRow = (p: BdProspect) => ({
  id: p.id,
  business: p.businessName,
  contact: p.contactName,
  category: p.category,
  stage: BD_STAGE_LABEL[p.stage],
  nextFollowUpAt: p.nextFollowUpAt,
  listingLinked: p.listingId !== null,
  link,
});

export const getBdPipeline = defineTool({
  name: "get_bd_pipeline",
  description:
    "Business development pipeline: prospects by stage, the KPI counts (identified, contacted, follow-ups, onboarded, listings submitted from the pipeline), this week's summary, and the follow-ups due this week or overdue with ids.",
  kind: "read",
  scopes: ["business_development"],
  status: "Reading the pipeline",
  input: z.object({ stage: z.enum(BD_STAGES).optional(), limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["business_development"]);
    if (!gate.ok) return refused();
    const [pipeline, activity, awaiting] = await Promise.all([listPipeline(), listAllActivity(), listingsAwaitingReview()]);
    if (pipeline.state === "not_set_up") return { ok: false, error: "The partnership pipeline is not set up on this server yet. Say so; do not guess." };
    if (pipeline.state !== "ok") return unreadable("The pipeline");
    const acts = activity.state === "ok" ? activity.data : [];
    const byStage = Object.fromEntries(BD_STAGES.map((s) => [BD_STAGE_LABEL[s], pipeline.data.filter((p) => p.stage === s).length]));
    const limit = clampLimit(input.limit, 6);
    const filtered = input.stage ? pipeline.data.filter((p) => p.stage === input.stage) : [];
    const due = dueThisWeek(pipeline.data, ctx.now);
    return {
      ok: true,
      data: {
        total: pipeline.data.length,
        byStage,
        kpis: kpiCounts(pipeline.data, acts),
        activityRead: activity.state === "ok",
        thisWeek: weeklySummary(pipeline.data, acts, ctx.now),
        followUpsDueOrOverdue: capList(due.map(prospectRow), limit, due.length),
        ...(input.stage ? { inStage: capList(filtered.map(prospectRow), limit, filtered.length) } : {}),
        listingsAwaitingReview: awaiting,
        page: link,
      },
    };
  },
});

export const getBdProspect = defineTool({
  name: "get_bd_prospect",
  description: "One prospect by id with its stage, notes and the latest logged activity (contacts, follow-ups, notes). Use it before suggesting the next step or logging an activity.",
  kind: "read",
  scopes: ["business_development"],
  status: "Reading the prospect",
  input: z.object({ id: z.string().regex(UUID_RE) }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["business_development"]);
    if (!gate.ok) return refused();
    const [pipeline, activity] = await Promise.all([listPipeline(), listActivity(input.id)]);
    if (pipeline.state !== "ok") return unreadable("The pipeline");
    const p = pipeline.data.find((row) => row.id === input.id);
    if (!p) return { ok: false, error: "No prospect with that id is in the pipeline." };
    return {
      ok: true,
      data: {
        ...prospectRow(p),
        location: p.location,
        notes: clip(p.notes, 400),
        activity: activity.state === "ok" ? activity.data.slice(0, 8).map((a) => ({ kind: a.kind, text: clip(a.body, 240), outcome: clip(a.outcome, 160), at: a.createdAt })) : null,
      },
    };
  },
});

export const BD_TOOLS = [getBdPipeline, getBdProspect];
