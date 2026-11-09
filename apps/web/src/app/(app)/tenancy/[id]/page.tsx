import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import type { Metadata } from "next";
import { Fragment } from "react";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getTenancyFile, type TenancyFile } from "@/lib/tenancy/queries";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, FactGrid, Section, Stack, TYPE } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";
import { ROOM_COPY } from "@/lib/inspections/report";
import {
  ContestReturn,
  DeductionAnswer,
  EscalateCaution,
  ProposeDeduction,
  RecordReturn,
} from "@/components/app/tenancy/CautionControls";
import { lagosToday } from "@/lib/rent/schema";
import { koboToNairaInput } from "@/lib/agent/listings-model";
import { TenancyReportCard } from "@/components/app/tenancy/TenancyReportCard";
import { CautionRegister } from "@/components/app/tenancy/CautionRegister";
import { ReceiptCodePanel } from "@/components/app/tenancy/ReceiptCodePanel";
import { PinMessages } from "@/components/app/tenancy/PinMessages";
import { AddFlatmate, CancelSplit, PayShare, RemoveFlatmate, SettleShareOnReturn } from "@/components/app/tenancy/FlatmateControls";
import type { ShareRefundStatus } from "@/lib/tenancy/queries";
import { ExitAccountForm, RelistButton, RenewalAnswer, RenewalOfferForm } from "@/components/app/tenancy/RenewalControls";
import { rentCountdown } from "@/lib/tenancy/countdown";
import { RentCountdown } from "@/components/app/tenancy/RentCountdown";
import {
  DocActions,
  DocFigure,
  DocHead,
  DocPerforation,
  DocRow,
  DocRows,
  DocSection,
  DocumentSheet,
} from "@/components/app/money/DocumentSheet";
import { PrintDocumentTile } from "@/components/app/money/PrintDocumentTile";
import { ActionTile } from "@/components/ui/ActionTile";

