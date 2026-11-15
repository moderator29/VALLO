import { z } from "zod";
import { STAFF_SCOPES, STAFF_SCOPE_LABEL, type StaffScope } from "@/lib/admin/guard";
import { getAuditActivity, getAuditLog } from "@/lib/admin/audit-queries";
import { readControlRoom } from "@/lib/admin/control/read";
import { getQueueCounts } from "@/lib/admin/queries";
import { getExamplesConsole } from "@/lib/admin/examples-queries";
import { getCollectedSeries, getConsolePulse } from "@/lib/admin/reads/overview";
import { getSupplyDesk } from "@/lib/admin/reads/supply";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { readStaffDesk } from "@/lib/admin/staff-queries";
import { capList, clampLimit, clip, refused, unreadable } from "./common";
import { defineTool, type ToolLink } from "./types";

/**
 * THE SUPER ADMIN'S OWN TOOLS (16 November 2026). Three reads, offered to a
 * super admin and to nobody else, for the questions only the founder asks:
 * how the whole platform stands, who holds what access, and what changed.
 *
 * Every figure comes from a read the console already has
 * (`reads/overview`, `queries`, `control/read`, `examples-queries`,
 * `reads/supply`, `staff-queries`, `audit-queries`): no new SQL is written
 * here, and nothing is changed by any of them. A read that fails is reported
 * as not read, never filled in with an estimate.
 */

const naira = (minor: number | null | undefined): string | null =>
  typeof minor === "number" && Number.isFinite(minor) ? `N${Math.round(minor / 100).toLocaleString("en-NG")}` : null;

type Part<T> = { state: "ok"; data: T } | { state: string };

/** The data of a read that worked, or null. Keeps "could not be read" out of the figures. */
function got<T>(read: Part<T> | null | undefined): T | null {
  return read && read.state === "ok" ? (read as { state: "ok"; data: T }).data : null;
}

/** A read that may throw is still only a read: a fault becomes "not read". */
async function tryRead<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ the platform */

