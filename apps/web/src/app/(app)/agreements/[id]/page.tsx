import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, intlTag, type Locale } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readAgreement, UNNAMED_OWNER, UNNAMED_RENTER } from "@/lib/agreements/queries";
import { readHeldPayment } from "@/lib/money/held-view";
import { readAgreementRail } from "@/lib/money/fund-view";
import { readAgreementPayChoice } from "@/lib/payments/rail-choice-read";
import { PayChoiceCard } from "@/components/money/pay-choice/PayChoiceCard";
import { readChangesSinceConfirmed } from "@/lib/agreements/changes-read";
import type { TermChange } from "@/lib/agreements/terms-diff";
import { AgreementChanges, type WordedChange } from "@/components/app/agreements/AgreementChanges";
import { AgreementVersions } from "@/components/app/agreements/AgreementVersions";
import { AgreementHistory, eventLabel } from "@/components/app/agreements/AgreementHistory";
import { readAgreementRecord } from "@/components/app/agreements/record-read";
import { previousVersionDiff, versionRegister, type RecordEvent } from "@/components/app/agreements/version-register";
import { termDay, termValue } from "@/components/app/agreements/term-words";
import { PageHeader } from "@/components/app/PageHeader";
import { Tracker } from "@/components/ui/Tracker";
import { DecisionCard } from "@/components/app/confirm/DecisionCard";
import { ButtonLink } from "@/components/ui/Button";
import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
import { readDone, type SuccessMomentId } from "@/lib/ui/success-moments";
import { agreementArrival } from "@/lib/ui/arrival-moments";
import { Section, TYPE } from "@/components/app/Screen";
import { CLAIM_STATUS_LABEL, STAY_TRACK_WORDS, agreementStatusLabel, agreementStatusTone } from "@/components/app/agreements/status";
import type { TrackStep } from "@/components/app/status/StatusTrack";
import { DocActions, DocHead, DocNote, DocRow, DocRows, DocState, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { PrintDocumentTile } from "@/components/app/money/PrintDocumentTile";
import { agreementTrack, type AgreementStepKey } from "@/components/app/status/tracks";
import { AmendTerms, CancelAgreement, ClaimForm, ConfirmTerms } from "@/components/app/agreements/AgreementControls";
import { bpsAsPercentText } from "@/lib/money/percent";
import {
  AGREEMENT_IN_REVIEW,
  AGREEMENT_PAYMENT_OPEN_TITLE,
  agreementOwnerApproved,
  agreementPayLabel,
  LEGACY_GUARANTEE_CLAIM,
  legacyReserveSentence,
  NO_CUSTODY_SENTENCE,
  NO_INSPECTION_FEE,
  OFF_PLATFORM_SENTENCE,
  PAY_ONLY_THROUGH_VALLO,
} from "@/lib/money/copy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceMoney.agreements.page.title };
}
export const dynamic = "force-dynamic";

/* The terms' money lines, labelled from the dictionary: the move-in ledger's
   own words where it has them, the agreement page's for a stay's two
   (Round 3 sweep, C3). */
type Dict = ReturnType<typeof getDictionary>;
function termLines(t: Dict): { key: string; label: string }[] {
  const m = t.moveIn;
  const p = t.experienceMoney.agreements.page;
  return [
    { key: "rent_minor", label: m.rent },
    { key: "caution_minor", label: m.cautionDeposit },
    { key: "service_minor", label: m.serviceCharge },
    { key: "agency_minor", label: m.agencyFee },
    { key: "legal_minor", label: m.legalFee },
    { key: "agreement_fee_minor", label: m.agreementFee },
    { key: "price_per_night_minor", label: p.perNight },
    { key: "cleaning_fee_minor", label: p.cleaning },
  ];
}

