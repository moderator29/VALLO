import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { plural } from "@vallo/i18n/core";

import { BackButton } from "@/components/site/BackButton";
import {
  CATEGORY_LABEL,
  MODULE_LABEL,
  RESOLUTION_LABEL,
  RESTRICTION_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  caseNumber,
  type CaseCategory,
  type CaseDetail,
  type CaseEvent,
} from "@/lib/admin/cases/model";
import { readCase } from "@/lib/admin/cases/queries";
import { getLocale } from "@/lib/locale";

import { Badge, PageHead, Panel, PanelEmpty, type BadgeTone } from "../../_components/panels";
import { adminUi } from "../../_components/ui";
import { DeskRefusal } from "../DeskRefusal";
import { CaseActions, EvidenceOpen, EvidenceUpload, LiftButton } from "./CaseActions";

export const metadata: Metadata = { title: "Case", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = { new: "info", under_review: "pending", awaiting_info: "pending", escalated: "error", resolved: "success", closed: "info" };
const SEVERITY_TONE: Record<string, BadgeTone> = { critical: "error", high: "error", medium: "pending", low: "info" };

const EVENT_WORD: Record<CaseEvent["kind"], string> = {
  opened: "Case opened from a report",
  report_added: "Another report added",
  note: "Internal note",
  status: "Status changed",
  assigned: "Assigned",
  escalated: "Escalated",
  action: "Action taken",
  message: "Message sent to a member",
  evidence: "Evidence added",
  resolved: "Resolved",
  reopened: "Reopened",
  appeal: "Appeal",
};

/**
 * /admin/cases/[id]: ONE CASE, everything needed to decide it on one screen.
 * What was reported (read by the database, never a private thread beyond the
 * reported item itself), the reports, the timeline of every note and action,
 * the evidence, and the member's history. The actions panel offers only what
 * this person's scope allows, and the database checks every one again.
 */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);
  const read = await readCase(id);
  if (read.state !== "ok") return <DeskRefusal title="Case" state={read.state} />;
  const c = read.data;
  if (!c) {
    return (
      <div className="nf-console flex flex-col gap-xl">
        <PageHead title="Case" lead={<BackButton fallback="/admin/cases" surface="round" />} />
        <PanelEmpty title="Case not found" body="It may not exist, or your role does not open cases in its module." />
      </div>
    );
  }

  const reporters = c.reports.map((r) => r.reporter).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const activeRestrictions = c.subjectHistory?.restrictions.filter((r) => r.active) ?? [];

  return (
    <div className="nf-console flex flex-col gap-xl" data-testid="admin-case">
      <PageHead
        lead={<BackButton fallback="/admin/cases" surface="round" />}
        title={caseNumber(c.number)}
        lede={c.targetLabel ?? CATEGORY_LABEL[c.category as CaseCategory] ?? c.category}
        trail={
          <span className="flex flex-wrap items-center gap-xs">
            <Badge tone={STATUS_TONE[c.status] ?? "info"} solid={c.status === "escalated"}>
              {c.overdue ? `${STATUS_LABEL[c.status]}, overdue` : STATUS_LABEL[c.status]}
            </Badge>
            <Badge tone={SEVERITY_TONE[c.severity] ?? "info"}>{SEVERITY_LABEL[c.severity]}</Badge>
            <Badge tone="info">{MODULE_LABEL[c.module]}</Badge>
          </span>
        }
      />

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-lg">
          <Panel title="What was reported">
            <ContextView c={c} />
          </Panel>

          <Panel title={`Reports (${c.reports.length})`}>
            <ul className="flex flex-col gap-sm">
              {c.reports.map((r) => (
                <li key={r.id} className="flex flex-col gap-2xs border-b border-[var(--nf-border-subtle)] pb-sm last:border-0">
                  <span className="text-[length:var(--nf-text-body-sm)] font-semibold">
                    {CATEGORY_LABEL[(r.category ?? "other") as CaseCategory] ?? r.category} · {r.reporter?.name ?? "A member"}
                  </span>
                  {r.reason ? <span className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{r.reason}</span> : null}
                  <span className="nf-caption text-[var(--nf-content-muted)]">{ui.when(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Timeline">
            <ol className="flex flex-col gap-sm" data-testid="case-timeline">
              {c.events.map((e) => (
                <li key={e.id} className="flex flex-col gap-2xs border-l-2 border-[var(--nf-border-subtle)] pl-sm" data-kind={e.kind}>
                  <span className="text-[length:var(--nf-text-body-sm)] font-semibold">
                    {EVENT_WORD[e.kind]}
                    {eventDetail(e)}
                  </span>
                  {e.body ? <span className="whitespace-pre-wrap text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{e.body}</span> : null}
                  <span className="nf-caption text-[var(--nf-content-muted)]">
                    {e.actor?.name ?? "Vallo"} · {ui.when(e.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Evidence" action={c.can.note ? <EvidenceUpload caseId={c.id} /> : undefined}>
            {c.evidence.length === 0 ? (
              <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">No files on this case. Screenshots and documents you add are kept private to staff.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {c.evidence.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-sm">
                    <span className="min-w-0 text-[length:var(--nf-text-body-sm)]">
                      {ev.note ?? "File"} <span className="nf-caption text-[var(--nf-content-muted)]">· {ev.addedBy?.name ?? "Staff"} · {ui.when(ev.createdAt)}</span>
                    </span>
                    <EvidenceOpen caseId={c.id} evidenceId={ev.id} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-lg">
          <Panel title="Case">
            <dl className="grid grid-cols-[auto_1fr] gap-x-sm gap-y-xs text-[length:var(--nf-text-body-sm)]">
              <dt className="text-[var(--nf-content-muted)]">Due</dt>
              <dd className={c.overdue ? "font-semibold text-[var(--nf-state-error)]" : ""}>{ui.when(c.dueAt)}</dd>
              <dt className="text-[var(--nf-content-muted)]">Owner</dt>
              <dd>{c.assignee?.name ?? "Not assigned"}</dd>
              <dt className="text-[var(--nf-content-muted)]">Team</dt>
              <dd>{c.team.replace("_", " ")}</dd>
              <dt className="text-[var(--nf-content-muted)]">Opened</dt>
              <dd>{ui.when(c.createdAt)}</dd>
              {c.escalationReason ? (
                <>
                  <dt className="text-[var(--nf-content-muted)]">Escalated</dt>
                  <dd>{c.escalationReason}</dd>
                </>
              ) : null}
              {c.resolution ? (
                <>
                  <dt className="text-[var(--nf-content-muted)]">Outcome</dt>
                  <dd>
                    {RESOLUTION_LABEL[c.resolution]}
                    {c.resolutionNote ? `: ${c.resolutionNote}` : ""}
                  </dd>
                </>
              ) : null}
            </dl>
          </Panel>

          <CaseActions
            caseId={c.id}
            status={c.status}
            can={c.can}
            targetType={c.targetType}
            subject={c.subject}
            reporters={reporters}
          />

          <Panel title="The member reported">
            {!c.subject ? (
              <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">This report is not about a member.</p>
            ) : (
              <div className="flex flex-col gap-sm text-[length:var(--nf-text-body-sm)]">
                <span className="font-semibold">
                  {c.subject.name}
                  {c.subject.handle ? <span className="text-[var(--nf-content-muted)]"> · @{c.subject.handle}</span> : null}
                </span>
                <Link className="nf-link" href={`/admin/people/${c.subject.userId}`}>
                  Open in People
                </Link>
                {c.subjectHistory ? (
                  <span className="text-[var(--nf-content-secondary)]">
                    Member since {ui.when(c.subjectHistory.memberSince)} · {plural(c.subjectHistory.cases, { one: "{count} other case", other: "{count} other cases" })}, {c.subjectHistory.upheld} upheld
                  </span>
                ) : null}
                {c.subjectHistory?.restrictions.length ? (
                  <ul className="flex flex-col gap-xs">
                    {c.subjectHistory.restrictions.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-sm">
                        <span>
                          <span className="font-semibold">{RESTRICTION_LABEL[r.kind]}</span>
                          <span className="block text-[var(--nf-content-muted)]">
                            {r.active ? (r.endsAt ? `Until ${ui.when(r.endsAt)}` : "Until lifted") : r.liftedAt ? "Lifted" : "Ended"} · {r.reason}
                          </span>
                        </span>
                        {r.active && (c.can.restrict || c.can.suspend) ? <LiftButton restrictionId={r.id} caseId={c.id} /> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[var(--nf-content-muted)]">No restrictions on record.</span>
                )}
                {activeRestrictions.length === 0 ? null : (
                  <span className="nf-caption text-[var(--nf-content-muted)]">A lifted restriction tells the member at once.</span>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function eventDetail(e: CaseEvent): string {
  const d = e.data as Record<string, unknown>;
  if (e.kind === "status" && typeof d.to === "string") return `: ${STATUS_LABEL[d.to as keyof typeof STATUS_LABEL] ?? d.to}`;
  if (e.kind === "assigned" && d.toPerson && typeof d.toPerson === "object") return ` to ${(d.toPerson as { name?: string }).name ?? "a colleague"}`;
  if (e.kind === "action" && typeof d.action === "string") return `: ${d.action.replace(/_/g, " ")}${typeof d.kind === "string" ? ` (${d.kind})` : ""}`;
  if (e.kind === "resolved" && typeof d.resolution === "string") return `: ${RESOLUTION_LABEL[d.resolution as keyof typeof RESOLUTION_LABEL] ?? d.resolution}`;
  if (e.kind === "message" && d.toPerson && typeof d.toPerson === "object") return ` to ${(d.toPerson as { name?: string }).name ?? "a member"}`;
  return "";
}

function ContextView({ c }: { c: CaseDetail }) {
  const x = c.context as Record<string, unknown>;
  if (x.gone) return <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">The reported item no longer exists.</p>;
  const line = (label: string, value: unknown) =>
    value === null || value === undefined || value === "" ? null : (
      <div className="flex flex-col">
        <dt className="nf-caption text-[var(--nf-content-muted)]">{label}</dt>
        <dd className="whitespace-pre-wrap text-[length:var(--nf-text-body-sm)]">{String(value)}</dd>
      </div>
    );
  const members = Array.isArray(x.members) ? (x.members as { name: string; role?: string; state?: string }[]) : [];
  const board = Array.isArray(x.board) ? (x.board as { author?: { name?: string }; body: string; createdAt: string }[]) : [];
  return (
    <div className="flex flex-col gap-sm">
      <dl className="grid gap-sm sm:grid-cols-2">
        {line("Kind", String(x.kind ?? c.targetType).replace(/_/g, " "))}
        {line("Title", x.title ?? x.name)}
        {line("Status", x.status)}
        {line("Where", [x.area, x.city].filter(Boolean).join(", "))}
        {line("Listed by", x.authority ? `Declared: ${String(x.authority).replace(/_/g, " ")}` : null)}
        {line("Verified by Vallo", typeof x.verified === "boolean" ? (x.verified ? "Yes" : "No") : null)}
        {line("Life stage", x.lifeStage)}
        {line("Interests sent in 24 hours", x.interestsSent24h)}
        {line("Stage", x.stage)}
      </dl>
      {line("Text", x.body ?? x.description ?? x.intro)}
      {members.length ? (
        <div>
          <p className="nf-caption text-[var(--nf-content-muted)]">Members</p>
          <p className="text-[length:var(--nf-text-body-sm)]">{members.map((m) => `${m.name}${m.role === "owner" ? " (owner)" : ""}${m.state && m.state !== "active" ? ` (${m.state})` : ""}`).join(", ")}</p>
        </div>
      ) : null}
      {board.length ? (
        <div>
          <p className="nf-caption text-[var(--nf-content-muted)]">Group board (shown because the group itself was reported)</p>
          <ul className="flex flex-col gap-xs">
            {board.slice(0, 20).map((b, i) => (
              <li key={i} className="text-[length:var(--nf-text-body-sm)]">
                <span className="font-semibold">{b.author?.name ?? "Member"}:</span> {b.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {typeof x.href === "string" ? (
        <Link className="nf-link text-[length:var(--nf-text-body-sm)]" href={x.href}>
          Open it on Vallo
        </Link>
      ) : null}
    </div>
  );
}
