import type { Metadata } from "next";

import { CopyButton } from "@/components/docs/CopyButton";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { technicalContext } from "@/lib/admin/copilot/contexts/technical";
import { deskDoor } from "@/lib/admin/desk-door";
import { countEntries, entryRef, expiringSoon } from "@/lib/admin/desk-entries/model";
import { readEntries, readNames } from "@/lib/admin/desk-entries/queries";
import {
  INCIDENT_STATUS_LABEL,
  JOB_STATE_LABEL,
  deploymentInfo,
  SEVERITY_LABEL,
  SEVERITY_SHORT,
  summariseIncidents,
  trendWords,
  type Incident,
  type IncidentUpdate,
} from "@/lib/admin/technical/model";
import { readHealth, readIncidentUpdates, readIncidents, type Health } from "@/lib/admin/technical/queries";

import { DeskLink, DeskRefused, DeskTable, Source, shortDate, shortDateTime } from "../_components/desk-parts";
import { EntryTool } from "../_components/EntryTool";
import { Badge, CalmNote, KpiGrid, NotWired, PageHead, Panel, type BadgeTone, type KpiItem } from "../_components/panels";
import { DeclareIncident, IncidentActions } from "./TechnicalControls";

export const metadata: Metadata = { title: "Technical", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  ["health", "Health"],
  ["errors", "Errors"],
  ["incidents", "Incidents"],
  ["runbooks", "Runbooks"],
  ["releases", "Releases"],
  ["reminders", "Reminders"],
  ["handover", "On call and status"],
  ["reviews", "Reviews"],
] as const;
type Tab = (typeof TABS)[number][0];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const SEV_TONE = { sev1: "error", sev2: "error", sev3: "pending", sev4: "info" } as const;
const STATE_TONE: Record<string, BadgeTone> = { on_time: "success", late: "pending", failing: "error", no_run_seen: "info" };
const STATUS_TONE: Record<Incident["status"], BadgeTone> = { open: "error", investigating: "pending", mitigated: "info", resolved: "success" };

/**
 * THE TECHNICAL ADMINISTRATOR'S DESK (founder, 10 November 2026). Approved
 * health views, error monitoring, the incident log, runbooks, release notes,
 * expiry reminders, on-call notes, status page drafts and post-incident
 * reviews. READ ONLY about the platform: it never shows, asks for or stores a
 * key, a password or a credential, and it cannot change infrastructure. A
 * figure that could not be read says so instead of showing zero.
 */
