import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney, intlTag, type Locale } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readAgreement } from "@/lib/agreements/queries";
import { readHeldPayment } from "@/lib/money/held-view";
import { readAgreementRail } from "@/lib/money/fund-view";
import { protectedRailLive } from "@/lib/money/rail-live";
import { readAgreementPayChoice } from "@/lib/payments/rail-choice-read";
import { readChangesSinceConfirmed } from "@/lib/agreements/changes-read";
import type { TermChange } from "@/lib/agreements/terms-diff";
import type { WordedChange } from "@/components/app/agreements/AgreementChanges";
import { eventLabel } from "@/components/app/agreements/AgreementHistory";
import { readAgreementRecord } from "@/components/app/agreements/record-read";
import { previousVersionDiff, versionRegister, type RecordEvent } from "@/components/app/agreements/version-register";
import { termValue } from "@/components/app/agreements/term-words";
import { PageFrame } from "@/components/app/PageFrame";
import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
import { readDone, type SuccessMomentId } from "@/lib/ui/success-moments";
import { agreementArrival } from "@/lib/ui/arrival-moments";
import { STAY_TRACK_WORDS, agreementStatusLabel } from "@/components/app/agreements/status";
import type { TrackStep } from "@/components/app/status/StatusTrack";
import { agreementTrack, type AgreementStepKey } from "@/components/app/status/tracks";
import { agreementPayLabel } from "@/lib/money/copy";
import { AgreementBody } from "@/components/app/agreements/AgreementBody";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceMoney.agreements.page.title };
}
export const dynamic = "force-dynamic";

function num(terms: Record<string, unknown>, key: string): number | null {
  const v = terms[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * ONE AGREEMENT: exactly what both sides committed to (Track A).
 *
 * Data loading lives here; rendering lives in `AgreementBody` so the view
 * can be mounted in a test fixture or preview without hitting the database.
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
  const payRail = a.status === "approved" && a.role === "renter" ? await readAgreementRail(a.id) : null;
  /* The escrow step redirects back here while the protected rail is off
     (sweep item 14), so its link is drawn only while the rail is live.
     Otherwise there is no Pay link for an escrow row: the payment step's
     choice card on this page stores card first, then leads to the card route. */
  const escrowLive = payRail === "escrow" ? await protectedRailLive() : false;
  const payHref =
    payRail === "escrow"
      ? escrowLive
        ? `/agreements/${a.id}/fund`
        : null
      : a.kind === "rent" && a.inspectionId
        ? `/rent/pay/${a.inspectionId}`
        : a.bookingId
          ? `/checkout/${a.bookingId}`
          : null;
  const guaranteeBps = num(a.terms, "guarantee_bps");
  const legacyContribution = guaranteeBps !== null && guaranteeBps > 0;
  const party = a.role !== null;
  const awaitingYou = party && a.status === "awaiting_parties" && !a.youConfirmedCurrent;
  const lastEvent = a.events.length > 0 ? a.events[a.events.length - 1] : undefined;
  const lastEventAt = lastEvent
    ? new Date(lastEvent.at).toLocaleString(intlTag[locale], { timeZone: "Africa/Lagos", day: "numeric", month: "short" })
    : null;

  const t = getDictionary(locale);
  const kit = t.memberKit.agreementDiff;
  const pw = t.experienceMoney.agreements.page;
  const held = await readHeldPayment(a.id);
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

  const trackWords = a.kind === "rent" ? pw.track : { ...pw.track, ...STAY_TRACK_WORDS };
  const steps = agreementSteps(a.status, a.events, trackWords, locale);
  const statusWords = agreementStatusLabel(a.status, a.kind);

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
    <div className="nf-page grid grid-cols-1 gap-md" data-testid="agreement-page" data-status={a.status}>
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
      <PageFrame title={pw.title}>
        <AgreementBody
          f={{
            a,
            locale,
            today,
            windowOpen,
            cap,
            payHref,
            guaranteeBps,
            legacyContribution,
            party,
            awaitingYou,
            lastEventAt,
            worded,
            since: since ? { by: since.by ?? null, at: since.at ?? null, fromVersion: since.fromVersion, toVersion: since.toVersion } : null,
            held: held ? { state: held.state } : null,
            payChoice,
            cardWaitsOnReview,
            kept,
            versionEntries,
            versionDiff,
            history,
            names,
            steps,
            statusWords,
            nextStep,
            yourPart,
            sinceLine,
            t,
          }}
        />
      </PageFrame>
    </div>
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

function requestTime(): number {
  return Date.now();
}
