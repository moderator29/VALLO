import type { Metadata } from "next";
import { countOf } from "@vallo/i18n/core";

import { CopyButton } from "@/components/docs/CopyButton";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { supportLeadContext } from "@/lib/admin/copilot/contexts/support-lead";
import { deskDoor } from "@/lib/admin/desk-door";
import { countEntries, entriesOf } from "@/lib/admin/desk-entries/model";
import { readEntries, readNames, readSupportAgents } from "@/lib/admin/desk-entries/queries";
import { requireAdmin } from "@/lib/admin/guard";
import { getSupportQueue } from "@/lib/admin/support-queue";
import {
  POLICY_STATUS_LABEL,
  SCORE_KEYS,
  SCORE_LABEL,
  medianHoursToFinish,
  qualityByAgent,
  reviewsThisWeek,
  topTopics,
  workload,
  type PolicyNote,
  type QaReview,
  type TeamRow,
} from "@/lib/admin/support-lead/model";
import { readPolicyNotes, readQaReviews, readTicketOutcomes, readTicketTopics } from "@/lib/admin/support-lead/queries";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
import { readDocFeedback, type DocFeedbackRead } from "@/app/admin/doc-feedback/read";

import { DeskLink, DeskRefused, DeskTable, Source, shortDate } from "../_components/desk-parts";
import { EntryTool } from "../_components/EntryTool";
import { Badge, CalmNote, KpiGrid, NotWired, PageHead, Panel, type BadgeTone, type KpiItem } from "../_components/panels";
import { AssignControl, PolicyActions, PolicyForm, QaForm } from "./SupportLeadControls";

export const metadata: Metadata = { title: "Support lead", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  ["team", "Team"],
  ["escalations", "Escalations"],
  ["quality", "Quality and coaching"],
  ["figures", "Figures"],
  ["library", "Replies and policy"],
] as const;
type Tab = (typeof TABS)[number][0];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
const POLICY_TONE: Record<PolicyNote["status"], BadgeTone> = { draft: "pending", approved: "success", retired: "info" };

/**
 * THE CUSTOMER SUPPORT LEAD'S DESK (founder, 10 November 2026). The team's
 * load and who holds what, assigning an unassigned ticket, escalations and the
 * escalation matrix, quality reviews and coaching notes, the figures the
 * console can count (including the repeated-issue tracker and the promised
 * times), canned replies and policy notes with approval, rota notes and the
 * knowledge-base gaps. It reads the support queue through the support door and
 * never shows a message; it moves no money and restricts no one.
 */