/** A private record. Never indexed, never in a tab title. */
export const metadata: Metadata = { title: "Tenancy", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

/**
 * THE TENANCY FILE. V-47, holding V-36's caution register and V-54's reports.
 *
 * After a tenant paid a move-in total there was no page they could open six
 * months later: no copy of what the listing promised, no record that anybody
 * owed the caution back, no date the tenancy ends. This is that page, for the
 * tenant and the lister alike, in reading order: the tenancy, the money, the
 * caution, what was promised, and the record of the flat.
 *
 * THE AREA, NEVER THE ADDRESS. The page names the area and city only, like
 * every other surface. The promise snapshot never copies the address,
 * landmark or coordinates; its title and description are the lister's own
 * words as written.
 *
 * A tenancy that is not the reader's answers exactly as one that does not
 * exist, so a stranger guessing ids learns nothing. A read that failed says
 * so rather than claiming there is nothing.
 */
export default async function TenancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  // Back from Paystack after the lead paid their own share (V-86).
  const returnedRef = query.paid === "1" && typeof query.reference === "string" ? query.reference : null;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.afterTheGate.tenancy;
  const read = await getTenancyFile(id, locale);

  const shell = (children: React.ReactNode, subtitle?: string) => (
    <PageFrame title={copy.title} subtitle={subtitle} fallback="/bookings" width="narrow">
      {children}
    </PageFrame>
  );

  if (read.state === "unavailable") {
    return shell(
      <EmptyState icon="calendar-home" title={copy.unavailableTitle} body={copy.unavailableBody} data-testid="tenancy-unavailable" />,
    );
  }
  if (read.state !== "ready") {
    return shell(
      <EmptyState
        icon="calendar-home"
        title={copy.missingTitle}
        body={copy.missingBody}
        action={<EmptyActions primary={{ label: t.catalogue.bookings.openBookings, href: "/bookings" }} />}
        data-testid="tenancy-missing"
      />,
    );
  }

  const file = read.file;
  /* THE TENANT'S FIRST RUN (north star 14.1, R3-12): once, for the tenant
     only, after the file is known to be theirs and before it is drawn. A
     lister opening the same file is never sent, and neither is a tenant
     coming back from Paystack, whose reference the gate would drop. */
  if (file.viewer === "tenant" && !returnedRef) await gateFirstRun("tenancy", `/tenancy/${id}`, query);
  const mates = t.afterTheGate.flatmates;
  return shell(
    <Stack>
      <TenancyHead file={file} copy={copy} />
      {/* B10: the rent countdown, for the tenant, while the tenancy runs. */}
      {file.viewer === "tenant" && file.paid && !file.void && !file.renewal.unavailable && (() => {
        const countdown = rentCountdown({
          today: lagosToday(),
          endsOn: file.endsOn,
          rentMinor: file.renewal.rentMinor,
          offerRentMinor: file.renewal.offer ? file.renewal.rentMinor : null,
        });
        return countdown ? (
          <RentCountdown countdown={countdown} endsOnLabel={file.endsOnLabel} copy={t.memberKit.rentCountdown} locale={locale} />
        ) : null;
      })()}
      {file.viewer === "tenant" && returnedRef && <SettleShareOnReturn tenancyId={file.id} reference={returnedRef} success={t.success} />}
      <MoneySection file={file} copy={copy} t={t} />
      {/* Flatmates' shares are the lead tenant's business, not the lister's. */}
      {file.viewer === "tenant" && (!file.void || file.flatmates.locked) && (
        <FlatmatesSection file={file} copy={mates} locale={locale} success={t.success} />
      )}
      {/* Not on a void charge: create_receipt_code answers not_paid and
          verify_receipt not_found once it is cancelled, refunded or reversed. */}
      {file.viewer === "tenant" && file.paid && !file.void && (
        <Section>
          <ReceiptCodePanel tenancyId={file.id} live={file.receiptCode} copy={t.afterTheGate.receipt} />
        </Section>
      )}
      <CautionSection file={file} copy={copy} words={t.experienceMoney.caution} />
      {file.paid && !file.void && <RenewalSection file={file} copy={copy} />}
      <PromiseSection file={file} copy={copy} />
      <Section title={copy.evidenceHeading} divided>
        <p className={TYPE.body} data-testid="tenancy-viewing">
          <span className="font-semibold">{copy.viewingReport}: </span>
          {file.viewing?.submittedLabel
            ? copy.viewingSubmitted.replace("{date}", file.viewing.submittedLabel).replace("{ticked}", String(file.viewing.ticked))
            : copy.viewingNone}
        </p>
        <div className="mt-md grid gap-md sm:grid-cols-2">
          {file.reports.map((report) => (
            <TenancyReportCard
              key={`${report.stage}-${report.id ?? "new"}`}
              tenancyId={file.id}
              report={report}
              copy={copy}
              locale={locale}
              canWrite={file.viewer !== "staff" && file.paid}
            />
          ))}
        </div>
      </Section>
      {file.viewer === "tenant" && file.paid && (
        <Section>
          <ButtonLink href={`/tenancy/${file.id}/complaint`} variant="secondary" full trailingIcon="arrow-right">
            {t.afterTheGate.complaint.open}
          </ButtonLink>
        </Section>
      )}
      {(file.pins.length > 0 || file.pinCandidates.length > 0) && (
        <Section title={copy.pinsHeading} divided>
          {file.pins.length > 0 && (
            <ul className="mb-md grid gap-sm">
              {file.pins.map((pin) => (
                <li key={pin.id} className="nf-card p-card">
                  <p className="nf-caption">{pin.date}</p>
                  <p className="nf-body-sm mt-2xs whitespace-pre-line">{pin.body}</p>
                </li>
              ))}
            </ul>
          )}
          <PinMessages tenancyId={file.id} candidates={file.pinCandidates} copy={copy} />
        </Section>
      )}
      <p className="nf-caption">{copy.retention.replace("{date}", file.keptUntilLabel)}</p>
    </Stack>,
    file.area || undefined,
  );
}

type Dictionary = ReturnType<typeof getDictionary>;
type Copy = Dictionary["afterTheGate"]["tenancy"];

function TenancyHead({ file, copy }: { file: TenancyFile; copy: Copy }) {
  return (
    <Section>
      <h2 className="nf-h3">{file.title}</h2>
      <p className={`mt-2xs nf-numeric ${TYPE.body}`}>
        {copy.periodLine.replace("{start}", file.moveInLabel).replace("{end}", file.endsOnLabel)}
      </p>
      <p className={`mt-2xs ${TYPE.rowMeta}`}>{copy.renews.replace("{date}", file.endsOnLabel)}</p>
      {file.viewer === "tenant" && file.listerName && (
        <p className={`mt-2xs ${TYPE.rowMeta}`}>{copy.partiesTenant.replace("{name}", file.listerName)}</p>
      )}
    </Section>
  );
}

