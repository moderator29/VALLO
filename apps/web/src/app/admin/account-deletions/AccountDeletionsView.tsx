import { CalmNote, KpiGrid, PageHead, Panel, PanelUnavailable, TabRow, type KpiItem } from "../_components/panels";
import { CopyActions } from "./CopyActions";
import { RANGES, RANGE_LABEL, REASON_LABEL, csvText, summaryText, trendWords, type Aggregate, type Range } from "@/lib/admin/account-deletions/model";

export type ViewRead = { state: "ok"; aggregate: Aggregate } | { state: "not-switched-on" } | { state: "unavailable" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/**
 * WHY PEOPLE DELETE THEIR ACCOUNT, as rates. Counts and percentages only; the
 * free-text notes appear for a super admin and nobody else (`canSeeNotes`).
 * Apart from its door and read so a test can draw every state.
 */
export function AccountDeletionsView({ read, range, canSeeNotes }: { read: ViewRead; range: Range; canSeeNotes: boolean }) {
  const tabs = RANGES.map((key) => ({ key, href: `/admin/account-deletions?range=${key}`, label: RANGE_LABEL[key], active: key === range }));
  const lede = "Why members delete their account, from the optional reason they give. Counts and shares only; nothing here names a person.";

  if (read.state === "not-switched-on") {
    return (
      <div className="nf-console grid grid-cols-[minmax(0,1fr)] gap-md" data-testid="account-deletions-desk">
        <PageHead title="Account deletions" lede={lede} />
        <CalmNote
          kind="unwired"
          title="Not switched on yet"
          fills="Deletion reasons are recorded only once the table exists. Until then, deleting an account still works and nothing is lost except the reason."
          creates="Apply supabase/migrations/pending/account_deletion_reasons_2026-11-10.sql. Reasons given from then on appear here."
        />
      </div>
    );
  }
  if (read.state === "unavailable") {
    return (
      <div className="nf-console grid grid-cols-[minmax(0,1fr)] gap-md" data-testid="account-deletions-desk">
        <PageHead title="Account deletions" lede={lede} />
        <PanelUnavailable what="the deletion reasons" />
      </div>
    );
  }

  const a = read.aggregate;
  const kpis: KpiItem[] = [
    { key: "total", label: `Requests, ${RANGE_LABEL[range].toLowerCase()}`, value: String(a.total), count: a.total, caption: trendWords(a) },
    { key: "restored", label: "Restored within 30 days", value: `${a.restored} (${a.restoredPercent}%)` },
    { key: "not-given", label: "Reason not given", value: `${a.notGiven} (${a.notGivenPercent}%)` },
  ];

  return (
    <div className="nf-console grid grid-cols-[minmax(0,1fr)] gap-md break-words" data-testid="account-deletions-desk">
      <PageHead title="Account deletions" lede={lede} action={<CopyActions summary={summaryText(a)} csv={csvText(a)} disabled={a.total === 0} />} />
      <TabRow items={tabs} label="Time range" />
      {a.total === 0 ? (
        <CalmNote title="No deletion requests" fills={`Nobody asked to delete their account in this range (${RANGE_LABEL[range].toLowerCase()}).`} />
      ) : (
        <>
          <KpiGrid items={kpis} label="Deletion figures" />
          <Panel title="Reasons, most common first" id="deletion-reasons" flush>
            <ol className="grid" data-testid="deletion-reasons-table">
              {a.lines.map((line) => (
                <li key={line.code} className="grid gap-2xs border-t border-[var(--nf-border-subtle)] px-md py-sm first:border-t-0" data-testid={`deletion-reason-${line.code}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-sm">
                    <span className="min-w-0 font-semibold">{REASON_LABEL[line.code]}</span>
                    <span className="nf-numeric text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                      {line.count} · {line.percent}%
                    </span>
                  </div>
                  <span aria-hidden className="block h-2xs w-full overflow-hidden rounded-pill bg-[var(--nf-brand-quiet)]">
                    <span className="block h-full w-full origin-left rounded-pill bg-[var(--nf-brand-primary)]" style={{ transform: `scaleX(${line.percent / 100})` }} />
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          {canSeeNotes ? (
            <Panel title="Recent notes (super admin only)" id="deletion-notes">
              {a.notes.length === 0 ? (
                <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]" data-testid="deletion-notes-empty">No notes in this range.</p>
              ) : (
                <ul className="grid gap-sm" data-testid="deletion-notes">
                  {a.notes.map((note, i) => (
                    <li key={`${note.at}-${i}`} className="grid gap-2xs">
                      <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                        {dateFmt.format(new Date(note.at))} · {REASON_LABEL[note.reason]}
                      </span>
                      <span className="text-[length:var(--nf-text-body-sm)]">{note.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