export const getPlatformPulse = defineTool({
  name: "get_platform_pulse",
  description:
    "For a super admin: the whole platform in one answer. Members, listers and listings with the examples counted apart, what is waiting on a person across every desk, money taken in the last 7 and 30 days, open alerts and how each main switch stands. Use it for 'how are we doing', 'what is waiting across the platform', 'how much have we taken' and 'what needs me today'.",
  kind: "read",
  scopes: STAFF_SCOPES,
  allow: (viewer) => viewer.isSuperAdmin,
  status: "Reading the whole platform",
  input: z.object({}),
  handler: async (_input, ctx) => {
    if (!ctx.viewer.isSuperAdmin) return refused();
    const [pulse, month, counts, room, supply, examples] = await Promise.all([
      tryRead(() => getConsolePulse(ctx.now)),
      tryRead(() => getCollectedSeries("30d", ctx.now)),
      tryRead(() => getQueueCounts()),
      tryRead(() => readControlRoom()),
      tryRead(() => getSupplyDesk({ examples: false, page: 1, pageSize: 1 }, ctx.now)),
      tryRead(() => getExamplesConsole()),
    ]);
    const p = got(pulse);
    const m = got(month);
    const c = got(counts);
    const s = got(supply);
    const e = got(examples);
    const r = room && room.state === "ok" ? room : null;
    if (!p && !c && !r) return unreadable("The platform's figures");

    const waiting = c
      ? [
          { work: "Listings waiting on a review decision", count: c.listings, link: "/admin/listings" },
          { work: "Applications to list waiting on a decision", count: c.applications, link: "/admin/agents" },
          { work: "ID and address documents waiting on a decision", count: c.verification ?? 0, link: "/admin/kyc" },
          { work: "Reports waiting on a decision", count: c.reports, link: "/admin/queue" },
          { work: "Flagged messages waiting", count: c.flags, link: "/admin/queue" },
          { work: "Content held by the safety scan", count: c.moderation, link: "/admin/queue" },
          { work: "Support tickets open or pending", count: c.tickets, link: "/admin/support" },
          { work: "Agreements waiting for review before payment opens", count: c.agreements, link: "/admin/agreements" },
          { work: "Guarantee claims still open from before it retired", count: c.claims, link: "/admin/money" },
          { work: "Referrals and reward payouts waiting on a decision", count: c.referrals + c.payouts, link: "/admin/referrals" },
          { work: "Alerts open, waiting on a person", count: c.alerts, link: "/admin/alerts" },
        ].filter((row) => row.count > 0)
      : null;

    const collected30 = m ? m.buckets.reduce((total, bucket) => total + bucket.amountMinor, 0) : null;
    const links: ToolLink[] = [
      { label: "Open the control room", href: "/admin/control", requires: "super_admin" },
      { label: "Open the Overview", href: "/admin" },
      { label: "Open the queue", href: "/admin/queue" },
    ];
    if (waiting && waiting.length > 0) links.push({ label: "Open Alerts", href: "/admin/alerts" });

    return {
      ok: true,
      data: {
        people: p ? { members: p.peopleTotal, signedUpToday: p.signupsToday, signedUpYesterday: p.signupsYesterday } : null,
        listings: p
          ? {
              liveReal: p.listingsLive,
              liveRealAWeekAgo: p.listingsLiveWeekAgo,
              submittedLast7Days: p.newSupplyWeek,
              submittedThe7DaysBefore: p.newSupplyPrevWeek,
              examplesLive: e ? e.totals.liveCount : null,
              examplesTotal: e ? e.totals.total : null,
              examplesPastTheirDate: e ? e.totals.overdueCount : null,
            }
          : null,
        listers: s
          ? {
              owners: s.counts.owner.now,
              agents: s.counts.agent.now,
              firms: s.counts.firm.now,
              hosts: s.counts.host.now,
              aWeekAgo: { owners: s.counts.owner.weekAgo, agents: s.counts.agent.weekAgo, firms: s.counts.firm.weekAgo, hosts: s.counts.host.weekAgo },
              exampleListersLeftOut: s.examplesExcluded,
            }
          : null,
        moneyTakenIn: {
          last7Days: naira(p?.collectedWeekMinor),
          the7DaysBefore: naira(p?.collectedPrevWeekMinor),
          last30Days: naira(collected30),
          today: naira(p?.collectedTodayMinor),
          what: "Money collected: successful card charges plus completed wallet top-ups. Vallo holds no customer money.",
        },
        waitingAcrossTheDesks: waiting,
        waitingOnYou: r ? r.waiting.map((line) => ({ words: line.words, link: line.href })) : null,
        switches: r ? r.switches.map((sw) => ({ name: sw.note.title, state: sw.state, means: sw.state === "on" ? sw.note.on : sw.note.off })) : null,
        readingValloWithoutAnAccount: r ? { name: r.reach.title, open: r.reach.open, means: r.reach.meaning, howToChange: r.reach.howToChange } : null,
        couldNotBeRead: [
          !p ? "the platform pulse" : null,
          !m ? "money over the last 30 days" : null,
          !c ? "what is waiting across the desks" : null,
          !r ? "the control room (switches and what is waiting on you)" : null,
          !s ? "the listers" : null,
          !e ? "the example listings" : null,
        ].filter((x): x is string => x !== null),
        page: "/admin",
      },
      note: "Answer in short plain sentences with the numbers. Anything under couldNotBeRead was not read: say so rather than estimate it. Example listings and example listers are never counted as real supply.",
      links,
    };
  },
});

/* --------------------------------------------------------------- the staff */

const POSITION_TITLE = (position: string | null): string | null =>
  position && position in JOB_DESCRIPTIONS ? JOB_DESCRIPTIONS[position as keyof typeof JOB_DESCRIPTIONS].title : null;

/** Every scope, and who holds it. A scope nobody holds is the one that matters. */
export function teamsWithNobody(rows: readonly { kind: string; scopes: readonly StaffScope[]; revokedAt: string | null }[]): StaffScope[] {
  const held = new Set<StaffScope>();
  for (const row of rows) {
    if (row.revokedAt) continue;
    if (row.kind === "admin" || row.kind === "super_admin") continue;
    for (const scope of row.scopes) held.add(scope);
  }
  return STAFF_SCOPES.filter((scope) => !held.has(scope));
}

