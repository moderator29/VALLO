import Link from "next/link";
import { formatMoney, intlTag, type Locale } from "@vallo/i18n/core";
import { type AgreementDetail, UNNAMED_OWNER, UNNAMED_RENTER } from "@/lib/agreements/queries";
import type { WordedChange } from "@/components/app/agreements/AgreementChanges";
import { AgreementChanges } from "@/components/app/agreements/AgreementChanges";
import { AgreementVersions } from "@/components/app/agreements/AgreementVersions";
import { AgreementHistory } from "@/components/app/agreements/AgreementHistory";
import type { RecordEvent, VersionEntry, VersionDiff } from "@/components/app/agreements/version-register";
import { Tracker } from "@/components/ui/Tracker";
import { DecisionCard } from "@/components/app/confirm/DecisionCard";
import { ButtonLink } from "@/components/ui/Button";
import { Section, TYPE } from "@/components/app/Screen";
import { CLAIM_STATUS_LABEL, agreementStatusTone } from "@/components/app/agreements/status";
import type { TrackStep } from "@/components/app/status/StatusTrack";
import { DocActions, DocHead, DocNote, DocRow, DocRows, DocState, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { PrintDocumentTile } from "@/components/app/money/PrintDocumentTile";
import { PayChoiceCard } from "@/components/money/pay-choice/PayChoiceCard";
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
import type { PayChoice } from "@/lib/payments/rail-choice";
import { termDay } from "@/components/app/agreements/term-words";
import type { getDictionary } from "@vallo/i18n";

/**
 * All data the agreement body needs to render, computed by the page's server
 * component so this body can be mounted in a test fixture or preview without
 * hitting the database.
 */
export type AgreementFixture = {
  a: AgreementDetail;
  locale: Locale;
  today: string;
  windowOpen: boolean;
  cap: number;
  payHref: string | null;
  guaranteeBps: number | null;
  legacyContribution: boolean;
  party: boolean;
  awaitingYou: boolean;
  lastEventAt: string | null;
  worded: WordedChange[];
  since: { by: string | null; at: string | null; fromVersion: number; toVersion: number } | null;
  held: { state: string } | null;
  payChoice: PayChoice | null;
  cardWaitsOnReview: boolean;
  kept: { version: number }[] | null;
  versionEntries: readonly VersionEntry[];
  versionDiff: VersionDiff | null;
  history: RecordEvent[];
  names: { renter: string; owner: string };
  steps: TrackStep[];
  statusWords: string;
  nextStep: TrackStep | undefined;
  yourPart: string | null;
  sinceLine: string | null;
  t: ReturnType<typeof getDictionary>;
};

export function AgreementBody({ f }: { f: AgreementFixture }) {
  const { a, locale, t } = f;
  const pw = t.experienceMoney.agreements.page;
  const kit = t.memberKit.agreementDiff;
  const words = t.experienceMoney.agreements;
  const LINES = termLines(t);

  return (
    <div>
      <p className="nf-tracker-place mt-inline">
        {a.listingTitle} · {a.kind === "rent" ? pw.rental : pw.stay}
      </p>
      <Tracker
        className="mt-inline"
        label={pw.liveStatus}
        icon={a.kind === "rent" ? "key" : "bed"}
        glyph={a.status === "cancelled" || a.status === "rejected" ? "listing-rejected" : a.status === "paid" ? "booking-completed" : "empty-agreements"}
        title={f.statusWords}
        tone={agreementStatusTone(a.status)}
        since={f.sinceLine}
        cells={[
          ...(f.nextStep && a.status !== "cancelled" && a.status !== "rejected" ? [{ label: "Next step", value: f.nextStep.label }] : []),
          ...(f.yourPart ? [{ label: "Your part", value: f.yourPart }] : []),
        ]}
        steps={f.steps}
        timelineLabel={pw.progress}
        glyphs={{ drawn: "file-text", confirmed: "user-check", approved: "verified", paid: "wallet" }}
        testId="agreement-track"
      />
      <span className="sr-only" data-testid="agreement-status">
        {f.statusWords}
      </span>

      {f.awaitingYou ? (
        <DecisionCard
          className="mt-block"
          testId="agreement-awaiting-you"
          label={pw.awaitingYou}
          when={f.lastEventAt ? pw.since.replace("{date}", f.lastEventAt) : undefined}
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
              changes={f.worded.length > 0 ? f.worded : undefined}
              changesLead={kit.confirmLead}
              kind={a.kind}
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

      {f.since ? (
        <AgreementChanges
          changes={f.worded}
          copy={kit}
          byLine={
            f.since.by && f.since.at
              ? kit.by
                  .replace("{who}", f.since.by === "you" ? kit.you : kit.other)
                  .replace("{date}", new Date(f.since.at).toLocaleString(intlTag[locale], { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))
              : kit.byUndated
          }
          versionsLine={kit.versions.replace("{from}", String(f.since.fromVersion)).replace("{to}", String(f.since.toVersion))}
        />
      ) : null}

      <AgreementTermsSection
        a={a}
        locale={locale}
        pw={pw}
        kit={kit}
        words={words}
        LINES={LINES}
        party={f.party}
        legacyContribution={f.legacyContribution}
        guaranteeBps={f.guaranteeBps}
        versionDiff={f.versionDiff}
        versionEntries={f.versionEntries}
        names={f.names}
        printLabel={t.afterTheGate.complaint.print}
      />

      {f.party && (a.status === "awaiting_parties" || a.status === "rejected") ? (
        <Section title={a.status === "rejected" ? pw.whatNext : pw.confirm}>
          {a.kind === "rent" ? (
            <AmendTerms
              agreementId={a.id}
              moveIn={str(a.terms, "move_in") ?? f.today}
              handoverOn={str(a.terms, "handover_on") ?? f.today}
              notes={str(a.terms, "notes") ?? ""}
              minDate={f.today}
            />
          ) : null}
          {f.awaitingYou ? null : <CancelAgreement agreementId={a.id} />}
        </Section>
      ) : null}

      {a.status === "in_review" ? (
        <Section title={pw.withVallo}>
          <p className={TYPE.body}>{AGREEMENT_IN_REVIEW}</p>
          {f.party ? <CancelAgreement agreementId={a.id} /> : null}
        </Section>
      ) : null}

      {f.held?.state === "ready" ? (
        <Section title="Escrow payment">
          <Link href={`/agreements/${a.id}/held`} className="nf-btn nf-btn--primary nf-btn--md nf-btn--full" data-testid="agreement-held">
            See where your money is held
          </Link>
        </Section>
      ) : null}

      {(a.status === "approved" || f.cardWaitsOnReview) && f.held?.state !== "ready" ? (
        <Section title={AGREEMENT_PAYMENT_OPEN_TITLE}>
          {a.role === "renter" && f.payChoice ? (
            <PayChoiceCard
              copy={t.payChoice}
              choice={f.payChoice}
              agreement={{ id: a.id, kind: a.kind, bookingId: a.bookingId ?? null, inspectionId: a.inspectionId ?? null }}
              here={`/agreements/${a.id}`}
              agreementStatus={a.status}
            />
          ) : a.role === "renter" && f.payHref ? (
            <Link href={f.payHref} className="nf-btn nf-btn--primary nf-btn--md nf-btn--full" data-testid="agreement-pay">
              {agreementPayLabel(formatMoney(a.amountMinor, locale))}
            </Link>
          ) : a.role === "owner" ? (
            <p className={TYPE.body} data-testid="agreement-awaiting-payment">
              {agreementOwnerApproved(a.kind)}
            </p>
          ) : null}
          {f.payChoice && a.role === "renter" ? null : (
            <p className={`${TYPE.rowMeta} mt-inline`} data-testid="agreement-pay-inside">
              {PAY_ONLY_THROUGH_VALLO}
            </p>
          )}
          {f.party ? <CancelAgreement agreementId={a.id} /> : null}
        </Section>
      ) : null}

      {a.status === "paid" && (f.legacyContribution || a.claims.length > 0) ? (
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
          {!f.party ? null : f.windowOpen && f.cap > 0 && a.claims.some((c) => c.mine && c.status === "submitted") ? (
            <p className={TYPE.rowMeta} data-testid="claim-waiting">
              Your claim is with Vallo. You can make another once it is decided.
            </p>
          ) : f.windowOpen && f.cap > 0 ? (
            <ClaimForm agreementId={a.id} capNaira={(f.cap / 100).toLocaleString("en-NG")} />
          ) : null}
        </Section>
      ) : null}

      <Section title={words.historyTitle}>
        <AgreementHistory events={f.history} names={f.names} locale={locale} copy={words} kind={a.kind} />
      </Section>

      <p className={`${TYPE.rowMeta} mt-block`}>{OFF_PLATFORM_SENTENCE}</p>
    </div>
  );
}

function AgreementTermsSection({
  a,
  locale,
  pw,
  kit,
  words,
  LINES,
  party,
  legacyContribution,
  guaranteeBps,
  versionDiff,
  versionEntries,
  names,
  printLabel,
}: {
  a: AgreementDetail;
  locale: Locale;
  pw: ReturnType<typeof getDictionary>["experienceMoney"]["agreements"]["page"];
  kit: ReturnType<typeof getDictionary>["memberKit"]["agreementDiff"];
  words: ReturnType<typeof getDictionary>["experienceMoney"]["agreements"];
  LINES: { key: string; label: string }[];
  party: boolean;
  legacyContribution: boolean;
  guaranteeBps: number | null;
  versionDiff: VersionDiff | null;
  versionEntries: readonly VersionEntry[];
  names: { renter: string; owner: string };
  printLabel: string;
}) {
  return (
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
          {a.role === "owner" && legacyContribution && guaranteeBps !== null
            ? ` ${legacyReserveSentence(bpsAsPercentText(guaranteeBps))}`
            : ""}
        </DocNote>
      </DocumentSheet>
      <DocActions label={pw.theTerms}>
        <PrintDocumentTile label={printLabel} testId="agreement-print" />
      </DocActions>
    </Section>
  );
}

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

