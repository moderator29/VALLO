import "@/app/css/chargebacks.css";
import "../money/_desk/desk.css";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { formatMoney } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import { StatusPill } from "@/components/ui/StatusPill";
import { dateTimeLabel } from "@/lib/format/when";
import {
  deadlineOf,
  holdsPayouts,
  movesFor,
  outstandingMinor,
  type TimelineEntry,
} from "@/lib/admin/reads/chargebacks-model";
import type { ChargebackDetail } from "@/lib/admin/reads/chargebacks";
import { Panel } from "../money/_desk/Desk";
import { CHARGEBACKS_BASE, RECOVERY_TONE, STATE_TONE } from "./ChargebacksDesk";
import { ChargebackNoteForm, HeldPayments, MoveButtons } from "./ChargebackActions";

/**
 * ONE CHARGEBACK (`/admin/chargebacks/<id>`): the record first, the
 * decision after it.
 *
 * The head carries the disputed amount, the state and the recovery. Then the
 * case (the payment reference, the partner and its dispute id and status, the
 * dates and the evidence deadline), the money (disputed, recovered, still
 * owed), who it involves (the stay or agreement, the payer and the lister,
 * each linked to their file), and the timeline from `chargeback_events`
 * with every note staff gave. Beside it on a wide screen, below it on a
 * phone: the next moves this state allows, each through a confirm sheet
 * with a required reason, and the evidence notes.
 */

type Copy = Dictionary["chargebacks"]["desk"];
type OverrideCopy = Dictionary["chargebacks"]["override"];

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function dotClass(entry: TimelineEntry): string {
  if (entry.kind === "note") return "nf-cb-timeline__dot nf-cb-timeline__dot--note";
  if (entry.kind === "transition" && entry.to === "won") return "nf-cb-timeline__dot nf-cb-timeline__dot--won";
  if (entry.kind === "transition" && entry.to === "lost") return "nf-cb-timeline__dot nf-cb-timeline__dot--lost";
  return "nf-cb-timeline__dot";
}