export const getStaffOverview = defineTool({
  name: "get_staff_overview",
  description:
    "For a super admin: who holds staff access and what each person holds, who has acknowledged the handbook and who has not, who has been active lately, and which teams have nobody on them. An empty team matters: an escalation for it reaches the COO and then the super admin. Use it for 'who has access to what', 'who has not read the handbook', 'who is active' and 'which teams are empty'.",
  kind: "read",
  scopes: STAFF_SCOPES,
  allow: (viewer) => viewer.isSuperAdmin,
  status: "Reading who holds access",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    if (!ctx.viewer.isSuperAdmin) return refused();
    const desk = await tryRead(() => readStaffDesk(ctx.now));
    if (!desk || desk.state === "forbidden") return refused();
    if (desk.state !== "ok") return unreadable("The staff desk");

    const active = desk.rows.filter((row) => !row.revokedAt);
    const since = ctx.now - 7 * 86_400_000;
    const activeLately = active.filter((row) => row.lastActiveAt !== null && Date.parse(row.lastActiveAt) >= since);
    const empty = teamsWithNobody(active);
    const limit = clampLimit(input.limit, 10);

    return {
      ok: true,
      data: {
        people: {
          total: active.length,
          superAdmins: active.filter((row) => row.kind === "super_admin").length,
          admins: active.filter((row) => row.kind === "admin").length,
          staffWithScopes: active.filter((row) => row.kind === "staff").length,
          accessWithdrawn: desk.rows.length - active.length,
        },
        handbook: {
          acknowledged: active.filter((row) => row.handbookAcknowledgedAt !== null).length,
          notYet: active.filter((row) => row.handbookAcknowledgedAt === null).map((row) => ({ person: row.name, position: POSITION_TITLE(row.position) })),
        },
        activeInTheLast7Days: { count: activeLately.length, of: active.length },
        quiet: active
          .filter((row) => row.lastActiveAt === null || Date.parse(row.lastActiveAt) < since)
          .slice(0, limit)
          .map((row) => ({ person: row.name, position: POSITION_TITLE(row.position), lastActive: row.lastActiveAt })),
        whoHoldsWhat: capList(
          active.map((row) => ({
            person: row.name,
            holds: row.kind === "staff" ? row.scopes.map((scope) => STAFF_SCOPE_LABEL[scope]) : ["every desk, through their role"],
            role: row.kind === "staff" ? (POSITION_TITLE(row.position) ?? "staff") : row.kind === "admin" ? "admin" : "super admin",
            handbookAcknowledged: row.handbookAcknowledgedAt !== null,
            lastActive: row.lastActiveAt,
            actionsLast30Days: row.actionsLast30,
          })),
          limit,
        ),
        teamsWithNobodyOnThem: empty.map((scope) => STAFF_SCOPE_LABEL[scope]),
        whyAnEmptyTeamMatters:
          "An escalation routed to a team with nobody on it goes to the COO, and then to the super admin. Every one of these lands on you until somebody holds the area.",
        recentlyOnTheStaffDesk: desk.recent.slice(0, limit).map((row) => ({ at: row.at, who: row.actor, did: row.action, record: row.entity })),
        page: "/admin/staff",
      },
      note: "Only the super admin grants or withdraws staff access, on the Staff desk. You cannot grant, withdraw or change anyone's access: say the figures and offer the desk.",
      links: [
        { label: "Open the Staff desk", href: "/admin/staff", requires: "super_admin" },
        { label: "Open Team oversight", href: "/admin/oversight", requires: "admin" },
        { label: "Open Escalations", href: "/admin/escalations" },
      ],
    };
  },
});

/* -------------------------------------------------------- what changed */