export default async function SupportLeadPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await deskDoor("support_lead", { approverMayEnter: true });
  if (door.state !== "ok") return <DeskRefused title="Support lead" state={door.state} who="This desk is for the Customer Support Lead." />;

  const params = await searchParams;
  const asked = one(params.tab);
  const tab: Tab = door.viaApprover ? "library" : ((TABS.find(([k]) => k === asked)?.[0] ?? "team") as Tab);

  const [queueRead, qaRead, policyRead, entriesRead, agents, topics, outcomes, docs] = await Promise.all([
    door.viaApprover ? Promise.resolve(null) : getSupportQueue(),
    readQaReviews(door.db),
    readPolicyNotes(door.db),
    readEntries(door.db, "support_lead"),
    readSupportAgents(door.db),
    tab === "figures" ? readTicketTopics(door.db) : Promise.resolve(null),
    tab === "figures" ? readTicketOutcomes(door.db) : Promise.resolve(null),
    tab === "figures" ? readDocs() : Promise.resolve(null),
  ]);
  const notOpen = qaRead.state === "not-open" || policyRead.state === "not-open";
  const qa = qaRead.state === "ok" ? qaRead.data : [];
  const policy = policyRead.state === "ok" ? policyRead.data : [];
  const entries = entriesRead.state === "ok" ? entriesRead.data : [];
  const queueRows = queueRead && queueRead.state === "ok" ? queueRead.data.rows : null;
  const team: TeamRow[] | null = queueRows
    ? queueRows.map((r) => ({
        id: r.id, reference: r.reference, topic: r.topic, lane: r.lane, breached: r.sla.breached, slaLabel: r.sla.label,
        holder: r.claim ? (r.claim.mine ? "You" : (r.claim.name ?? "A colleague")) : null, holderIsMe: r.claim?.mine ?? false,
        escalated: r.escalatedTo.length > 0, createdAt: r.createdAt, lastActivityAt: r.lastActivityAt,
      }))
    : null;
  const load = team ? workload(team) : null;
  const names = Object.fromEntries(await readNames(door.db, [...qa.flatMap((r) => [r.reviewedAgent, r.reviewerId]), ...policy.flatMap((p) => [p.approvedBy, p.createdBy]), ...entries.flatMap((e) => [e.subjectUser, e.approvedBy, e.createdBy])]));
  const entryCounts = countEntries(entries);
  const context = !notOpen
    ? supportLeadContext({
        open: load?.open ?? null,
        unassigned: load?.unassigned ?? null,
        late: load?.late ?? null,
        escalated: load?.escalated ?? null,
        oldestOpenHours: load?.oldestOpenHours ?? null,
        qaReviewsThisWeek: reviewsThisWeek(qa),
        policyDraftsWaiting: policy.filter((p) => p.status === "draft").length,
        macrosWaiting: entriesOf(entries, "macro").filter((e) => e.status === "submitted").length,
        gapsOpen: entriesOf(entries, "kb_gap").filter((e) => e.status === "open").length,
      })
    : null;
  const canMake = !door.viaApprover;
  const common = { entries, canMake, canApprove: door.canApprove, agents, names, readable: entriesRead.state === "ok" } as const;

  return (
    <div className="nf-console nf-admin-stack">
      <PageHead
        title="Support lead"
        lede="The team's load and who holds what, escalations, the quality of the answers, the figures the console can count, and the replies and policy the team answers from. You read tickets only as counts and references: the conversation stays in the Support desk."
        action={<DeskLink href="/admin/support">Support desk</DeskLink>}
      />
      {notOpen ? (
        <Panel><NotWired what="The quality review and policy tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." /></Panel>
      ) : qaRead.state === "error" || policyRead.state === "error" ? (
        <Panel><CalmNote kind="error" title="Some of this desk could not be read" fills="Nothing was changed. Refresh in a moment." /></Panel>
      ) : null}
      {entriesRead.state === "not-open" && !notOpen ? (
        <Panel><NotWired what="The canned reply, rota and coaching tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." /></Panel>
      ) : null}
      {door.viaApprover ? (
        <Panel><p className="nf-body-sm text-[var(--nf-content-secondary)]">You are here to approve. You can read every policy note and canned reply and approve or send one back; the Customer Support Lead makes the changes.</p></Panel>
      ) : (
        <UnderlineTabs label="Support lead desk" active={tab} items={TABS.map(([key, label]) => ({ key, label, href: key === "team" ? "/admin/support-lead" : `/admin/support-lead?tab=${key}` }))} />
      )}

      {tab === "team" ? (
        <div className="grid gap-lg">
          <TeamPanel load={load} team={team} queueState={queueRead?.state ?? "forbidden"} agents={agents} canMake={canMake} />
          <Panel title="Rota notes"><EntryTool kind="rota_note" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "escalations" ? (
        <div className="grid gap-lg">
          <Escalated team={team} />
          <Panel title="Escalation matrix"><EntryTool kind="escalation_rule" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "quality" ? (
        <div className="grid gap-lg">
          <Quality qa={qa} names={names} agents={agents} canMake={canMake} readable={qaRead.state === "ok"} />
          <Panel title="Coaching notes"><EntryTool kind="coaching_note" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "figures" ? <Figures team={team} topics={topics && topics.state === "ok" ? topics.topics : null} outcomes={outcomes} docs={docs} /> : null}
      {tab === "library" ? (
        <div className="grid gap-lg">
          <Panel title={`Canned replies${entryCounts.waitingApproval > 0 ? ` (${entryCounts.waitingApproval} waiting)` : ""}`}><EntryTool kind="macro" {...common} /></Panel>
          <Policy notes={policy} names={names} canMake={canMake} canApprove={door.canApprove} readable={policyRead.state === "ok"} />
          <Panel title="Knowledge-base gaps"><EntryTool kind="kb_gap" {...common} /></Panel>
        </div>
      ) : null}
      <DeskCopilot scope="support_lead" deskName="Support lead" context={context} />
    </div>
  );
}

async function readDocs(): Promise<DocFeedbackRead> {
  const access = await requireAdmin("support_lead");
  if (access.state !== "admin") return { state: "unavailable" };
  return readDocFeedback(access.userClient);
}

function TeamPanel({ load, team, queueState, agents, canMake }: { load: ReturnType<typeof workload> | null; team: TeamRow[] | null; queueState: string; agents: { id: string; name: string }[]; canMake: boolean }) {
  if (!load || !team) {
    return (
      <Panel>
        <CalmNote kind="error" title={queueState === "forbidden" ? "The support queue is not open to your access" : "The support queue could not be read"} fills="Nothing is shown rather than a clean queue. Refresh in a moment." />
      </Panel>
    );
  }
  const kpis: KpiItem[] = [
    { key: "open", label: "Open tickets", value: String(load.open), count: load.open, caption: load.oldestOpenHours === null ? undefined : `Oldest ${load.oldestOpenHours}h` },
    { key: "free", label: "Nobody holding", value: String(load.unassigned), count: load.unassigned },
    { key: "late", label: "Past promised time", value: String(load.late), count: load.late },
    { key: "esc", label: "Escalated", value: String(load.escalated), count: load.escalated },
  ];
  const free = team.filter((r) => r.lane !== "done" && !r.holder && r.lane !== "waiting_on_member").slice(0, 20);
  return (
    <>
      <KpiGrid items={kpis} label="Team workload" />
      <Panel title="Who is holding what" flush>
        {load.byHolder.length === 0 ? (
          <div className="p-md"><p className="nf-body-sm">Nobody is holding a ticket right now. A hold frees itself after thirty minutes without a touch.</p></div>
        ) : (
          <DeskTable caption="Open tickets by the person holding them" columns={[{ key: "who", label: "Holder" }, { key: "open", label: "Open", numeric: true }, { key: "late", label: "Late", numeric: true }]} rows={load.byHolder.map((h) => ({ key: h.name, cells: { who: h.name, open: String(h.open), late: String(h.late) } }))} />
        )}
      </Panel>
      <Panel title={`Nobody holding (${free.length}${free.length === 20 ? " shown" : ""})`}>
        {free.length === 0 ? (
          <p className="nf-body-sm">Every open ticket that needs us has someone holding it.</p>
        ) : (
          <ul className="grid gap-sm">
            {free.map((t) => (
              <li key={t.id} className="nf-admin-card p-md" data-testid="support-lead-unassigned">
                <p className="nf-body-sm flex flex-wrap items-center gap-xs">
                  <strong>{t.reference}</strong>
                  <CopyButton text={t.reference} label="Reference" />
                  <Badge tone={t.breached ? "error" : "info"}>{t.slaLabel}</Badge>
                  {t.topic ? <span className="text-[var(--nf-content-secondary)]">{t.topic}</span> : null}
                </p>
                <div className="mt-xs flex flex-wrap items-center gap-xs">
                  {canMake ? <AssignControl ticketId={t.id} agents={agents} /> : null}
                  <DeskLink href={`/admin/support?ticket=${t.id}`}>Open the ticket</DeskLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Escalated({ team }: { team: TeamRow[] | null }) {
  const rows = team?.filter((r) => r.escalated && r.lane !== "done") ?? null;
  return (
    <Panel title="Escalated tickets" flush>
      {rows === null ? (
        <div className="p-md"><CalmNote kind="error" title="The support queue could not be read" fills="Nothing is shown rather than a clean list." /></div>
      ) : rows.length === 0 ? (
        <div className="p-md"><p className="nf-body-sm">No ticket is waiting on another desk.</p></div>
      ) : (
        <DeskTable
          caption="Tickets escalated to another desk and not yet returned"
          columns={[{ key: "ref", label: "Reference" }, { key: "topic", label: "Topic" }, { key: "sla", label: "Clock" }, { key: "age", label: "Filed" }, { key: "open", label: "" }]}
          rows={rows.map((r) => ({ key: r.id, cells: { ref: <span>{r.reference} <CopyButton text={r.reference} label="Reference" /></span>, topic: r.topic ?? "Not stated", sla: r.slaLabel, age: shortDate(r.createdAt), open: <DeskLink href={`/admin/support?ticket=${r.id}`}>Open</DeskLink> } }))}
        />
      )}
    </Panel>
  );
}

function Quality({ qa, names, agents, canMake, readable }: { qa: QaReview[]; names: Record<string, string>; agents: { id: string; name: string }[]; canMake: boolean; readable: boolean }) {
  const by = qualityByAgent(qa);
  return (
    <div className="grid gap-lg">
      <Panel title="Scores by agent" flush>
        {by.length === 0 ? (
          <div className="p-md"><CalmNote title="No reviews yet" fills="Averages appear here once you review answered tickets." creates={canMake ? "Review one below." : undefined} /></div>
        ) : (
          <DeskTable
            caption="Average review scores per agent, 1 to 5, lowest overall first"
            columns={[{ key: "who", label: "Agent" }, { key: "n", label: "Reviews", numeric: true }, ...SCORE_KEYS.map((k) => ({ key: k, label: SCORE_LABEL[k], numeric: true })), { key: "focus", label: "Lowest" }]}
            rows={by.map((a) => ({ key: a.agentId, cells: { who: names[a.agentId] ?? "A colleague", n: String(a.reviews), tone: String(a.tone), accuracy: String(a.accuracy), speed: String(a.speed), policy: String(a.policy), focus: SCORE_LABEL[a.lowest] } }))}
          />
        )}
      </Panel>
      {canMake ? <Panel title="Review an answered ticket"><QaForm agents={agents} /></Panel> : null}
      <Panel title="Recent reviews" flush>
        {!readable || qa.length === 0 ? (
          <div className="p-md"><p className="nf-body-sm">No reviews yet.</p></div>
        ) : (
          <DeskTable
            caption="Recent quality reviews"
            columns={[{ key: "date", label: "Date" }, { key: "ref", label: "Ticket" }, { key: "who", label: "Agent" }, { key: "s", label: "Tone, accuracy, speed, policy" }, { key: "notes", label: "Notes" }]}
            rows={qa.slice(0, 20).map((r) => ({ key: r.id, cells: { date: shortDate(r.createdAt), ref: <span>{r.ticketRef} <CopyButton text={r.ticketRef} label="Reference" /></span>, who: r.reviewedAgent ? (names[r.reviewedAgent] ?? "A colleague") : "Removed account", s: `${r.tone}, ${r.accuracy}, ${r.speed}, ${r.policy}`, notes: r.notes || "None" } }))}
          />
        )}
      </Panel>
    </div>
  );
}

function Figures({ team, topics, outcomes, docs }: { team: TeamRow[] | null; topics: (string | null)[] | null; outcomes: Record<string, number> | null; docs: DocFeedbackRead | null }) {
  const done = team?.filter((r) => r.lane === "done") ?? [];
  const median = team ? medianHoursToFinish(done) : null;
  const top = topics ? topTopics(topics) : null;
  return (
    <div className="grid gap-lg">
      <Panel title="Promised times (read only)">
        <ul className="nf-body-sm grid gap-xs">
          {Object.values(RESPONSE_COMMITMENTS).map((c) => (
            <li key={c.grade}><strong>{c.label}.</strong> {c.covers}</li>
          ))}
        </ul>
        <Source>These are the promises on the public standards page, and the clocks the Support desk runs. Changing them is a decision for the COO.</Source>
      </Panel>
      <Panel title="Finishing time">
        <p className="nf-body-sm">{median === null ? "Not available: no finished ticket in the recent queue to measure." : `The last ${countOf(done.length, "tickets")} finished took a median of ${median} hours from filing to the last activity.`}</p>
      </Panel>
      <Panel title="What members write about (30 days)" flush>
        {top === null ? (
          <div className="p-md"><CalmNote kind="error" title="The ticket topics could not be read" fills="Nothing is shown rather than an empty list." /></div>
        ) : top.length === 0 ? (
          <div className="p-md"><p className="nf-body-sm">No tickets in the last 30 days.</p></div>
        ) : (
          <DeskTable caption="Ticket topics, most common first" columns={[{ key: "topic", label: "Topic" }, { key: "n", label: "Tickets", numeric: true }, { key: "share", label: "Share", numeric: true }]} rows={top.map((t) => ({ key: t.topic, cells: { topic: t.topic, n: String(t.count), share: `${t.share}%` } }))} />
        )}
      </Panel>
      <Panel title="Where tickets filed in 30 days stand now">
        {outcomes === null ? (
          <p className="nf-body-sm">Could not be read just now.</p>
        ) : (
          <ul className="nf-body-sm grid gap-3xs">{Object.entries(outcomes).sort((a, b) => b[1] - a[1]).map(([status, n]) => <li key={status}>{status}: {n}</li>)}</ul>
        )}
        <Source>Outcomes are counts by status. Add the reading from your quality reviews.</Source>
      </Panel>
      <Panel title="Help pages members say did not help" flush>
        {!docs || docs.state === "unavailable" ? (
          <div className="p-md"><p className="nf-body-sm">Could not be read just now.</p></div>
        ) : docs.state === "not-switched-on" ? (
          <div className="p-md"><NotWired what="Page feedback is not switched on yet." request="Ask the lead to apply supabase/migrations/pending/docs_page_feedback_2026-11-10.sql." /></div>
        ) : docs.rows.length === 0 ? (
          <div className="p-md"><p className="nf-body-sm">No page has been marked unhelpful in the last 30 days.</p></div>
        ) : (
          <DeskTable caption="Pages ranked by answers saying they did not help" columns={[{ key: "page", label: "Page" }, { key: "no", label: "Did not help", numeric: true }, { key: "yes", label: "Helped", numeric: true }]} rows={docs.rows.slice(0, 10).map((r) => ({ key: r.page, cells: { page: r.page, no: String(r.notHelpful), yes: String(r.helpful) } }))} />
        )}
      </Panel>
    </div>
  );
}

function Policy({ notes, names, canMake, canApprove, readable }: { notes: PolicyNote[]; names: Record<string, string>; canMake: boolean; canApprove: boolean; readable: boolean }) {
  return (
    <Panel title="Policy notes">
      <p className="nf-body-sm mb-sm text-[var(--nf-content-secondary)]">The team answers from approved notes only. A draft is the Lead&apos;s until the COO or an admin approves it.</p>
      {notes.length === 0 && readable ? (
        <CalmNote title="No policy notes yet" fills="Approved notes are what the team works from." creates={canMake ? "Write the first one below." : undefined} />
      ) : (
        <ul className="grid gap-sm">
          {notes.map((n) => (
            <li key={n.id} className="nf-admin-card p-md" data-testid="support-lead-policy-note">
              <div className="flex flex-wrap items-center gap-xs">
                <span className="font-semibold [overflow-wrap:anywhere]">{n.title}</span>
                <Badge tone={POLICY_TONE[n.status]}>{POLICY_STATUS_LABEL[n.status]}</Badge>
              </div>
              {n.approvedAt ? <p className="nf-caption text-[var(--nf-content-secondary)]">Approved on {shortDate(n.approvedAt)}{n.approvedBy && names[n.approvedBy] ? ` by ${names[n.approvedBy]}` : ""}</p> : null}
              <details className="mt-xs">
                <summary className="nf-body-sm cursor-pointer">Read the note</summary>
                <p className="nf-body-sm mt-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{n.body}</p>
                <div className="mt-xs"><CopyButton text={`${n.title}\n\n${n.body}`} label="Policy note" /></div>
              </details>
              <div className="mt-sm"><PolicyActions note={n} canMake={canMake} canApprove={canApprove} /></div>
            </li>
          ))}
        </ul>
      )}
      {canMake ? <div className="mt-md"><PolicyForm /></div> : null}
    </Panel>
  );
}