function MoneySection({ file, copy, t }: { file: TenancyFile; copy: Copy; t: Dictionary }) {
  /*
   * THE MONEY, ON THE DOCUMENT SHEET (D28.1, reference 7082 and 7074).
   *
   * A receipt is a thing a tenant screenshots, prints and takes to a bank or
   * a tribunal, so this block is drawn as paper on the member's own theme:
   * the tenancy named, the figure, every line of the move-in to the kobo,
   * the total they add up to, and each payment that settled with its date
   * and the processor's reference. Nothing on it is invented: the lines are
   * the ledger's, the payments are this charge's SUCCESSFUL transactions,
   * and a payment with no reference shows no reference rather than a made-up
   * one. No barcode, no hash, no transaction id of our own.
   *
   * IT IS A RECEIPT ONLY WHEN IT IS PAID. An unpaid or voided charge is the
   * same sheet without the torn receipt edge, and its figure is called the
   * move-in total rather than "Paid in total", which this block used to say
   * whether or not anything had been paid.
   *
   * The dual "Confirmed" rows of 7082 are not drawn: the record holds one
   * confirmation (the settlement against the processor's reference), not two
   * independent ones, so the sheet states the payments it has and no more.
   */
  const receipt = file.paid && !file.void;
  const titleId = "tenancy-money-title";
  return (
    <Section divided>
      <DocumentSheet
        kind={receipt ? "receipt" : "document"}
        printable
        aria-labelledby={titleId}
        data-testid="tenancy-money"
      >
        <DocHead label={copy.moneyHeading} title={file.title} id={titleId}>
          <p className="nf-doc__label nf-numeric">
            {copy.periodLine.replace("{start}", file.moveInLabel).replace("{end}", file.endsOnLabel)}
            {file.area ? ` · ${file.area}` : ""}
          </p>
        </DocHead>
        <div className="mt-lg">
          <p className="nf-doc__label">{receipt ? copy.totalPaid : t.checkout.moveInTotal}</p>
          <DocFigure testId="tenancy-money-figure">{file.total}</DocFigure>
        </div>
        {receipt && <DocPerforation />}
        <DocRows>
          {file.lines.map((line) => (
            <DocRow key={line.label} label={line.label} numeric>
              {line.display}
            </DocRow>
          ))}
          <DocRow label={receipt ? copy.totalPaid : t.checkout.moveInTotal} variant="total" numeric>
            {file.total}
          </DocRow>
        </DocRows>
        {/* The lister cannot read the tenant's payment rows, so the payments are the tenant's and staff's. */}
        {file.viewer === "lister" ? null : (
          <DocSection title={copy.receiptsHeading} id="tenancy-money-payments">
            {file.receipts.length === 0 ? (
              <p className="nf-doc__note mt-xs">{copy.noReceipt}</p>
            ) : (
              <DocRows className="mt-xs">
                {file.receipts.map((payment) => (
                  <Fragment key={payment.id}>
                    <DocRow label={payment.date} numeric>
                      {payment.amount}
                    </DocRow>
                    {payment.reference && (
                      <DocRow label={t.success.detail.reference} numeric>
                        <span className="nf-doc__ref">{payment.reference}</span>
                      </DocRow>
                    )}
                  </Fragment>
                ))}
              </DocRows>
            )}
          </DocSection>
        )}
      </DocumentSheet>
      {/* Print, Share, Dispute (7074), in the member's theme under the
          paper, and only the ones that exist: share is the receipt-code
          block further down this page (checked at /r), dispute is the
          tenancy's complaint pack. Both are the tenant's, on a paid charge. */}
      <DocActions label={copy.moneyHeading}>
        <PrintDocumentTile label={t.afterTheGate.complaint.print} testId="tenancy-money-print" />
        {file.viewer === "tenant" && receipt && (
          <>
            <ActionTile icon="share" label={t.afterTheGate.receipt.share} href="#tenancy-proof" data-testid="tenancy-money-share" />
            <ActionTile
              icon="flag"
              label={t.afterTheGate.complaint.open}
              href={`/tenancy/${file.id}/complaint`}
              data-testid="tenancy-money-dispute"
            />
          </>
        )}
      </DocActions>
    </Section>
  );
}