/** The desk a record of this kind lives on. Anything unknown stays on the audit log. */
export function recordDesk(entityType: string): { desk: string; href: string } {
  const map: Record<string, { desk: string; href: string }> = {
    listing: { desk: "Listings", href: "/admin/listings" },
    agent: { desk: "Supply", href: "/admin/supply" },
    agent_application: { desk: "Applications", href: "/admin/agents" },
    agent_documents: { desk: "Verification", href: "/admin/kyc" },
    identity_checks: { desk: "Verification", href: "/admin/kyc" },
    business: { desk: "Businesses", href: "/admin/businesses" },
    booking: { desk: "Bookings", href: "/admin/bookings" },
    inspection_request: { desk: "Visits", href: "/admin/bookings/visits" },
    reservation: { desk: "Reservations", href: "/admin/bookings/reservations" },
    support_ticket: { desk: "Support", href: "/admin/support" },
    report: { desk: "Cases", href: "/admin/cases" },
    message_flag: { desk: "Unified queue", href: "/admin/queue" },
    risk_alert: { desk: "Alerts", href: "/admin/alerts" },
    crash_report: { desk: "Crash log", href: "/admin/crashes" },
    refund_request: { desk: "Chargebacks", href: "/admin/chargebacks" },
    wallet_entry: { desk: "Payments", href: "/admin/payments" },
    money_history: { desk: "Money", href: "/admin/money" },
    provider_arrangement: { desk: "Protected payments", href: "/admin/arrangements" },
    feature_flag: { desk: "Switches", href: "/admin/switches" },
    staff_grant: { desk: "Staff", href: "/admin/staff" },
    staff_task: { desk: "My tasks", href: "/admin/my-desk/tasks" },
    staff_weekly_report: { desk: "Weekly reports", href: "/admin/reports/weekly" },
    coo_escalation: { desk: "Escalations", href: "/admin/escalations" },
    social_post: { desk: "Around", href: "/admin/social" },
    bd_prospect: { desk: "Business development", href: "/admin/business-development" },
    edd_review: { desk: "Compliance", href: "/admin/compliance" },
    pep_flag: { desk: "Compliance", href: "/admin/compliance" },
    user_badge: { desk: "Standing", href: "/admin/standing" },
    review_contest: { desk: "Withheld weight", href: "/admin/weight-withheld" },
    cron_job: { desk: "Operations", href: "/admin/operations" },
    inventory_drift: { desk: "Operations", href: "/admin/operations" },
    oversight: { desk: "Team oversight", href: "/admin/oversight" },
    copilot_proposal: { desk: "Audit log", href: "/admin/audit" },
  };
  return map[entityType] ?? { desk: "Audit log", href: "/admin/audit" };
}

/** "approved listing" out of `listing.approve`, so an answer reads as words. */
export function actionWords(action: string): string {
  return action.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export const getWhatChanged = defineTool({
  name: "get_what_changed",
  description:
    "For a super admin: the recent audit trail in plain words. Who did what and when, with the desk each record lives on, plus how busy the last 30 days have been and which kinds of record and which people account for it. Use it for 'what changed this week', 'what has been happening', 'who decided this' and 'what did the team do'.",
  kind: "read",
  scopes: STAFF_SCOPES,
  allow: (viewer) => viewer.isSuperAdmin,
  status: "Reading the audit trail",
  input: z.object({
    limit: z.number().int().min(1).max(25).optional(),
    /** Narrows to one kind of record, as the audit log names it (for example `listing`). */
    kind: z.string().max(40).optional(),
  }),
  handler: async (input, ctx) => {
    if (!ctx.viewer.isSuperAdmin) return refused();
    const [log, activity] = await Promise.all([
      tryRead(() => getAuditLog(input.kind ? { status: input.kind } : undefined)),
      tryRead(() => getAuditActivity()),
    ]);
    const rows = got(log);
    const trend = got(activity);
    if (!rows && !trend) return unreadable("The audit trail");

    const limit = clampLimit(input.limit, 10);
    const lines = (rows?.rows ?? []).slice(0, limit).map((row) => {
      const where = recordDesk(row.entityType);
      return {
        when: row.createdAt,
        who: row.actorName ?? "the system",
        did: actionWords(row.action),
        record: `${row.entityType}${row.entityId ? ` ${clip(row.entityId, 40)}` : ""}`,
        desk: where.desk,
        link: where.href,
      };
    });

    return {
      ok: true,
      data: {
        latest: rows ? { shown: lines.length, morePagesExist: rows.full, items: lines } : null,
        lastThirtyDays: trend
          ? {
              recordedDecisions: trend.total,
              isAFloor: trend.capped,
              busiestKinds: trend.byKind.slice(0, 6),
              busiestPeople: trend.byActor.slice(0, 6),
              days: trend.windowDays,
            }
          : null,
        couldNotBeRead: [!rows ? "the latest entries" : null, !trend ? "the last 30 days" : null].filter((x): x is string => x !== null),
        page: "/admin/audit",
      },
      note: "Say who did what and when, newest first, in plain words. Every figure here is from the audit log. Quote no name that is not in this result.",
      links: [{ label: "Open the Audit log", href: "/admin/audit", requires: "admin" }],
    };
  },
});

export const PLATFORM_TOOLS = [getPlatformPulse, getStaffOverview, getWhatChanged];