export default async function TechnicalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await deskDoor("technical", { approverMayEnter: true });
  if (door.state !== "ok") return <DeskRefused title="Technical" state={door.state} who="This desk is for the Technical Administrator." />;

  const params = await searchParams;
  const asked = one(params.tab);
  const tab: Tab = (TABS.find(([k]) => k === asked)?.[0] ?? "health") as Tab;

  const [health, incidentsRead, updatesRead, entriesRead] = await Promise.all([
    tab === "health" || tab === "errors" ? readHealth() : Promise.resolve(null),
    readIncidents(door.db),
    tab === "incidents" ? readIncidentUpdates(door.db) : Promise.resolve(null),
    readEntries(door.db, "technical"),
  ]);
  const notOpen = incidentsRead.state === "not-open";
  const incidents = incidentsRead.state === "ok" ? incidentsRead.data : [];
  const entries = entriesRead.state === "ok" ? entriesRead.data : [];
  const updates = updatesRead && updatesRead.state === "ok" ? updatesRead.data : [];
  const names = Object.fromEntries(await readNames(door.db, [...entries.flatMap((e) => [e.approvedBy, e.createdBy]), ...incidents.map((i) => i.createdBy), ...updates.map((u) => u.authorId)]));
  const summary = summariseIncidents(incidents);
  const soon = expiringSoon(entries, 30);
  const entryCounts = countEntries(entries);
  const context = incidentsRead.state === "ok"
    ? technicalContext({
        openIncidents: summary.open,
        sev1or2Open: summary.sev1or2Open,
        lateJobs: health?.jobs ? health.jobs.filter((j) => j.state === "late").length : null,
        failingJobs: health?.jobs ? health.jobs.filter((j) => j.state === "failing").length : null,
        openErrorTypes: health?.crashes.open ?? null,
        errorsLast24h: health?.crashes.last24h ?? null,
        openAlerts: health?.openAlerts ?? null,
        remindersDueSoon: soon.length,
      })
    : null;
  const canMake = !door.viaApprover;
  const common = { entries, canMake, canApprove: door.canApprove, names, readable: entriesRead.state === "ok" } as const;

  return (
    <div className="nf-console nf-admin-stack">
      <PageHead
        title="Technical"
        lede="How the platform is doing, the record of what went wrong and what was done, and the notes that keep the next person from starting cold. This desk is read only: it shows no key, password or credential and changes no infrastructure."
        action={<DeskLink href="/admin/operations/providers">Provider checks</DeskLink>}
      />
      {notOpen ? (
        <Panel><NotWired what="The incident tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." /></Panel>
      ) : incidentsRead.state === "error" ? (
        <Panel><CalmNote kind="error" title="The incident log could not be read" fills="Nothing was changed. Refresh in a moment." /></Panel>
      ) : null}
      {entriesRead.state === "not-open" && !notOpen ? (
        <Panel><NotWired what="The runbook, release and reminder tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." /></Panel>
      ) : null}
      {door.viaApprover ? (
        <Panel><p className="nf-body-sm text-[var(--nf-content-secondary)]">You are here to read, and to approve a status page draft. The Technical Administrator keeps the log.</p></Panel>
      ) : null}
      {soon.length > 0 ? (
        <Panel title="Running out soon">
          <ul className="nf-body-sm grid gap-3xs">{soon.slice(0, 5).map((e) => <li key={e.id}>{e.title}: {shortDate(e.dueOn)}</li>)}</ul>
          <DeskLink href="/admin/technical?tab=reminders">All reminders</DeskLink>
        </Panel>
      ) : null}
      <UnderlineTabs label="Technical desk" active={tab} items={TABS.map(([key, label]) => ({ key, label, href: key === "health" ? "/admin/technical" : `/admin/technical?tab=${key}` }))} />

      {tab === "health" && health ? <HealthPanel health={health} /> : null}
      {tab === "errors" && health ? <ErrorsPanel health={health} /> : null}
      {tab === "incidents" ? <Incidents incidents={incidents} updates={updates} names={names} canMake={canMake} readable={incidentsRead.state === "ok"} summary={summary} /> : null}
      {tab === "runbooks" ? <Panel title="Runbooks"><EntryTool kind="runbook" {...common} /></Panel> : null}
      {tab === "releases" ? (
        <div className="grid gap-lg">
          <Panel title="What is running"><ReleaseNow /></Panel>
          <Panel title="Release notes"><EntryTool kind="release_note" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "reminders" ? <Panel title="Expiry reminders"><EntryTool kind="reminder" {...common} /></Panel> : null}
      {tab === "handover" ? (
        <div className="grid gap-lg">
          <Panel title="On-call notes"><EntryTool kind="oncall_note" {...common} /></Panel>
          <Panel title={`Status page drafts${entryCounts.waitingApproval > 0 ? ` (${entryCounts.waitingApproval} waiting)` : ""}`}><EntryTool kind="status_draft" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "reviews" ? <Panel title="Post-incident reviews"><EntryTool kind="incident_review" {...common} /></Panel> : null}
      <DeskCopilot scope="technical" deskName="Technical" context={context} />
    </div>
  );
}

function ReleaseNow() {
  const info = deploymentInfo(process.env);
  return (
    <>
      <dl className="grid gap-xs sm:grid-cols-3">
        <div><dt className="nf-caption text-[var(--nf-content-secondary)]">Environment</dt><dd className="nf-body-sm">{info.environment}</dd></div>
        <div>
          <dt className="nf-caption text-[var(--nf-content-secondary)]">Release code</dt>
          <dd className="nf-body-sm">{info.release ? <>{info.release} <CopyButton text={info.release} label="Release code" /></> : "Not available here"}</dd>
        </div>
        <div><dt className="nf-caption text-[var(--nf-content-secondary)]">Runtime</dt><dd className="nf-body-sm">{info.runtime}</dd></div>
      </dl>
      <Source>That is all the console says about a deployment. Build settings, keys and infrastructure are not shown here.</Source>
    </>
  );
}

function HealthPanel({ health }: { health: Health }) {
  const jobs = health.jobs;
  const kpis: KpiItem[] = [
    { key: "late", label: "Jobs late", value: jobs ? String(jobs.filter((j) => j.state === "late").length) : null, ...(jobs ? { count: jobs.filter((j) => j.state === "late").length } : {}) },
    { key: "fail", label: "Jobs whose last run failed", value: jobs ? String(jobs.filter((j) => j.state === "failing").length) : null, ...(jobs ? { count: jobs.filter((j) => j.state === "failing").length } : {}) },
    { key: "err", label: "Open error types", value: health.crashes.open === null ? null : String(health.crashes.open), ...(health.crashes.open !== null ? { count: health.crashes.open } : {}), caption: health.crashes.last24h === null ? undefined : `${health.crashes.last24h} seen in 24 hours` },
    { key: "alerts", label: "Open alerts", value: health.openAlerts === null ? null : String(health.openAlerts), ...(health.openAlerts !== null ? { count: health.openAlerts } : {}) },
  ];
  return (
    <div className="grid gap-lg">
      <KpiGrid items={kpis} label="Platform health" />
      <Panel title="Scheduled jobs" flush>
        {jobs === null ? (
          <div className="p-md"><CalmNote kind="error" title="The job history could not be read" fills="Nothing is shown rather than a clean list. Refresh in a moment." /></div>
        ) : (
          <DeskTable
            caption="Scheduled jobs: newest run and outcomes over the last 14 days"
            columns={[{ key: "job", label: "Job" }, { key: "state", label: "State" }, { key: "last", label: "Newest run" }, { key: "outcomes", label: "Ok, attention, failed", numeric: true }]}
            rows={jobs.map((j) => ({
              key: j.name,
              cells: {
                job: <span>{j.name} <span className="nf-caption text-[var(--nf-content-secondary)]">{j.schedule}</span></span>,
                state: <Badge tone={STATE_TONE[j.state] ?? "info"}>{JOB_STATE_LABEL[j.state]}</Badge>,
                last: j.lastAt ? shortDateTime(j.lastAt) : "None in 14 days",
                outcomes: `${j.ok}, ${j.attention}, ${j.failed}`,
              },
            }))}
          />
        )}
      </Panel>
      <Panel title="Services configured">
        <ul className="nf-body-sm grid gap-3xs">
          {health.providers.map((p) => (
            <li key={p.name}>{p.name}: {p.configured ? "set up" : "not set up"}</li>
          ))}
        </ul>
        <Source>This says whether a connection is set up, never what its key is. To test a provider live, use Provider checks.</Source>
      </Panel>
      <Panel title="What is running"><ReleaseNow /></Panel>
    </div>
  );
}

function ErrorsPanel({ health }: { health: Health }) {
  const c = health.crashes;
  const words = c.daily ? trendWords(c.daily) : null;
  return (
    <div className="grid gap-lg">
      <Panel title="Error types seen, by day" flush>
        {c.daily === null ? (
          <div className="p-md"><CalmNote kind="error" title="The crash log could not be read" fills="Nothing is shown rather than a zero. Refresh in a moment." /></div>
        ) : (
          <DeskTable
            caption="Error types last seen on each day, Lagos time"
            columns={[{ key: "day", label: "Day" }, { key: "n", label: "Error types seen", numeric: true }]}
            rows={c.daily.slice().reverse().map((d) => ({ key: d.day, cells: { day: shortDate(d.day), n: String(d.count) } }))}
          />
        )}
        {words ? <div className="p-md"><p className="nf-body-sm">{words}</p></div> : null}
      </Panel>
      <Panel title="Open error types, most frequent first" flush>
        {c.groups === null ? (
          <div className="p-md"><p className="nf-body-sm">Could not be read just now.</p></div>
        ) : c.groups.length === 0 ? (
          <div className="p-md"><p className="nf-body-sm">No open error types.</p></div>
        ) : (
          <DeskTable
            caption="Open error types"
            columns={[{ key: "type", label: "Error type" }, { key: "where", label: "Where" }, { key: "release", label: "Release" }, { key: "n", label: "Times", numeric: true }, { key: "last", label: "Last seen" }]}
            rows={c.groups.slice(0, 15).map((g, i) => ({ key: `${i}-${g.source}-${g.type}`, cells: { type: g.type, where: `${g.source}${g.area ? `, ${g.area}` : ""}`, release: g.release ?? "Not stated", n: String(g.occurrences), last: shortDateTime(g.lastSeenAt) } }))}
          />
        )}
      </Panel>
      <Source>Counts, error types and places only. The message, the stack and the people affected stay in the Crash log under Operations.</Source>
    </div>
  );
}

function Incidents({ incidents, updates, names, canMake, readable, summary }: { incidents: Incident[]; updates: IncidentUpdate[]; names: Record<string, string>; canMake: boolean; readable: boolean; summary: ReturnType<typeof summariseIncidents> }) {
  const kpis: KpiItem[] = [
    { key: "open", label: "Open incidents", value: readable ? String(summary.open) : null, ...(readable ? { count: summary.open } : {}), caption: readable ? `${summary.sev1or2Open} severity 1 or 2` : undefined },
    { key: "month", label: "Resolved this month", value: readable ? String(summary.resolvedThisMonth) : null, ...(readable ? { count: summary.resolvedThisMonth } : {}) },
    { key: "mttr", label: "Median hours to resolve", value: summary.medianHoursToResolve === null ? null : String(summary.medianHoursToResolve), caption: "Resolved in the last 30 days" },
  ];
  return (
    <div className="grid gap-lg">
      <KpiGrid items={kpis} label="Incident figures" />
      {incidents.length === 0 && readable ? (
        <Panel><CalmNote title="No incidents logged" fills="Every incident is declared, updated and resolved here, in plain words." creates={canMake ? "Declare one below when something goes wrong." : undefined} /></Panel>
      ) : (
        <ul className="grid gap-sm">
          {incidents.map((i) => (
            <li key={i.id} className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="technical-incident">
              <div className="flex flex-wrap items-center gap-xs">
                <span className="font-semibold text-[var(--nf-content-primary)] break-words">{i.title}</span>
                <Badge tone={SEV_TONE[i.severity]}>{SEVERITY_SHORT[i.severity]}</Badge>
                <Badge tone={STATUS_TONE[i.status]}>{INCIDENT_STATUS_LABEL[i.status]}</Badge>
              </div>
              <p className="nf-caption mt-3xs flex flex-wrap items-center gap-xs text-[var(--nf-content-secondary)]">
                <span>{entryRef("incident", i.id)}</span>
                <CopyButton text={entryRef("incident", i.id)} label="Reference" />
                <span>Started {shortDateTime(i.startedAt)}</span>
                {i.resolvedAt ? <span>Resolved {shortDateTime(i.resolvedAt)}</span> : null}
              </p>
              <p className="nf-caption mt-3xs text-[var(--nf-content-secondary)]">{SEVERITY_LABEL[i.severity]}</p>
              {i.summary ? <p className="nf-body-sm mt-xs whitespace-pre-wrap break-words">{i.summary}</p> : null}
              {i.resolutionSummary ? <p className="nf-body-sm mt-xs whitespace-pre-wrap break-words"><strong>Resolution.</strong> {i.resolutionSummary}</p> : null}
              {updates.filter((u) => u.incidentId === i.id).length > 0 ? (
                <ol className="nf-body-sm mt-sm grid gap-3xs">
                  {updates.filter((u) => u.incidentId === i.id).map((u) => (
                    <li key={u.id} className="break-words">
                      <span className="nf-caption text-[var(--nf-content-secondary)]">{shortDateTime(u.createdAt)}{u.authorId && names[u.authorId] ? `, ${names[u.authorId]}` : ""}{u.statusAfter ? `, now ${INCIDENT_STATUS_LABEL[u.statusAfter].toLowerCase()}` : ""}</span>
                      <br />
                      {u.body}
                    </li>
                  ))}
                </ol>
              ) : null}
              {canMake ? <div className="mt-sm"><IncidentActions incident={i} /></div> : null}
            </li>
          ))}
        </ul>
      )}
      {canMake ? <Panel title="Declare an incident"><DeclareIncident /></Panel> : null}
    </div>
  );
}