function str(terms: Record<string, unknown>, key: string): string | null {
  const v = terms[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(terms: Record<string, unknown>, key: string): number | null {
  const v = terms[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * ONE AGREEMENT: exactly what both sides committed to (Track A).
 *
 * The terms are drawn from the listing's own figures and the inspection
 * report, never typed as money by anybody. Both parties confirm the same
 * version; changing anything makes the version move and every confirmation
 * lapse. Vallo reviews the confirmed version before payment opens. Once paid,
 * the Vallo Guarantee is open for claims in the window after move-in or
 * check-in.
 */
export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string | string[] }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const a = await readAgreement(id);
  if (!a) notFound();
  const done = readDone((await searchParams).done);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const now = requestTime();
  const windowOpen =
    a.claimWindow !== null && now >= Date.parse(a.claimWindow.opens) && now < Date.parse(a.claimWindow.closes);
  const claimedApproved = a.claims.reduce((sum, c) => sum + (c.approvedMinor ?? 0), 0);
  const cap = Math.max(0, a.amountMinor - claimedApproved);
  /* D77 and ruling 2 (13 October 2026): a deal on the escrow rail (a rental,
     or a shortlet stay whose payer kept escrow) is paid into escrow, not by
     card. The rail is the database's, with the payer's choice applied. */
  const payRail = a.status === "approved" && a.role === "renter" ? await readAgreementRail(a.id) : null;
  const payHref =
    payRail === "escrow"
      ? `/agreements/${a.id}/fund`
      : a.kind === "rent" && a.inspectionId
        ? `/rent/pay/${a.inspectionId}`
        : a.bookingId
          ? `/checkout/${a.bookingId}`
          : null;
  const guaranteeBps = num(a.terms, "guarantee_bps");
  /* A contribution was really taken only while the Guarantee ran (D51). */
  const legacyContribution = guaranteeBps !== null && guaranteeBps > 0;
  /* Staff read every agreement under RLS but are not a party to it: they see
     the record and none of the parties' controls. */
  const party = a.role !== null;
  /* The one pending decision this page can hold for its reader. */
  const awaitingYou = party && a.status === "awaiting_parties" && !a.youConfirmedCurrent;
  const lastEvent = a.events.length > 0 ? a.events[a.events.length - 1] : undefined;
  const lastEventAt = lastEvent
    ? new Date(lastEvent.at).toLocaleString(intlTag[locale], { timeZone: "Africa/Lagos", day: "numeric", month: "short" })
    : null;

  /*
   * THE SUCCESS MOMENT ON ARRIVAL (docs/SUCCESS_MOMENTS.md). A flag from the
   * control that just acted, and each one checked against this agreement
   * before a sheet opens: the flag asks, the record answers. Approval is
   * written by the database into a notification, where no flag can ride, so
   * it opens from the status itself, once per device.
   */
  /* B9: what moved since this party last confirmed. Null (today's page)
     until the versions migration is applied, and whenever there is nothing
     to show. */
  const t = getDictionary(locale);
  const kit = t.memberKit.agreementDiff;
  const words = t.experienceMoney.agreements;
  const pw = words.page;
  const LINES = termLines(t);
  /* D68d step 8: a protected payment held by the provider has its own page
     (a rental, or since ruling 2 a shortlet stay paid into escrow). */
  const held = await readHeldPayment(a.id);
  /* Ruling 2: the payment step's choice, escrow or card, for the payer. */
  /* A payer whose card choice is waiting on a person (pov04) still sees the
     choice, so they can go back to escrow and pay now: never a dead end. */
  const payChoice =
    (a.status === "approved" || (a.status === "in_review" && a.role === "renter")) && party && held?.state !== "ready"
      ? await readAgreementPayChoice(a.id)
      : null;
  const cardWaitsOnReview = a.status === "in_review" && payChoice !== null && payChoice.chosen === "card";
  const [since, record] = await Promise.all([
    party && (a.status === "awaiting_parties" || a.status === "rejected") && !a.youConfirmedCurrent
      ? readChangesSinceConfirmed({
          agreementId: a.id,
          currentVersion: a.termsVersion,
          currentTerms: a.terms,
          currentAmountMinor: a.amountMinor,
        })
      : Promise.resolve(null),
    readAgreementRecord(a.id),
  ]);
  const worded: WordedChange[] = (since?.changes ?? []).map((c: TermChange) => ({
    key: c.key,
    label: c.label,
    before: termValue(c, c.before, locale, kit.notStated),
    after: termValue(c, c.after, locale, kit.notStated),
  }));

  /*
   * M2: THE DOCUMENT'S VERSIONS AND ITS RECORD. The sided events (who did
   * what, on which version) and B9's kept snapshots, read under the
   * reader's own RLS. A party sees every kept version, the line-by-line
   * change from the one before, and which side confirmed which version;
   * when the snapshots cannot be read (a failed read, or staff, who are no
   * party) the sheet is the current version alone, as it was.
   */
  const names = { renter: a.renterName, owner: a.ownerName };
  const confirmedNow = {
    renter: a.role === "renter" ? a.youConfirmedCurrent : a.role === "owner" ? a.otherConfirmedCurrent : false,
    owner: a.role === "owner" ? a.youConfirmedCurrent : a.role === "renter" ? a.otherConfirmedCurrent : false,
  };
  const kept = party && record?.versions ? record.versions : null;
  const versionEntries = kept
    ? versionRegister({ current: a.termsVersion, stored: kept.map((v) => v.version), events: record?.events ?? [], confirmedNow })
    : [];
  const versionDiff = kept ? previousVersionDiff({ current: a.termsVersion, versions: kept }) : null;
  const history: RecordEvent[] =
    record?.events ?? a.events.map((e) => ({ at: e.at, action: e.action, note: e.note, side: null, version: null }));

  /* The approval state's one payoff: the pop on the approval node, only
     for a party, only when the record holds a dated approval and the
     agreement stands approved now (a later payment is its own moment; a
     send-back or a cancellation is not a payoff; staff reviewing the
     record are not being paid off). */
  /* D73: a stay's agreement is never drawn as a staff review. */
  const trackWords = a.kind === "rent" ? pw.track : { ...pw.track, ...STAY_TRACK_WORDS };
  const steps = agreementSteps(a.status, a.events, trackWords, locale);
  const statusWords = agreementStatusLabel(a.status, a.kind);

  /* THE ONE TRACKER's two cells, from the record only. What happens next is
     the first step still ahead; the reader's part is the one decision this
     page holds for them, the payment that is theirs to make, or nothing. */
  const nextStep = steps.find((step) => step.state === "upcoming");
  const yourPart = !party
    ? null
    : awaitingYou
      ? pw.confirmVersion.replace("{n}", String(a.termsVersion))
      : a.status === "approved" && a.role === "renter" && payHref
        ? agreementPayLabel(formatMoney(a.amountMinor, locale))
        : "No action needed from you";
  const sinceLine = lastEvent
    ? `${eventLabel(lastEvent.action, a.kind)} · ${new Date(lastEvent.at).toLocaleString(intlTag[locale], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      })}`
    : null;

  const arrival = agreementArrival(a, done);
  const moment: SuccessMomentId | null = arrival && !arrival.seenOnce ? arrival.moment : null;
  const approvedMoment: SuccessMomentId | null = arrival?.seenOnce ? arrival.moment : null;

  return (
    <main className="nf-page nf-md" data-testid="agreement-page" data-status={a.status}>
      {/* Always rendered, here, with `show` deciding: it latches what it
          says, so stripping the flag cannot take the sheet away. */}
      <SuccessFromFlag
        copy={getDictionary(locale).success}
        show={(moment ?? approvedMoment) !== null}
        moment={moment ?? approvedMoment ?? "agreementDrawn"}
        seenKey={moment ? undefined : `agreement-approved:${a.id}`}
        details={[{ label: getDictionary(locale).success.detail.for, value: a.listingTitle }]}
        primary={
          !moment && approvedMoment && a.role === "renter" && payHref
            ? { label: agreementPayLabel(formatMoney(a.amountMinor, locale)), href: payHref }
            : undefined
        }
        haptic={moment ? undefined : false}
      />
      <PageHeader title={pw.title} />
      {/* WHERE IT STANDS, as the one tracker (ONE-PRODUCT-DECISIONS,
          recommendation 1; status-tracking-timeline.jpg): the status in
          words, when it got there, what happens next and the reader's part,
          then the dated moments from this agreement's own events. The
          property and kind are the chip; the full record stays below. */}
      <p className="nf-tracker-place mt-inline">
        {a.listingTitle} · {a.kind === "rent" ? pw.rental : pw.stay}
      </p>
      <Tracker
        className="mt-inline"
        label={pw.liveStatus}
        icon={a.kind === "rent" ? "key" : "bed"}
        glyph={a.status === "cancelled" || a.status === "rejected" ? "listing-rejected" : a.status === "paid" ? "booking-completed" : "empty-agreements"}
        title={statusWords}
        tone={agreementStatusTone(a.status)}
        since={sinceLine}
        cells={[
          ...(nextStep && a.status !== "cancelled" && a.status !== "rejected" ? [{ label: "Next step", value: nextStep.label }] : []),
          ...(yourPart ? [{ label: "Your part", value: yourPart }] : []),
        ]}
        steps={steps}
        timelineLabel={pw.progress}
        glyphs={{ drawn: "file-text", confirmed: "user-check", approved: "verified", paid: "wallet" }}
        testId="agreement-track"
      />
      <span className="sr-only" data-testid="agreement-status">
        {statusWords}
      </span>

      {/* AWAITING YOU (plan item 22; spec section 14, reference 36). Drawn
          only when this reader is a party and has not confirmed the current
          version: the one real decision on this page. Its lines and total are
          the terms' own; its controls are the page's own ConfirmTerms and
          CancelAgreement, moved here rather than repeated below. */}
      {awaitingYou ? (
        <DecisionCard
          className="mt-block"
          testId="agreement-awaiting-you"
          label={pw.awaitingYou}
          when={lastEventAt ? pw.since.replace("{date}", lastEventAt) : undefined}
          title={pw.confirmVersion.replace("{n}", String(a.termsVersion))}
          lines={LINES.flatMap((line) => {
            const amount = num(a.terms, line.key);
            return amount ? [{ label: line.label, amount: formatMoney(amount, locale) }] : [];
          })}
          total={{ label: pw.total, amount: formatMoney(a.amountMinor, locale) }}
          primary={
            <ConfirmTerms
              agreementId={a.id}
              version={a.termsVersion}
              changes={worded.length > 0 ? worded : undefined}
              changesLead={kit.confirmLead}
            />
          }
          secondary={[
            <ButtonLink key="terms" variant="secondary" href="#agreement-terms">
              {pw.readTerms}
            </ButtonLink>,
            <CancelAgreement key="cancel" agreementId={a.id} variant="secondary" />,
          ]}
        />
      ) : null}

      {a.status === "rejected" && a.decisionReason ? (
        <div className="nf-card mt-block p-card" role="note">
          <p className="font-semibold">{pw.sentBack}</p>
          <p className={TYPE.body}>{a.decisionReason}</p>
          <p className={TYPE.rowMeta}>{a.kind === "rent" ? pw.sentBackRent : pw.sentBackStay}</p>
        </div>
      ) : null}

      {since ? (
        <AgreementChanges
          changes={worded}
          copy={kit}
          byLine={
            since.by && since.at
              ? kit.by
                  .replace("{who}", since.by === "you" ? kit.you : kit.other)
                  .replace("{date}", new Date(since.at).toLocaleString(intlTag[locale], { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))
              : kit.byUndated
          }
          versionsLine={kit.versions.replace("{from}", String(since.fromVersion)).replace("{to}", String(since.toVersion))}
        />
      ) : null}

      {/*
        THE TERMS, ON THE DOCUMENT SHEET (D28.1). The agreement is the record
        of exactly what both sides committed to, and it is what gets printed
        and taken to a lawyer, so it is drawn as paper on the member's own
        theme: who it is between, the dates, every line to the kobo, the total
        they add up to, and where each party stands on THIS version. The two
        confirmation rows are the record's own (`youConfirmedCurrent` and
        `otherConfirmedCurrent`, read against the current terms version), in
        the sentences this page already used, so a lapsed confirmation after
        an amendment reads as not confirmed rather than as a tick. Staff read
        the record without being a party, so they see no confirmation rows.
      */}
      <Section id="agreement-terms">
        <DocumentSheet printable aria-labelledby="agreement-terms-title" data-testid="agreement-terms">
          <DocHead label={a.listingTitle} title={pw.termsTitle.replace("{n}", String(a.termsVersion))} id="agreement-terms-title" />
          <DocRows>
            <DocRow label={pw.between} variant="prose">
              {pw.between2
                .replace(
                  "{first}",
                  a.renterName === UNNAMED_RENTER
                    ? a.kind === "rent"
                      ? pw.partyRenterUnnamed
                      : pw.partyGuestUnnamed
                    : (a.kind === "rent" ? pw.partyRenter : pw.partyGuest).replace("{name}", a.renterName),
                )
                .replace(
                  "{second}",
                  a.ownerName === UNNAMED_OWNER ? pw.partyOwnerUnnamed : pw.partyOwner.replace("{name}", a.ownerName),
                )}
            </DocRow>
            {str(a.terms, "move_in") ? (
              <>
                <DocRow label={pw.moveIn} numeric>
                  {termDay(str(a.terms, "move_in"), locale)}
                </DocRow>
                <DocRow label={pw.keys} numeric>
                  {termDay(str(a.terms, "handover_on") ?? str(a.terms, "move_in"), locale)}
                </DocRow>
              </>
            ) : null}
            {str(a.terms, "check_in") ? (
              <DocRow label={pw.stay} numeric>
                {pw.stayDates
                  .replace("{from}", termDay(str(a.terms, "check_in"), locale) ?? "")
                  .replace("{to}", termDay(str(a.terms, "check_out"), locale) ?? "")}
              </DocRow>
            ) : null}
            {LINES.map((line) =>
              num(a.terms, line.key) ? (
                <DocRow key={line.key} label={line.label} numeric>
                  {formatMoney(num(a.terms, line.key)!, locale)}
                </DocRow>
              ) : null,
            )}
            <DocRow label={pw.inspectionFee} variant="prose">
              {NO_INSPECTION_FEE}
            </DocRow>
            <DocRow label={pw.total} variant="total" numeric>
              {formatMoney(a.amountMinor, locale)}
            </DocRow>
            {str(a.terms, "notes") ? (
              <DocRow label={pw.alsoAgreed} variant="prose">
                {str(a.terms, "notes")}
              </DocRow>
            ) : null}
            {party ? (
              <>
                <DocRow label={a.role === "renter" ? a.renterName : a.ownerName} variant="prose">
                  <DocState done={a.youConfirmedCurrent}>
                    {a.youConfirmedCurrent ? pw.youConfirmed : pw.youNotConfirmed}
                  </DocState>
                </DocRow>
                <DocRow label={a.role === "renter" ? a.ownerName : a.renterName} variant="prose">
                  <DocState done={a.otherConfirmedCurrent}>
                    {a.otherConfirmedCurrent ? pw.otherConfirmed : pw.otherNotConfirmed}
                  </DocState>
                </DocRow>
              </>
            ) : null}
          </DocRows>
          {versionDiff ? (
            <AgreementVersions
              diff={versionDiff}
              entries={versionEntries}
              names={names}
              locale={locale}
              copy={words}
              diffCopy={kit}
            />
          ) : null}
          <DocNote>
            {NO_CUSTODY_SENTENCE}
            {/* D51: nothing about a fee is said to the renter or guest. The
                lister alone is told what came out of their share, and only
                while a Guarantee contribution was really in the terms. */}
            {a.role === "owner" && legacyContribution && guaranteeBps !== null
              ? ` ${legacyReserveSentence(bpsAsPercentText(guaranteeBps))}`
              : ""}
          </DocNote>
        </DocumentSheet>
        <DocActions label={pw.theTerms}>
          <PrintDocumentTile label={t.afterTheGate.complaint.print} testId="agreement-print" />
        </DocActions>
      </Section>

      {party && (a.status === "awaiting_parties" || a.status === "rejected") ? (
        <Section title={a.status === "rejected" ? pw.whatNext : pw.confirm}>
          {/* Where each side stands on this version is said once, on the
              terms sheet above, rather than repeated here. Confirming, when
              it is this reader's move, is the Awaiting you card at the top
              of the page. */}
          {a.kind === "rent" ? (
            <AmendTerms
              agreementId={a.id}
              moveIn={str(a.terms, "move_in") ?? today}
              handoverOn={str(a.terms, "handover_on") ?? today}
              notes={str(a.terms, "notes") ?? ""}
              minDate={today}
            />
          ) : null}
          {awaitingYou ? null : <CancelAgreement agreementId={a.id} />}
        </Section>
      ) : null}

      {a.status === "in_review" ? (
        <Section title={pw.withVallo}>
          <p className={TYPE.body}>{AGREEMENT_IN_REVIEW}</p>
          {party ? <CancelAgreement agreementId={a.id} /> : null}
        </Section>
      ) : null}

      {held?.state === "ready" ? (
        <Section title="Escrow payment">
          <Link href={`/agreements/${a.id}/held`} className="nf-btn nf-btn--primary nf-btn--md nf-btn--full" data-testid="agreement-held">
            See where your money is held
          </Link>
        </Section>
      ) : null}

      {(a.status === "approved" || cardWaitsOnReview) && held?.state !== "ready" ? (
        <Section title={AGREEMENT_PAYMENT_OPEN_TITLE}>
          {a.role === "renter" && payChoice ? (
            <PayChoiceCard
              copy={t.payChoice}
              choice={payChoice}
              agreement={{ id: a.id, kind: a.kind, bookingId: a.bookingId ?? null, inspectionId: a.inspectionId ?? null }}
              here={`/agreements/${a.id}`}
              agreementStatus={a.status}
            />
          ) : a.role === "renter" && payHref ? (
            <Link href={payHref} className="nf-btn nf-btn--primary nf-btn--md nf-btn--full" data-testid="agreement-pay">
              {agreementPayLabel(formatMoney(a.amountMinor, locale))}
            </Link>
          ) : a.role === "owner" ? (
            <p className={TYPE.body} data-testid="agreement-awaiting-payment">
              {agreementOwnerApproved(a.kind)}
            </p>
          ) : null}
          {payChoice && a.role === "renter" ? null : (
            <p className={`${TYPE.rowMeta} mt-inline`} data-testid="agreement-pay-inside">
              {PAY_ONLY_THROUGH_VALLO}
            </p>
          )}
          {party ? <CancelAgreement agreementId={a.id} /> : null}
        </Section>
      ) : null}

      {/* THE GUARANTEE IS RETIRED (D51, guarantee_bps = 0). A payment made
          while it ran carried a contribution, frozen into the agreement's
          terms, and its claim is honoured; a new payment carries none, so the
          section is drawn only where a contribution was really taken or a
          claim already exists. */}
      {a.status === "paid" && (legacyContribution || a.claims.length > 0) ? (
        <Section title="A claim on this payment">
          <p className={TYPE.body}>{LEGACY_GUARANTEE_CLAIM}</p>
          {a.claimWindow ? (
            <p className={TYPE.rowMeta}>
              Claim window: {new Date(a.claimWindow.opens).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} to{" "}
              {new Date(a.claimWindow.closes).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}.
            </p>
          ) : null}
          {a.claims.length > 0 ? (
            <ul className="mt-block grid gap-2xs">
              {a.claims.map((c) => (
                <li key={c.id} className={TYPE.body}>
                  Claim for {formatMoney(c.requestedMinor, locale)}: {CLAIM_STATUS_LABEL[c.status] ?? c.status}
                  {c.approvedMinor ? ` (${formatMoney(c.approvedMinor, locale)})` : ""}
                  {c.reason ? `. ${c.reason}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {!party ? null : windowOpen && cap > 0 && a.claims.some((c) => c.mine && c.status === "submitted") ? (
            <p className={TYPE.rowMeta} data-testid="claim-waiting">
              Your claim is with Vallo. You can make another once it is decided.
            </p>
          ) : windowOpen && cap > 0 ? (
            <ClaimForm agreementId={a.id} capNaira={(cap / 100).toLocaleString("en-NG")} />
          ) : null}
        </Section>
      ) : null}

      <Section title={words.historyTitle}>
        <AgreementHistory events={history} names={names} locale={locale} copy={words} kind={a.kind} />
      </Section>

      <p className={`${TYPE.rowMeta} mt-block`}>{OFF_PLATFORM_SENTENCE}</p>
    </main>
  );
}

type TrackWords = Record<AgreementStepKey, string> & { sentBack: string; cancelled: string; reviewing?: string };

function agreementSteps(
  status: string,
  events: { at: string; action: string }[],
  track: TrackWords,
  locale: Locale,
): TrackStep[] {
  return agreementTrack({ status, events }).map((step) => ({
    key: step.key,
    label:
      step.state === "failed"
        ? status === "rejected"
          ? track.sentBack
          : track.cancelled
        : step.key === "approved" && step.state === "current"
          ? (track.reviewing ?? track.approved)
          : track[step.key],
    when: step.at
      ? new Date(step.at).toLocaleString(intlTag[locale], {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Lagos",
        })
      : null,
    state: step.state,
  }));
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