export function ChargebackCase({
  detail,
  now,
  copy,
  overrideCopy,
  locale,
}: {
  detail: ChargebackDetail;
  now: number;
  copy: Copy;
  overrideCopy: OverrideCopy;
  locale: Locale;
}) {
  const d = copy.detail;
  const f = d.fields;
  const { row, timeline } = detail;
  const when = (iso: string) => dateTimeLabel(iso, { now: new Date(now), locale });
  const money = (minor: number) => <Amount minorUnits={minor} currency={row.currency} locale={locale} showFraction />;
  const deadline = deadlineOf(row, now);
  const offers = movesFor(row);
  const person = (id: string | null, name: string | null) =>
    id ? (
      <Link href={`/admin/people/${id}`} className="underline underline-offset-2">
        {name ?? copy.unnamed}
      </Link>
    ) : (
      d.notSet
    );

  const headline = (entry: TimelineEntry): string => {
    if (entry.kind === "transition" && entry.from && entry.from !== entry.to) {
      return d.moved.replace("{from}", copy.states[entry.from]).replace("{to}", copy.states[entry.to]);
    }
    if (entry.kind === "transition" && entry.recovery) return d.recoveryLine.replace("{state}", copy.recovery[entry.recovery]);
    return d.kinds[entry.kind];
  };

  return (
    <div className="nf-console nf-md" data-testid="admin-chargeback">
      <Link href={CHARGEBACKS_BASE} className="nf-chip mb-md inline-flex w-fit items-center gap-2xs">
        {d.back}
      </Link>

      <header>
        <p className="nf-caption text-[var(--nf-content-secondary)]">{d.overline}</p>
        <h1 className="nf-h1 mt-3xs [overflow-wrap:anywhere]">{row.reference || row.providerDisputeId}</h1>
        <div className="nf-cb-hero">
          <span className="nf-cb-hero__amount" data-testid="chargeback-amount">
            <Amount minorUnits={row.amountMinor} currency={row.currency} locale={locale} showFraction />
          </span>
          <span className="flex flex-wrap gap-xs">
            <StatusPill tone={STATE_TONE[row.state]}>{copy.states[row.state]}</StatusPill>
            {row.state === "lost" ? <StatusPill tone={RECOVERY_TONE[row.recoveryState]}>{copy.recovery[row.recoveryState]}</StatusPill> : null}
            {deadline === "overdue" ? <StatusPill tone="danger">{copy.overdue.replace("{when}", when(row.evidenceDueAt!))}</StatusPill> : null}
          </span>
        </div>
      </header>

      <div className="nf-cb-case">
        <div className="grid gap-[var(--nf-gap-block)]">
          <Panel title={d.sections.case}>
            <dl className="nf-cb-facts">
              <Fact label={f.reference}>
                <span className="font-mono [user-select:all]">{row.reference || d.notSet}</span>
              </Fact>
              <Fact label={f.provider}>{copy.open.providers[row.provider as "paystack"] ?? row.provider}</Fact>
              <Fact label={f.disputeId}>
                <span className="font-mono [user-select:all]">{row.providerDisputeId}</span>
              </Fact>
              <Fact label={f.providerStatus}>{row.providerStatus ?? d.notSet}</Fact>
              <Fact label={f.opened}>{when(row.openedAt)}</Fact>
              <Fact label={f.due}>
                {row.evidenceDueAt ? (
                  <span className={deadline === "overdue" ? "nf-cb-due--overdue" : undefined}>{when(row.evidenceDueAt)}</span>
                ) : (
                  copy.noDeadline
                )}
              </Fact>
              {row.closedAt ? <Fact label={f.decided}>{when(row.closedAt)}</Fact> : null}
            </dl>
          </Panel>

          <Panel title={d.sections.money}>
            <dl className="nf-cb-facts">
              <Fact label={f.amount}>{money(row.amountMinor)}</Fact>
              <Fact label={f.recovery}>{copy.recovery[row.recoveryState]}</Fact>
              {row.state === "lost" ? <Fact label={f.recovered}>{money(row.recoveredMinor)}</Fact> : null}
              {holdsPayouts(row) ? <Fact label={f.outstanding}>{money(outstandingMinor(row))}</Fact> : null}
              {row.recoveryClosedAt ? <Fact label={f.recoveryClosed}>{when(row.recoveryClosedAt)}</Fact> : null}
            </dl>
            {row.listerUnattributed || !row.listerId ? (
              <p className="nf-cb-note" data-testid="chargeback-unattributed">
                {d.unattributedNote}
              </p>
            ) : holdsPayouts(row) ? (
              <p className="nf-cb-note" data-testid="chargeback-hold-note">
                {d.holdNote}
              </p>
            ) : null}
          </Panel>

          <Panel title={d.sections.people}>
            <dl className="nf-cb-facts">
              {row.bookingId ? (
                <Fact label={f.booking}>
                  <Link href={`/admin/bookings/${row.bookingId}`} className="font-mono underline underline-offset-2">
                    {row.bookingId.slice(0, 8)}
                  </Link>
                </Fact>
              ) : null}
              {row.agreementId ? (
                <Fact label={f.agreement}>
                  <span className="font-mono">{row.agreementId.slice(0, 8)}</span>
                </Fact>
              ) : null}
              {row.listingTitle ? <Fact label={f.listing}>{row.listingTitle}</Fact> : null}
              <Fact label={f.payer}>{person(row.payerId, row.payerName)}</Fact>
              <Fact label={f.lister}>
                {row.listerUnattributed || !row.listerId ? copy.unattributed : person(row.listerId, row.listerName)}
              </Fact>
            </dl>
            <p className="mt-sm">
              <Link
                href={`/admin/payments?q=${encodeURIComponent(row.reference)}`}
                className="inline-flex min-h-11 items-center text-[length:var(--nf-text-caption)] font-semibold underline underline-offset-2"
              >
                {d.paymentsLink}
              </Link>
            </p>
          </Panel>

          <Panel title={d.sections.timeline} hint={d.timelineCount.replace("{count}", String(timeline.length))}>
            {detail.timelineSource === "audit" ? (
              <p className="nf-cb-note nf-cb-note--info mb-sm mt-0">{d.timelineFallback}</p>
            ) : null}
            {timeline.length === 0 ? (
              <p className="nf-caption text-[var(--nf-content-muted)]">{d.timelineEmpty}</p>
            ) : (
              <ol className="nf-cb-timeline" data-testid="chargeback-timeline">
                {timeline.map((entry) => (
                  <li key={entry.id} data-kind={entry.kind}>
                    <span className={dotClass(entry)} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="nf-cb-timeline__head">{headline(entry)}</p>
                      <p className="nf-cb-timeline__meta">
                        {when(entry.at)} · {entry.actorId ? (entry.actorName ?? d.byStaff) : d.byPartner}
                        {entry.recoveredMinor !== null ? ` · ${d.recoveredLine.replace("{amount}", formatMoney(entry.recoveredMinor, locale, row.currency))}` : ""}
                        {entry.evidenceDueAt ? ` · ${d.dueLine.replace("{when}", when(entry.evidenceDueAt))}` : ""}
                        {entry.hasRaw ? ` · ${d.rawStored}` : ""}
                      </p>
                      {entry.note ? <p className="nf-cb-timeline__note">{entry.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-sm">
              <Link
                href={`/admin/audit?who=all&q=${row.id}`}
                className="inline-flex min-h-11 items-center text-[length:var(--nf-text-caption)] font-semibold underline underline-offset-2"
              >
                {d.auditLink}
              </Link>
            </p>
          </Panel>
        </div>

        <aside className="nf-cb-case__side">
          <Panel title={d.sections.moves}>
            <MoveButtons
              row={{
                id: row.id,
                state: row.state,
                recoveryState: row.recoveryState,
                recoveredMinor: row.recoveredMinor,
                amountMinor: row.amountMinor,
                currency: row.currency,
              }}
              offers={offers}
              copy={copy}
              locale={locale}
            />
          </Panel>
          {holdsPayouts(row) && row.listerId && !row.listerUnattributed ? (
            <Panel title={overrideCopy.title} hint={overrideCopy.hint}>
              <HeldPayments held={detail.held} copy={overrideCopy} deskCopy={copy} locale={locale} currency={row.currency} />
            </Panel>
          ) : null}
          <Panel title={d.sections.notes}>
            {detail.notesOpen ? (
              <>
                {timeline.some((e) => e.kind === "note") ? null : <p className="nf-caption text-[var(--nf-content-muted)]">{d.notesEmpty}</p>}
                <ChargebackNoteForm chargebackId={row.id} copy={copy} />
              </>
            ) : (
              <p className="nf-caption text-[var(--nf-content-muted)]" data-testid="chargeback-notes-pending">
                {d.notesPending}
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
