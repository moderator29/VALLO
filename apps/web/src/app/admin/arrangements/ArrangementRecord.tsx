import Link from "next/link";
import { formatMoney, getDictionary, type Locale } from "@vallo/i18n";
import { adminUi } from "../_components/ui";
import { PageHead, Panel, PanelEmpty, PanelUnavailable } from "../_components/panels";
import { ArrangementDecision } from "./ArrangementDecision";
import type { ArrangementRecordRead } from "./read-one";

/**
 * MONEY > PROTECTED PAYMENTS > ONE PAYMENT: THE DISPUTE DESK (BUILD 7.11).
 *
 * The record a decision is made on: who pays and who is paid, the amount,
 * what the provider last said, and the payment's whole trail with each
 * side's statement in their own words. Below it, and only while the money is
 * held or disputed, the two decisions staff may make. The list desk stays
 * read-only; this is the one page that instructs the provider.
 */
const COPY = {
  title: "Protected payment",
  back: "All protected payments",
  forbidden: "This desk is open to admins and to staff holding the finance scope.",
  forbiddenTitle: "Finance only",
  notFoundTitle: "No such payment",
  notFoundBody: "That protected payment is not on record.",
  facts: "The payment",
  payer: "Payer",
  lister: "Lister",
  amount: "Amount",
  state: "Vallo's record",
  provider: "Partner said",
  providerRef: "Partner reference",
  unnamed: "Not named",
  notReported: "Not reported",
  trail: "The trail",
  trailEmpty: "Nothing has been recorded on this payment yet.",
  notRecorded: "not recorded",
  decide: "Decide this payment",
  decideLede: "The partner holds the money and moves it only on Vallo's instruction. A decision here sends that instruction; the record changes when the partner reports the outcome.",
  nothingTitle: "No decision to make",
  nothingBody: "A decision is made only while the money is held or the payment is disputed.",
} as const;

export function ArrangementRecord({ read, locale }: { read: ArrangementRecordRead; locale: Locale }) {
  const ui = adminUi(getDictionary(locale), locale);
  const back = (
    <Link href="/admin/arrangements" className="nf-admin-panel__link" data-testid="arrangement-back">
      {COPY.back}
    </Link>
  );
  if (read.state === "forbidden") {
    return (
      <div className="nf-admin-stack">
        <PageHead title={COPY.title} lede={COPY.forbidden} />
        <PanelEmpty title={COPY.forbiddenTitle} body={COPY.forbidden} />
      </div>
    );
  }
  if (read.state !== "ok") {
    return (
      <div className="nf-admin-stack">
        <PageHead title={COPY.title} lead={back} />
        {read.state === "not_found" ? <PanelEmpty title={COPY.notFoundTitle} body={COPY.notFoundBody} /> : <PanelUnavailable what={COPY.title} locale={locale} />}
      </div>
    );
  }
  const { row } = read;
  const canRefund = row.status === "protected" || row.status === "disputed";
  const canRelease = row.status === "disputed";
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: COPY.amount, value: <span className="nf-numeric">{formatMoney(row.amountMinor, locale, "NGN")}</span> },
    { label: COPY.payer, value: read.payerName ?? COPY.unnamed },
    { label: COPY.lister, value: read.listerName ?? COPY.unnamed },
    { label: COPY.state, value: `${row.status.replace(/_/g, " ")}${row.statusSource ? `, from ${row.statusSource.replace(/_/g, " ")}, ${ui.when(row.statusObservedAt)}` : ""}` },
    { label: COPY.provider, value: [row.providerState, row.providerStatus].filter(Boolean).join(" / ") || COPY.notReported },
    ...(row.providerReference ? [{ label: COPY.providerRef, value: <span className="font-mono break-words">{row.providerReference}</span> }] : []),
  ];
  return (
    <div className="nf-admin-stack" data-testid="arrangement-record" data-status={row.status}>
      <PageHead title={COPY.title} lede={row.reference} lead={back} />
      <Panel title={COPY.facts} id="arrangement-facts">
        <dl className="grid gap-xs">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-wrap gap-x-sm">
              <dt className="nf-caption min-w-[9rem] text-content-secondary">{f.label}</dt>
              <dd className="nf-body m-0 min-w-0 text-content break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title={COPY.trail} id="arrangement-trail" flush={read.events.length > 0}>
        {read.events.length === 0 ? (
          <PanelEmpty title={COPY.trail} body={COPY.trailEmpty} />
        ) : (
          <ol className="nf-rows nf-group" aria-label={COPY.trail}>
            {read.events.map((e) => (
              <li key={e.id} className="nf-row flex-wrap items-start" data-testid="arrangement-event">
                <span className="min-w-[12rem] flex-1 basis-0">
                  <span className="nf-body block font-semibold text-content">
                    {e.from && e.from !== e.to ? `${e.from.replace(/_/g, " ")} to ${e.to.replace(/_/g, " ")}` : e.to.replace(/_/g, " ")}
                    {e.refused ? `, ${COPY.notRecorded}` : ""}
                  </span>
                  <span className="nf-caption block">
                    {e.source.replace(/_/g, " ")}
                    {e.providerState ? ` · ${e.providerState}` : ""}
                    {" · "}
                    {ui.when(e.at)}
                  </span>
                  {e.notes.map((note) => (
                    <span key={note} className="nf-body mt-2xs block text-content break-words">
                      {note}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Panel title={COPY.decide} id="arrangement-decision">
        {canRefund || canRelease ? (
          <>
            <p className="nf-caption">{COPY.decideLede}</p>
            <div className="mt-row">
              <ArrangementDecision arrangementId={row.id} canRefund={canRefund} canRelease={canRelease} />
            </div>
          </>
        ) : (
          <PanelEmpty title={COPY.nothingTitle} body={COPY.nothingBody} />
        )}
      </Panel>
    </div>
  );
}