function CautionSection({ file, copy, words }: { file: TenancyFile; copy: Copy; words: Dictionary["experienceMoney"]["caution"] }) {
  const caution = file.caution;
  /*
   * M2: THE CAUTION REGISTER AS A DOCUMENTED EXCHANGE (north star 10 D).
   * The record (the caution, what is returned, deducted and owed, and one
   * thread per deduction and per return saying who said what) is drawn as a
   * document by `CautionRegister`, the same for the tenant and the landlord
   * or agent, with no ruling shown before staff make it. The controls below
   * are this page's own, unchanged in what they do; the tenant's answers now
   * sit under the document, each naming the entry it answers, rather than on
   * the paper.
   */
  if (file.void) {
    return (
      <Section title={copy.cautionHeading} divided>
        <p className={TYPE.body} data-testid="tenancy-caution-void">
          {copy.cautionVoid}
        </p>
      </Section>
    );
  }
  if (!caution) {
    return (
      <Section title={copy.cautionHeading} divided>
        <p className={TYPE.body} data-testid="tenancy-caution-empty">
          {file.cautionPending ? copy.cautionNotOpen : copy.cautionNone}
        </p>
      </Section>
    );
  }
  const toAnswer =
    file.viewer === "tenant" ? caution.deductions.map((d, i) => ({ d, n: i + 1 })).filter(({ d }) => d.answer === null) : [];
  const toContest =
    file.viewer === "tenant"
      ? caution.returns
          .map((r, i) => ({ r, n: i + 1 }))
          .filter(({ r }) => !r.ownRecord && !r.contested && r.recordedAs === "lister_sent")
      : [];
  return (
    <Section title={copy.cautionHeading} divided>
      <CautionRegister caution={caution} copy={copy} words={words}>
        {toAnswer.length + toContest.length > 0 && (
          <div className="nf-panel nf-panel--card block p-md" data-testid="tenancy-caution-answers">
            <h3 className="nf-h4">{words.yourAnswer}</h3>
            <div className="mt-sm grid gap-sm">
              {toAnswer.map(({ d, n }) => (
                <div key={d.id} className="nf-exchange-answer">
                  <p className="nf-exchange-answer__label nf-numeric">
                    {words.deduction.replace("{n}", String(n))} ·{" "}
                    {copy.deductionLine.replace("{item}", ROOM_COPY[d.item].title).replace("{amount}", d.amount)}
                  </p>
                  <DeductionAnswer tenancyId={file.id} deductionId={d.id} copy={copy} />
                </div>
              ))}
              {toContest.map(({ r, n }) => (
                <div key={r.id} className="nf-exchange-answer">
                  <p className="nf-exchange-answer__label nf-numeric">
                    {words.return.replace("{n}", String(n))} · {copy.returnedLine.replace("{amount}", r.amount).replace("{date}", r.date)}
                  </p>
                  <ContestReturn tenancyId={file.id} returnId={r.id} copy={copy} />
                </div>
              ))}
            </div>
          </div>
        )}

        {file.viewer === "lister" && caution.state !== "returned" && (
          <div className="nf-panel nf-panel--card block p-md">
            <h3 className="nf-h4">{copy.proposeHeading}</h3>
            <div className="mt-sm">
              {file.ended ? (
                <ProposeDeduction
                  tenancyId={file.id}
                  obligationId={caution.obligationId}
                  copy={copy}
                  photos={file.reports
                    .filter((report) => report.stage === "move_out" && report.authorIsViewer && report.submitted)
                    .flatMap((report) => report.photos)
                    .map((photo, index) => ({
                      id: photo.id,
                      item: photo.item,
                      label: `${photo.item ? ROOM_COPY[photo.item].title : copy.moveOut} ${index + 1}`,
                    }))}
                />
              ) : (
                <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                  {copy.proposeNotEnded.replace("{date}", file.endsOnLabel)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Paid back between the parties, outside Vallo; either side records it, the other can contest. */}
        {file.viewer !== "staff" && caution.outstandingMinor > 0 && !caution.claimOpen && (
          <div className="nf-panel nf-panel--card block p-md">
            <h3 className="nf-h4">{copy.returnHeading}</h3>
            <div className="mt-sm">
              <RecordReturn
                tenancyId={file.id}
                obligationId={caution.obligationId}
                outstanding={caution.outstanding}
                outstandingNaira={koboToNairaInput(caution.outstandingMinor)}
                viewer={file.viewer}
                today={lagosToday()}
                copy={copy}
              />
            </div>
          </div>
        )}

        {file.viewer === "tenant" && (caution.claimOpen || caution.canEscalate) && (
          <div className="nf-panel nf-panel--card block p-md" data-testid="tenancy-caution-escalate">
            <h3 className="nf-h4">{copy.escalateHeading}</h3>
            <div className="mt-sm">
              {caution.claimOpen ? (
                <p className="nf-body-sm">{copy.escalateOpen}</p>
              ) : (
                <>
                  <p className="nf-body-sm nf-numeric">
                    {copy.escalateHelp.replace("{date}", caution.dueOnLabel).replace("{amount}", caution.claimable)}
                  </p>
                  <div className="mt-sm">
                    <EscalateCaution tenancyId={file.id} obligationId={caution.obligationId} copy={copy} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CautionRegister>
    </Section>
  );
}

function FlatmatesSection({
  file,
  copy,
  success,
}: {
  file: TenancyFile;
  copy: ReturnType<typeof getDictionary>["afterTheGate"]["flatmates"];
  locale: Locale;
  /** The page's `t.success`, for "Invitation sent". */
  success: ReturnType<typeof getDictionary>["success"];
}) {
  const mates = file.flatmates;
  if (mates.unavailable) {
    return (
      <Section title={copy.heading} divided>
        <p className={TYPE.body}>{copy.unavailable}</p>
      </Section>
    );
  }
  return (
    <Section title={copy.heading} description={copy.lede} divided>
      <div id="flatmates" className="grid gap-md" data-testid="tenancy-flatmates">
        {mates.rows.length > 0 && (
          <ul className="grid gap-sm">
            {mates.rows.map((row) => (
              <li key={row.id} className="nf-card flex flex-wrap items-start justify-between gap-sm p-card">
                <div className="min-w-0">
                  <p className="nf-body-sm nf-numeric font-semibold">
                    {copy.row.replace("{name}", row.name ?? copy.someone).replace("{share}", row.share)}
                  </p>
                  <p className="nf-caption mt-2xs">
                    {row.refund
                      ? refundLine(row.refund, copy)
                      : row.paid
                        ? copy.paid
                        : row.answer === "declined"
                          ? copy.declined
                          : row.answer === "accepted"
                            ? copy.accepted
                            : copy.invited}
                  </p>
                  {row.cautionPart && (
                    <p className="nf-caption mt-2xs nf-numeric">{copy.cautionPart.replace("{amount}", row.cautionPart)}</p>
                  )}
                </div>
                {!mates.locked && !file.void && <RemoveFlatmate tenancyId={file.id} contributorId={row.id} copy={copy} />}
              </li>
            ))}
          </ul>
        )}
        {file.void && <p className={TYPE.body}>{copy.voidLead}</p>}
        {!file.void && (
          <>
            <p className="nf-body-sm nf-numeric font-semibold">{copy.lead.replace("{share}", mates.leadShare)}</p>
            {mates.leadCautionPart && mates.rows.length > 0 && (
              <p className="nf-caption nf-numeric">{copy.leadCautionPart.replace("{amount}", mates.leadCautionPart)}</p>
            )}
            {/* Only a split move-in is paid share by share here; a whole one is paid from the booking. */}
            {mates.rows.length > 0 && !file.paid && !file.void && (
              mates.leadPaid ? (
                <p className="nf-caption">{copy.paid}</p>
              ) : (
                <PayShare tenancyId={file.id} label={copy.payMine} help={copy.sharePayHelp} />
              )
            )}
            {mates.locked ? (
              <p className="nf-caption">{copy.locked}</p>
            ) : (
              <div className="nf-panel nf-panel--card block p-md">
                <AddFlatmate tenancyId={file.id} copy={copy} success={success} />
              </div>
            )}
            {mates.cancellable && (
              <div className="nf-panel nf-panel--card block p-md">
                <CancelSplit tenancyId={file.id} copy={copy} />
              </div>
            )}
          </>
        )}
        {file.void && mates.leadRefund && <p className="nf-caption">{refundLine(mates.leadRefund, copy)}</p>}
      </div>
    </Section>
  );
}

function refundLine(status: ShareRefundStatus, copy: ReturnType<typeof getDictionary>["afterTheGate"]["flatmates"]): string {
  return status === "processed" ? copy.refunded : copy.refunding;
}

function RenewalSection({ file, copy }: { file: TenancyFile; copy: Copy }) {
  const renewal = file.renewal;
  if (renewal.unavailable) {
    return (
      <Section title={copy.renewalHeading} divided>
        <p className={TYPE.body}>{copy.renewalUnavailable}</p>
      </Section>
    );
  }
  const party = file.viewer !== "staff";
  return (
    <Section title={copy.renewalHeading} divided>
      <div className="grid gap-md" data-testid="tenancy-renewal">
        <p className="nf-body nf-numeric">
          {renewal.daysLeft >= 0
            ? copy.renewalDays.replace("{days}", String(renewal.daysLeft)).replace("{date}", file.endsOnLabel)
            : copy.renewalEnded.replace("{date}", file.endsOnLabel)}
        </p>
        {renewal.offer ? (
          <div>
            <p className="nf-body-sm nf-numeric font-semibold">
              {copy.renewalOffer
                .replace("{date}", renewal.offer.offeredOn)
                .replace("{total}", renewal.offer.total)
                .replace("{rent}", renewal.offer.rent)}
            </p>
            {renewal.offer.service && (
              <p className={`mt-2xs nf-numeric ${TYPE.rowMeta}`}>{copy.renewalService.replace("{amount}", renewal.offer.service)}</p>
            )}
            {renewal.offer.rise && (
              <p className={`mt-2xs nf-numeric ${TYPE.rowMeta}`}>
                {(file.viewer === "lister" ? copy.renewalRiseLister : copy.renewalRise)
                  .replace("{amount}", renewal.offer.rise)
                  .replace("{percent}", renewal.offer.percent ?? "")}
              </p>
            )}
            {renewal.offer.fall && (
              <p className={`mt-2xs nf-numeric ${TYPE.rowMeta}`}>
                {(file.viewer === "lister" ? copy.renewalFallLister : copy.renewalFall)
                  .replace("{amount}", renewal.offer.fall)
                  .replace("{percent}", renewal.offer.percent ?? "")}
              </p>
            )}
            {renewal.offer.fees && (
              <p className="nf-body-sm mt-2xs nf-numeric text-[var(--nf-state-warning)]">
                {copy.renewalFees.replace("{amount}", renewal.offer.fees)}
              </p>
            )}
          </div>
        ) : (
          <p className={TYPE.body}>{copy.renewalNoOffer}</p>
        )}
        {renewal.answer && (
          <p className={TYPE.rowMeta}>{renewal.answer === "renewing" ? copy.renewalAnswerRenewing : copy.renewalAnswerLeaving}</p>
        )}
        {file.viewer === "tenant" && renewal.answer === null && renewal.daysLeft >= 0 && (
          <RenewalAnswer tenancyId={file.id} copy={copy} />
        )}
        {party && renewal.answer === "renewing" && <p className="nf-caption">{copy.renewalPayNote}</p>}

        {file.viewer === "lister" && renewal.daysLeft >= 0 && (
          <div className="nf-panel nf-panel--card block p-md">
            <h3 className="nf-h4">{copy.renewalOfferHeading}</h3>
            <div className="mt-sm">
              <RenewalOfferForm
                tenancyId={file.id}
                rentNaira={koboToNairaInput(renewal.rentMinor)}
                serviceNaira={koboToNairaInput(renewal.serviceMinor)}
                copy={copy}
              />
            </div>
          </div>
        )}
        {file.viewer === "lister" && (
          <div className="nf-panel nf-panel--card block p-md">
            <h3 className="nf-h4">{copy.relistHeading}</h3>
            <div className="mt-sm">
              {renewal.successorId || renewal.relistOpen ? (
                <RelistButton tenancyId={file.id} successorId={renewal.successorId} copy={copy} />
              ) : (
                <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                  {renewal.answer === "renewing" ? copy.relistBlocked : copy.relistOpensOn.replace("{date}", renewal.relistOpensOnLabel)}
                </p>
              )}
            </div>
          </div>
        )}
        {file.viewer === "tenant" && (renewal.exitAnswered || renewal.exitOpen) && (
          <div className="nf-panel nf-panel--card block p-md">
            <h3 className="nf-h4">{copy.exitHeading}</h3>
            <div className="mt-sm">
              {renewal.exitAnswered ? (
                <p className="nf-body-sm">{copy.exitDone}</p>
              ) : (
                <ExitAccountForm tenancyId={file.id} copy={copy} />
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function PromiseSection({ file, copy }: { file: TenancyFile; copy: Copy }) {
  return (
    <Section title={copy.promiseHeading} divided>
      {!file.snapshot ? (
        <p className={TYPE.body}>{copy.promiseNone}</p>
      ) : (
        <div data-testid="tenancy-promise">
          <p className={`${TYPE.body} mb-md`}>{copy.promiseLede.replace("{date}", file.snapshot.takenAtLabel)}</p>
          <FactGrid facts={file.snapshot.facts} />
          {file.snapshot.description && (
            <p className="nf-body-sm mt-md whitespace-pre-line text-[var(--nf-content-secondary)]">{file.snapshot.description}</p>
          )}
        </div>
      )}
    </Section>
  );
}
